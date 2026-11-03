import { useEffect, useState } from 'react'
import { Conversation } from '../types'

export function useConversationSelection(conversations: Conversation[]) {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null)

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId(null)
      return
    }

    const alreadySelected = conversations.some((c) => c.id === selectedConversationId)
    if (!alreadySelected) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null

  return {
    selectedConversation,
    selectedConversationId,
    setSelectedConversationId,
  }
}
