'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { saveRecord, makeRecord } from '@/lib/memory-kernel'
import { useProfile } from '@/lib/profile-context'
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

interface PendingAttachment {
  file: File
  kind: 'image' | 'document'
  mediaType: string
  filename: string
  base64: string
  preview: string | null // data URL for images; null for PDFs
}

export default function ChatPage() {
  const { profile, userId, activeDomain, refreshMemoryCount } = useProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
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

  // Read the API key after mount (post-hydration) so SSR and client render agree,
  // and re-read when the tab regains focus in case Settings just updated it.
  useEffect(() => {
    const read = () => {
      const raw = localStorage.getItem('salence_api_key') ?? ''
      // Trim defensively: mobile keyboards / clipboards sometimes wrap pasted
      // keys in whitespace or quotes, and invisible characters survive save.
      const cleaned = raw.trim().replace(/^["']|["']$/g, '')
      setApiKey(cleaned)
    }
    read()
    window.addEventListener('focus', read)
    return () => window.removeEventListener('focus', read)
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

    // Block the request up-front if there's no key — rather than sending
    // an empty/invalid request and waiting for a confusing server error.
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'I need your API key to respond. Open Settings → Your AI, paste your key, and click Save provider.',
          ts: Date.now(),
          err: true,
        },
      ])
      return
    }

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

    await saveRecord(
      makeRecord({
        content: text,
        contentType: 'conversation',
        domain: activeDomain,
        tags: sent ? ['user', 'with-attachment'] : ['user'],
        source: 'chat',
        userId,
      })
    )

    // fire-and-forget fact extraction
    if (apiKey) {
      fetch('/api/agents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          domain: activeDomain,
          userId,
          apiKey,
        }),
      }).finally(() => refreshMemoryCount())
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-salence-api-key': apiKey,
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : '',
        },
        body: JSON.stringify({
          message: text,
          domain: activeDomain,
          assistantName,
          userName,
          history: next.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
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
      const reply = data.reply || '...'

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, ts: Date.now() },
      ])

      await saveRecord(
        makeRecord({
          content: reply,
          contentType: 'conversation',
          domain: activeDomain,
          tags: ['assistant'],
          source: 'chat',
          userId,
        })
      )

      if (sent) {
        const summary = reply.replace(/\s+/g, ' ').trim().slice(0, 180)
        await saveRecord(
          makeRecord({
            content: `User uploaded ${sent.filename} — ${summary}`,
            contentType: 'fact',
            domain: activeDomain,
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
          content: `I hit a snag: ${(err as Error).message}. Check your API key in Settings.`,
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
          context: <strong>{activeDomain}</strong>
        </span>
      </header>

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
          <div
            key={i}
            className={`chat-bubble chat-bubble-${m.role}${m.err ? ' is-error' : ''}`}
          >
            {m.content}
          </div>
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
