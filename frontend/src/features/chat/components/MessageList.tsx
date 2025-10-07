import { useEffect, useRef } from 'react'
import { Message } from '../types'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

export const MessageList = ({ messages, isLoading, error, onRetry }: MessageListProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString()
    } catch {
      return iso
    }
  }

  return (
    <div ref={containerRef} id="chat-scroll" className="flex-1 overflow-auto px-4 py-3">
      {isLoading && !messages.length ? (
        <div className="text-sm text-gray-500">Loading messages…</div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">Failed to load messages.</p>
          <button className="mt-2 text-sm text-blue-600 underline" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {!isLoading && !messages.length ? (
        <div className="text-sm text-gray-500">No messages yet.</div>
      ) : null}
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <article
            key={message.tempId ?? message.id}
            className={`max-w-2xl rounded-lg border px-3 py-2 text-sm shadow-sm ${
              message.role === 'user'
                ? 'self-end border-blue-200 bg-blue-50'
                : 'self-start border-gray-200 bg-gray-50'
            } ${message.pending ? 'opacity-70' : ''}`}
          >
            <header className="mb-1 flex items-center gap-2 text-xs text-gray-500">
              <span className="font-semibold uppercase">{message.role}</span>
              <span>{formatTime(message.created_at)}</span>
              {message.pending ? <span>Sending…</span> : null}
            </header>
            <pre className="whitespace-pre-wrap text-gray-900">{message.text}</pre>
          </article>
        ))}
      </div>
    </div>
  )
}
