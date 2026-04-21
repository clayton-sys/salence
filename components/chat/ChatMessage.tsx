'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { renderCard, type CardToolUse } from '@/components/cards'
import type { AssistantContentBlock } from '@/lib/types'

type MessageRole = 'user' | 'assistant'

interface ChatMessageProps {
  role: MessageRole
  /**
   * Either a string (plain text, backwards-compatible) or an array of
   * blocks (text + card tool_use). The array form is what Phase 2 emits.
   */
  content: string | AssistantContentBlock[]
  err?: boolean
}

export function ChatMessage({ role, content, err }: ChatMessageProps) {
  const blocks: AssistantContentBlock[] =
    typeof content === 'string' ? [{ type: 'text', text: content }] : content

  return (
    <div className={`chat-bubble chat-bubble-${role}${err ? ' is-error' : ''}`}>
      {blocks.map((block, i) => {
        if (block.type === 'text' && block.text) {
          return (
            <div key={i} className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {block.text}
              </ReactMarkdown>
            </div>
          )
        }
        if (block.type === 'tool_use' && block.name?.startsWith('card_')) {
          return (
            <div key={i}>
              {renderCard(block as CardToolUse)}
            </div>
          )
        }
        if (block.type === 'tool_status') {
          return (
            <div key={i} className="card-tool-running">
              <span className="dot" />
              {block.label || block.name || 'running tool'}
            </div>
          )
        }
        // Unknown / non-card tool_use — surface a subtle indicator.
        if (block.type === 'tool_use') {
          return (
            <div key={i} className="card-tool-running">
              <span className="dot" />
              {block.name}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
