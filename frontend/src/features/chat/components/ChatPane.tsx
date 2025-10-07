import { Conversation } from '../types'
import { useMessages } from '../hooks/useMessages'
import { useSendMessage } from '../hooks/useSendMessage'
import { MessageList } from './MessageList'
import { MessageComposer } from './MessageComposer'

interface ChatPaneProps {
  conversation: Conversation | null
}

export const ChatPane = ({ conversation }: ChatPaneProps) => {
  const conversationId = conversation?.id ?? null
  const { messages, isLoading, isFetching, error, refetch } = useMessages(conversationId)

  const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage(conversation)

  const handleSend = async (text: string) => {
    await sendMessage(text)
  }

  if (!conversation) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center rounded-lg border bg-white text-center">
        <h2 className="text-lg font-semibold">Select a conversation</h2>
        <p className="mt-2 text-sm text-gray-500">
          Choose one from the sidebar or start a new conversation to begin chatting.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[80vh] flex-col overflow-hidden rounded-lg border bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">{conversation.title ?? 'Untitled conversation'}</h2>
          <p className="text-xs text-gray-500">
            Last updated {new Date(conversation.updated_at).toLocaleString()}
          </p>
        </div>
        {(isFetching || isLoading) && <span className="text-xs text-gray-400">Refreshing…</span>}
      </header>
      <MessageList messages={messages} isLoading={isLoading} error={error} onRetry={refetch} />
      <MessageComposer onSend={handleSend} isSending={isSending} />
    </div>
  )
}
