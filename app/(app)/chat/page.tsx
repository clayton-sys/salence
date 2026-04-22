'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { saveRecord, makeRecord } from '@/lib/memory-kernel'
import { useProfile } from '@/lib/profile-context'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { Message } from '@/lib/types'

// minimal typing for SpeechRecognition (not in lib.dom by default)
type SpeechRecognitionResult = {
  transcript: string
  isFinal?: boolean
}
type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResult>>
  resultIndex: number
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: (e: SpeechRecognitionEvent) => void
  onerror: (e: unknown) => void
  onend: () => void
}

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

// Flatten content blocks to plain text for record storage + history replay.
type MaybeBlock = {
  type?: string
  text?: string
  name?: string
  input?: Record<string, unknown>
}
function flattenToText(content: string | MaybeBlock[]): string {
  if (typeof content === 'string') return content
  return content
    .map((b) => {
      if (b.type === 'text' && b.text) return b.text
      if (b.type === 'tool_use' && b.name) return `[card: ${b.name}]`
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

interface PendingAttachment {
  file: File
  kind: 'image' | 'document'
  mediaType: string
  filename: string
  base64: string
  preview: string | null // data URL for images; null for PDFs
}

export default function ChatPage() {
  const {
    profile,
    userId,
    activeDomain,
    activeContextSlug,
    setActiveContextSlug,
    contexts,
    refreshMemoryCount,
  } = useProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const assistantName = profile?.assistant_name || 'Nova'
  const userName = profile?.name || 'friend'

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    setVoiceSupported(!!Ctor)
  }, [])

  // One-time cleanup: remove legacy per-user API keys so returning users
  // don't have orphaned keys hanging around in localStorage.
  useEffect(() => {
    try {
      localStorage.removeItem('salence_api_key')
    } catch {
      /* localStorage blocked */
    }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, thinking])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('records')
        .select('content, tags, created_at')
        .eq('user_id', userId)
        .eq('content_type', 'conversation')
        .eq('source', 'chat')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) {
        console.error('Load chat history error:', JSON.stringify(error))
        return
      }
      if (cancelled || !data) return
      const loaded: Message[] = data
        .map((row) => {
          const role: 'user' | 'assistant' =
            Array.isArray(row.tags) && row.tags.includes('assistant')
              ? 'assistant'
              : 'user'
          return {
            role,
            content: row.content,
            ts: new Date(row.created_at).getTime(),
          }
        })
        .reverse()
      setMessages(loaded)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const toggleVoice = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return

    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const rec = new Ctor()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    let finalText = ''
    rec.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i][0]
        if (event.results[i].length && (event.results[i] as unknown as { isFinal: boolean }).isFinal) {
          finalText += r.transcript
        } else {
          interim += r.transcript
        }
      }
      setInput((prev) => {
        const base = prev.replace(/\s*\[\[interim\]\].*$/, '')
        return finalText
          ? base + finalText
          : base + (interim ? ` [[interim]]${interim}` : '')
      })
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => {
      setListening(false)
      setInput((prev) => prev.replace(/\s*\[\[interim\]\].*$/, '').trim())
    }

    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }, [listening])

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setAttachError(null)
    const file = e.target.files?.[0]
    // reset so selecting the same file twice still fires change
    e.target.value = ''
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setAttachError(
        `Unsupported file type. Accepted: JPEG, PNG, WebP, GIF, PDF.`
      )
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      setAttachError(`File is ${mb}MB — max is 10MB.`)
      return
    }

    const reader = new FileReader()
    reader.onerror = () => setAttachError('Could not read the file.')
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      const kind: 'image' | 'document' =
        file.type === 'application/pdf' ? 'document' : 'image'
      setAttachment({
        file,
        kind,
        mediaType: file.type,
        filename: file.name,
        base64,
        preview: kind === 'image' ? dataUrl : null,
      })
    }
    reader.readAsDataURL(file)
  }

  function clearAttachment() {
    setAttachment(null)
    setAttachError(null)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || !userId || thinking) return

    const now = Date.now()
    const sent = attachment
    const displayContent = sent
      ? `${text}\n\n📎 ${sent.filename}`
      : text
    const next: Message[] = [
      ...messages,
      { role: 'user', content: displayContent, ts: now },
    ]
    setMessages(next)
    setInput('')
    setAttachment(null)
    setAttachError(null)
    setThinking(true)

    const effectiveDomain = activeContextSlug || activeDomain

    // Chat-native quick-add: "save note: ..." skips the extractor round-trip
    // and writes a note record immediately. Return fast with an ack bubble.
    const noteMatch = /^\s*(?:save\s+note|note)\s*[:\-–]\s*(.+)$/i.exec(text)
    if (noteMatch) {
      const body = noteMatch[1].trim()
      await saveRecord(
        makeRecord({
          content: body,
          contentType: 'note',
          domain: effectiveDomain,
          tags: activeContextSlug ? ['note', activeContextSlug] : ['note'],
          source: 'chat',
          userId,
        })
      )
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Saved to notes${
            activeContextSlug ? ` (${activeContextSlug})` : ''
          }. Open them at [Notes](/notes).`,
          ts: Date.now(),
        },
      ])
      refreshMemoryCount()
      setThinking(false)
      return
    }

    await saveRecord(
      makeRecord({
        content: text,
        contentType: 'conversation',
        domain: effectiveDomain,
        tags: sent ? ['user', 'with-attachment'] : ['user'],
        source: 'chat',
        userId,
      })
    )

    // fire-and-forget fact extraction
    fetch('/api/agents/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        domain: effectiveDomain,
        context_slug: activeContextSlug,
      }),
    }).finally(() => refreshMemoryCount())

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          domain: effectiveDomain,
          context_slug: activeContextSlug,
          assistantName,
          userName,
          history: next.slice(-20).map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : flattenToText(m.content),
          })),
          attachment: sent
            ? {
                kind: sent.kind,
                media_type: sent.mediaType,
                data: sent.base64,
                filename: sent.filename,
              }
            : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chat failed')
      const blocks = Array.isArray(data.content) ? data.content : []
      const replyText = flattenToText(blocks) || '...'

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: blocks.length ? blocks : replyText, ts: Date.now() },
      ])

      await saveRecord(
        makeRecord({
          content: replyText,
          contentType: 'conversation',
          domain: effectiveDomain,
          tags: ['assistant'],
          source: 'chat',
          userId,
        })
      )

      if (sent) {
        const summary = replyText.replace(/\s+/g, ' ').trim().slice(0, 180)
        await saveRecord(
          makeRecord({
            content: `User uploaded ${sent.filename} — ${summary}`,
            contentType: 'fact',
            domain: effectiveDomain,
            tags: ['upload', sent.mediaType],
            source: 'chat',
            userId,
          })
        )
      }
      refreshMemoryCount()
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I hit a snag: ${(err as Error).message}`,
          ts: Date.now(),
          err: true,
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <section className="chat-view">
      <header className="chat-header">
        <h1>{assistantName}</h1>
        <span className="chat-domain">
          context:{' '}
          <strong>
            {activeContextSlug
              ? contexts.find((c) => c.slug === activeContextSlug)?.label ||
                activeContextSlug
              : 'all'}
          </strong>
        </span>
      </header>

      {contexts.length > 0 && (
        <div className="chat-context-chips">
          <button
            type="button"
            className={`chat-context-chip${
              activeContextSlug === null ? ' is-active' : ''
            }`}
            onClick={() => setActiveContextSlug(null)}
          >
            All
          </button>
          {contexts.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chat-context-chip${
                activeContextSlug === c.slug ? ' is-active' : ''
              }`}
              onClick={() =>
                setActiveContextSlug(
                  activeContextSlug === c.slug ? null : c.slug
                )
              }
              title={`/${c.slug}`}
            >
              {c.color && (
                <span
                  className="chat-context-dot"
                  style={{ background: c.color }}
                />
              )}
              {c.icon && <span>{c.icon}</span>}
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && !thinking && (
          <div className="chat-empty">
            <span className="chat-empty-mark">◎</span>
            <p className="chat-empty-text">
              What&apos;s on your mind, {userName}?
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatMessage
            key={i}
            role={m.role}
            content={m.content}
            err={m.err}
          />
        ))}

        {thinking && (
          <div className="chat-bubble chat-bubble-assistant">
            <span className="chat-typing">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </div>
        )}
      </div>

      {(attachment || attachError) && (
        <div className="chat-attachment-tray">
          {attachment && (
            <div className="chat-attachment-preview">
              {attachment.preview ? (
                // Data-URL preview of a user-uploaded file — next/image can't
                // optimize data URLs, plain <img> is correct here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.preview}
                  alt={attachment.filename}
                  className="chat-attachment-thumb"
                />
              ) : (
                <div className="chat-attachment-pdf">
                  <span className="chat-attachment-icon">📄</span>
                  <span className="chat-attachment-name">
                    {attachment.filename}
                  </span>
                </div>
              )}
              <button
                type="button"
                className="chat-attachment-remove"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                title="Remove"
              >
                ×
              </button>
            </div>
          )}
          {attachError && (
            <p className="chat-attachment-error">{attachError}</p>
          )}
        </div>
      )}

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage()
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="chat-attach"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          title="Attach image or PDF"
        >
          📎
        </button>
        {voiceSupported && (
          <button
            type="button"
            className={`chat-voice${listening ? ' is-live' : ''}`}
            onClick={toggleVoice}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            title={listening ? 'Stop' : 'Voice input'}
          >
            {listening ? '■' : '🎙'}
          </button>
        )}
        <textarea
          className="chat-input"
          value={input.replace(/\s*\[\[interim\]\].*$/, (m) =>
            m.replace('[[interim]]', '')
          )}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          rows={1}
          placeholder={`Message ${assistantName}…`}
        />
        <button
          type="submit"
          className="chat-send"
          disabled={thinking || !input.trim()}
          aria-label="Send"
        >
          ↑
        </button>
      </form>
    </section>
  )
}
