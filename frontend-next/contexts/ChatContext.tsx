'use client'
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

export type Message = { role: 'user' | 'assistant'; content: string; timestamp?: number; videos?: {id:number;title:string;cover?:string|null;is_scraped?:boolean}[] }

interface ChatContextType {
  open: boolean
  toggleOpen: () => void
  messages: Message[]
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  clearMessages: () => void
}

const ChatContext = createContext<ChatContextType | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessagesState] = useState<Message[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat_messages')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setMessagesState(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages.slice(-50)))
  }, [messages])

  const toggleOpen = useCallback(() => setOpen(p => !p), [])
  const setMessages = useCallback((v: Message[] | ((prev: Message[]) => Message[])) => setMessagesState(v), [])
  const clearMessages = useCallback(() => {
    setMessagesState([])
    localStorage.removeItem('chat_messages')
  }, [])

  return (
    <ChatContext.Provider value={{ open, toggleOpen, messages, setMessages, clearMessages }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
