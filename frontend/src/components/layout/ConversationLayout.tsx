import { ReactNode } from 'react'

interface ConversationLayoutProps {
  sidebar: ReactNode
  main: ReactNode
}

export const ConversationLayout = ({ sidebar, main }: ConversationLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row">
        <aside className="md:w-72 md:self-start">{sidebar}</aside>
        <section className="flex-1">{main}</section>
      </div>
    </div>
  )
}
