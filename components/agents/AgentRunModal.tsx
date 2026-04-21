'use client'

import { useEffect, useState } from 'react'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { AssistantContentBlock } from '@/lib/types'

interface Props {
  agentId: string
  onClose: () => void
}

type Phase = 'running' | 'done' | 'error'

export function AgentRunModal({ agentId, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('running')
  const [blocks, setBlocks] = useState<AssistantContentBlock[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || 'Agent failed')
        setBlocks(data.content || [])
        setPhase('done')
      } catch (err) {
        if (cancelled) return
        setError((err as Error).message)
        setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentId])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{agentId}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-body modal-body-scroll">
          {phase === 'running' && (
            <div className="card-tool-running">
              <span className="dot" />
              Thinking…
            </div>
          )}
          {phase === 'error' && error && (
            <p style={{ color: 'var(--danger)' }}>{error}</p>
          )}
          {blocks.length > 0 && (
            <ChatMessage role="assistant" content={blocks} />
          )}
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="card-ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
