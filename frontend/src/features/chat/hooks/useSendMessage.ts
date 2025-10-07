import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendMessageRequest } from '../api/chatApi'
import { Conversation, Message, MessageListResponse, SendMessageResponse } from '../types'
import { messagesKey } from './useMessages'

export function useSendMessage(conversation: Conversation | null) {
  const queryClient = useQueryClient()

  const mutation = useMutation<
    SendMessageResponse,
    Error,
    string,
    { previousMessages?: MessageListResponse; tempId?: string }
  >({
    mutationFn: (text: string) => {
      if (!conversation) throw new Error('Conversation is required')
      return sendMessageRequest(conversation.id, text)
    },
    onMutate: async (text: string) => {
      if (!conversation) return undefined

      await queryClient.cancelQueries({ queryKey: messagesKey(conversation.id) })
      const previousMessages = queryClient.getQueryData<MessageListResponse>(
        messagesKey(conversation.id)
      )
      const tempId = `tmp-${Date.now()}`
      const optimisticMessage: Message = {
        id: -1,
        conversation: conversation.id,
        role: 'user',
        text,
        created_at: new Date().toISOString(),
        sequence: 0,
        pending: true,
        tempId,
      }

      queryClient.setQueryData<MessageListResponse>(messagesKey(conversation.id), (prev) => {
        const base = prev ?? { results: [], lastSeq: 0 }
        return {
          results: [...base.results, optimisticMessage],
          lastSeq: base.lastSeq,
        }
      })

      return { previousMessages, tempId }
    },
    onError: (_error, _variables, context) => {
      if (!conversation) return
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesKey(conversation.id), context.previousMessages)
      }
    },
    onSuccess: (data, _variables, context) => {
      if (!conversation) return
      queryClient.setQueryData<MessageListResponse>(messagesKey(conversation.id), (prev) => {
        const base = prev ?? { results: [], lastSeq: 0 }
        const filtered = base.results.filter((msg) => msg.tempId !== context?.tempId)
        return {
          results: [...filtered, data.user_message, data.ai_message],
          lastSeq: data.ai_message.sequence,
        }
      })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onSettled: () => {
      if (!conversation) return
      queryClient.invalidateQueries({ queryKey: messagesKey(conversation.id) })
    },
  })

  return mutation
}
