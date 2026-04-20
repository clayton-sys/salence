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

export default function ChatPage() {
  const { profile, userId, activeDomain, refreshMemoryCount } = useProfile()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

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

  async function sendMessage() {
    const text = input.trim()
    if (!text || !userId || thinking) return

    const now = Date.now()
    const next: Message[] = [
      ...messages,
      { role: 'user', content: text, ts: now },
    ]
    setMessages(next)
    setInput('')
    setThinking(true)

    await saveRecord(
      makeRecord({
        content: text,
        contentType: 'conversation',
        domain: activeDomain,
        tags: ['user'],
        source: 'chat',
        userId,
      })
    )

    const apiKey =
      typeof window !== 'undefined'
        ? localStorage.getItem('salence_api_key') || ''
        : ''

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

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage()
        }}
      >
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
