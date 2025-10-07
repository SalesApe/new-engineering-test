import { useMemo } from 'react'
import { ConversationLayout } from './components/layout/ConversationLayout'
import { ChatPane } from './features/chat/components/ChatPane'
import { ConversationsSidebar } from './features/chat/components/ConversationsSidebar'
import { useConversations } from './features/chat/hooks/useConversations'
import { useConversationSelection } from './features/chat/hooks/useConversationSelection'

const App = () => {
  const {
    data: conversations,
    isLoading: convLoading,
    error: convError,
    refetch: refetchConversations,
    createConversation,
  } = useConversations()

  const { selectedConversation, setSelectedConversationId, selectedConversationId } =
    useConversationSelection(conversations ?? [])

  const sidebarState = useMemo(
    () => ({
      conversations: conversations ?? [],
      selectedConversationId,
      onSelectConversation: setSelectedConversationId,
      onCreateConversation: createConversation,
      isLoading: convLoading,
      error: convError,
      refetch: refetchConversations,
    }),
    [
      conversations,
      selectedConversationId,
      setSelectedConversationId,
      createConversation,
      convLoading,
      convError,
      refetchConversations,
    ]
  )

  return (
    <ConversationLayout
      sidebar={<ConversationsSidebar {...sidebarState} />}
      main={<ChatPane conversation={selectedConversation} />}
    />
  )
}

export default App
