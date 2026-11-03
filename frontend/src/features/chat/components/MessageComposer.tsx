import { FormEvent, useState } from 'react'

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>
  isSending: boolean
}

export const MessageComposer = ({ onSend, isSending }: MessageComposerProps) => {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Message cannot be empty')
      return
    }
    if (trimmed.length > 1000) {
      setError('Message too long (max 1000 characters)')
      return
    }

    setError(null)
    setText('')
    try {
      await onSend(trimmed)
    } catch (err) {
      setError((err as Error).message || 'Failed to send message')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3 border-t bg-white px-4 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message (max 1000 chars)"
        rows={3}
        className="textarea flex-1"
        disabled={isSending}
      />
      <div className="flex flex-col items-end gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </form>
  )
}
