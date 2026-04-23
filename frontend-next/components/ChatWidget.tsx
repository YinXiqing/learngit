'use client'
import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'
import { useChat, type Message } from '@/contexts/ChatContext'
import { useAuth } from '@/contexts/AuthContext'

type VideoResult = { id: number; title: string; cover?: string | null; is_scraped?: boolean }

const QUICK_ACTIONS = [
  { icon: '🔍', text: '搜索热门视频', desc: '发现平台热门内容' },
  { icon: '📤', text: '去上传页面', desc: '上传你的视频' },
  { icon: '📋', text: '我的视频', desc: '管理已上传的视频' },
  { icon: '⏱️', text: '观看历史', desc: '查看最近看过的视频' },
]

const QA_SUGGESTIONS = [
  { icon: '❓', text: '如何上传视频？' },
  { icon: '🔑', text: '忘记密码怎么办？' },
  { icon: '📊', text: '平台有多少视频？' },
  { icon: '⏳', text: '视频上传后多久能看？' },
]

function executeUIAction(action: Record<string, unknown>) {
  const type = action.type as string
  if (type === 'navigate') {
    window.location.href = action.url as string
  } else if (type === 'search') {
    const kw = encodeURIComponent(action.keyword as string)
    window.location.href = `/search?search=${kw}`
  } else if (type === 'play') {
    window.location.href = `/video/${action.video_id}`
  } else if (type === 'logout') {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('退出'))
    btn?.click()
  }
}

export default function ChatWidget() {
  const { open, toggleOpen, messages, setMessages, clearMessages } = useChat()
  const { isAuthenticated } = useAuth()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setIsClient(true) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleToggle = () => toggleOpen()

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: Date.now() }
    const allMessages = [...messages, userMsg]
    setMessages(allMessages)
    setInput('')
    setLoading(true)

    const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now() }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages.map(m => ({ role: m.role, content: m.content })) }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw)
            if (parsed.type === 'action') {
              const actionType = parsed.action.type
              // navigate/play/logout 延迟执行
              if (['navigate','play','logout'].includes(actionType)) {
                setTimeout(() => executeUIAction(parsed.action), 300)
              }
              // 有视频结果的 action，存到消息的 videos 字段
              if (parsed.action.results?.length) {
                setMessages(prev => {
                  const u = [...prev]
                  u[u.length - 1] = { ...u[u.length - 1], videos: parsed.action.results }
                  return u
                })
              }
            } else if (parsed.type === 'text' && parsed.content) {
              fullContent += parsed.content
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { ...u[u.length - 1], content: fullContent }
                return u
              })
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { ...u[u.length - 1], content: '请求失败，请检查服务是否运行' }
        return u
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isClient) return null

  return (
    <>
      {/* 悬浮按钮 */}
      <button onClick={handleToggle}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110">
        {open
          ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        }
      </button>

      {/* 聊天面板 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[540px] bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* 头部 */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium">AI 助手</span>
            </div>
            <button onClick={clearMessages} className="text-xs opacity-70 hover:opacity-100 px-2 py-1 rounded hover:bg-white/20">
              清空
            </button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-[#0f0f0f]">
            {!isAuthenticated ? (
              <div className="flex items-center justify-center h-full">
                <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">需要登录</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI 助手功能需要登录后才能使用</p>
                  </div>
                  <button
                    onClick={() => window.location.href = '/login'}
                    className="w-full px-4 py-2.5 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all font-medium"
                  >
                    前往登录
                  </button>
                </div>
              </div>
            ) : (
              <>
            {messages.length === 0 && (
              <div className="space-y-4">
                {/* 欢迎语 */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800/40">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">👋 你好！我是 AI 助手</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">我可以帮你操作页面、回答问题、查询平台数据。直接输入或点击下方快捷选项开始吧。</p>
                </div>

                {/* 快捷操作 */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 px-1">⚡ 快捷操作</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map(s => (
                      <button key={s.text} onClick={() => sendMessage(s.text)}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-[#2a2a2a] border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm text-left transition-all">
                        <span className="text-lg leading-none mt-0.5">{s.icon}</span>
                        <div>
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{s.text}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{s.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 常见问题 */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 px-1">💬 常见问题</p>
                  <div className="space-y-1.5">
                    {QA_SUGGESTIONS.map(s => (
                      <button key={s.text} onClick={() => sendMessage(s.text)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white dark:bg-[#2a2a2a] border border-gray-100 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-sm text-left transition-all">
                        <span className="text-sm">{s.icon}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{s.text}</span>
                        <svg className="w-3 h-3 text-gray-300 dark:text-gray-600 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${m.role === 'user' ? 'order-last' : ''}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm break-words ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-700'
                  }`}>
                    {m.content
                      ? m.role === 'assistant'
                        ? <ReactMarkdown
                            components={{
                              p: ({children}) => <p className="mb-1 last:mb-0">{children}</p>,
                              ul: ({children}) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
                              li: ({children}) => <li className="text-sm">{children}</li>,
                              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                              code: ({children}) => <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs font-mono">{children}</code>,
                            }}
                          >{m.content}</ReactMarkdown>
                        : m.content
                      : (loading && i === messages.length - 1
                          ? <span className="flex gap-1 items-center h-4">
                              {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                            </span>
                          : null)
                    }
                  </div>
                  {/* 视频卡片列表 */}
                  {m.videos && m.videos.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {m.videos.map(v => (
                        <a key={v.id} href={`/video/${v.id}`}
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-[#2a2a2a] border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all">
                          <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0">
                            {v.cover
                              ? <Image
                                  src={v.is_scraped && v.cover.startsWith('http') ? v.cover : `/api/video/cover/${v.id}`}
                                  alt={v.title} fill className="object-cover" sizes="64px" />
                              : <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500" />
                            }
                          </div>
                          <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2 flex-1">{v.title}</p>
                          <svg className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
            </>
            )}
          </div>

          {/* 输入框 */}
          {isAuthenticated && (
          <div className="p-3 bg-white dark:bg-[#1f1f1f] border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder="输入指令或问题..."
              disabled={loading}
              className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
            <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-40 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
          )}
        </div>
      )}
    </>
  )
}
