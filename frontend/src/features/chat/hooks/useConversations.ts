import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createConversationRequest,
  fetchConversations,
} from '../api/chatApi'
import { Conversation } from '../types'

const CONVERSATIONS_QUERY_KEY = ['conversations']

export function useConversations() {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: fetchConversations,
  })

  const { mutateAsync: createConversationMutation, isPending: isCreating } = useMutation({
    mutationFn: (title?: string | null) => createConversationRequest(title),
    onSuccess: (conversation) => {
      queryClient.setQueryData<Conversation[] | undefined>(CONVERSATIONS_QUERY_KEY, (prev) => {
        if (!prev) return [conversation]
        return [conversation, ...prev]
      })
    },
  })

  const createConversation = async (title?: string | null) => {
    const conv = await createConversationMutation(title)
    return conv
  }

  return {
    data,
    isLoading: isLoading || isFetching,
    error,
    refetch,
    createConversation,
    isCreating,
  }
}
