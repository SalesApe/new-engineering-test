export type MessageRole = 'user' | 'ai'

export interface Conversation {
  id: number
  title: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: number
  conversation: number
  role: MessageRole
  text: string
  created_at: string
  sequence: number
  pending?: boolean
  tempId?: string
}

export interface ConversationListResponse {
  results: Conversation[]
  count: number
  offset: number
  limit: number
}

export interface MessageListResponse {
  results: Message[]
  lastSeq: number
}

export interface SendMessageResponse {
  user_message: Message
  ai_message: Message
}
