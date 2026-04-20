'use client'
import { RequireAuth } from '@/components/AuthGuard'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import api from '@/lib/api'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Video } from '@/types'

const dur = (s: number | null) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : ''

export default function HistoryPage() {
  const [history, setHistory] = useState<{ watched_at: string; video: Video }[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => { fetchHistory() }, [])

  const fetchHistory = async () => {
    try { const res = await api.get('/video/history'); setHistory(res.data.history) }
    catch {} finally { setLoading(false) }
  }

  const clearHistory = async () => {
    await api.delete('/video/history')
    setHistory([])
    setConfirmClear(false)
  }

  return (
    <RequireAuth>
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">观看历史</h1>
          {history.length > 0 && (
            <button onClick={() => setConfirmClear(true)} className="text-sm text-red-500 hover:text-red-700">清空历史</button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 flex gap-4 animate-pulse">
                <div className="w-40 h-24 bg-gray-200 dark:bg-[#333] rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p>暂无观看记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(({ watched_at, video }) => (
              <Link key={`${video.id}-${watched_at}`} href={`/video/${video.id}`}
                className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow">
                <div className="relative w-40 h-24 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                  {video.cover_image
                    ? <Image src={video.is_scraped && video.cover_image.startsWith('http') ? video.cover_image : `/api/video/cover/${video.id}`}
                        alt={video.title} fill className="object-cover" sizes="160px" />
                    : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                  {video.duration && <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">{dur(video.duration)}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">{video.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{video.author}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(watched_at).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog isOpen={confirmClear} onClose={() => setConfirmClear(false)} onConfirm={clearHistory}
        title="清空观看历史" message="确定要清空所有观看记录吗？" type="danger" confirmText="清空" cancelText="取消" />
    </div>
    </RequireAuth>
  )
}
