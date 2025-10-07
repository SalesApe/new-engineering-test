import { Conversation } from '../types'

interface ConversationsSidebarProps {
  conversations: Conversation[]
  selectedConversationId: number | null
  onSelectConversation: (id: number) => void
  onCreateConversation: (title?: string | null) => Promise<Conversation>
  isLoading: boolean
  error: unknown
  refetch: () => void
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export const ConversationsSidebar = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  isLoading,
  error,
  refetch,
}: ConversationsSidebarProps) => {
  const handleCreate = async () => {
    try {
      await onCreateConversation()
    } catch (err) {
      alert((err as Error).message || 'Failed to create conversation')
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 md:h-[80vh]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Conversations</h2>
        <button className="btn btn-primary" onClick={handleCreate} disabled={isLoading}>
          New
        </button>
      </div>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">Failed to load conversations.</p>
          <button className="mt-2 text-sm text-blue-600 underline" onClick={refetch}>
            Retry
          </button>
        </div>
      ) : null}
      <div className="flex-1 overflow-auto rounded-lg border bg-white">
        {isLoading && !conversations.length ? (
          <div className="p-4 text-sm text-gray-500">Loading…</div>
        ) : null}
        {!isLoading && !conversations.length ? (
          <div className="p-4 text-sm text-gray-500">No conversations yet.</div>
        ) : null}
        <ul className="divide-y">
          {conversations.map((conv) => {
            const isSelected = conv.id === selectedConversationId
            return (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className={`flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate text-sm font-medium">{conv.title ?? 'Untitled'}</span>
                  <span className="text-xs text-gray-500">{formatDate(conv.updated_at)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
