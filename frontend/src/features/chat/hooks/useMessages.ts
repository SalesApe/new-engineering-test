import { useQuery } from '@tanstack/react-query'
import { fetchMessages } from '../api/chatApi'
import { MessageListResponse } from '../types'

const messagesKey = (conversationId: number | null) => ['messages', conversationId]

export function useMessages(conversationId: number | null) {
  const query = useQuery<MessageListResponse>({
    queryKey: messagesKey(conversationId),
    queryFn: () => {
      if (!conversationId) throw new Error('Conversation ID is required')
      return fetchMessages(conversationId)
    },
    enabled: Boolean(conversationId),
    refetchInterval: conversationId ? 3000 : false,
    placeholderData: (previousData) => previousData,
  })

  return {
    messages: query.data?.results ?? [],
    lastSeq: query.data?.lastSeq ?? 0,
    ...query,
  }
}

export { messagesKey }
