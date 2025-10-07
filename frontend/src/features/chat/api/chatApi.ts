import { apiFetch } from '../../../lib/apiClient'
import {
  Conversation,
  ConversationListResponse,
  MessageListResponse,
  SendMessageResponse,
} from '../types'

export async function fetchConversations(): Promise<Conversation[]> {
  const data = await apiFetch<ConversationListResponse>('conversations/?limit=50')
  return data.results
}

export async function createConversationRequest(title?: string | null): Promise<Conversation> {
  return apiFetch<Conversation>('conversations/', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function fetchMessages(
  conversationId: number,
  since?: number
): Promise<MessageListResponse> {
  const search = new URLSearchParams()
  if (since && since > 0) {
    search.set('since', since.toString())
  }
  const query = search.toString()
  const suffix = query ? `?${query}` : ''
  return apiFetch<MessageListResponse>(`conversations/${conversationId}/messages/${suffix}`)
}

export async function sendMessageRequest(
  conversationId: number,
  text: string
): Promise<SendMessageResponse> {
  return apiFetch<SendMessageResponse>(`conversations/${conversationId}/messages/`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}
