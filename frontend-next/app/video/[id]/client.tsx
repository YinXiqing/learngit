'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import VideoPlayer from '@/components/VideoPlayer'
import api from '@/lib/api'
import type { Video } from '@/types'

export default function VideoDetailClient({ id, initialVideo }: { id: string; initialVideo: Video | null }) {
  const [video, setVideo] = useState<Video | null>(initialVideo)
  const [notFound, setNotFound] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const spacer = document.getElementById('mobile-nav-spacer')
    if (spacer) spacer.style.display = 'none'
    return () => { if (spacer) spacer.style.display = '' }
  }, [])

  useEffect(() => {
    if (initialVideo) return
    api.get(`/video/detail/${id}`)
      .then(r => setVideo(r.data.video))
      .catch(() => setNotFound(true))
  }, [id, initialVideo])

  if (notFound) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">视频未找到</h2>
        <a href="/" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">返回首页</a>
      </div>
    </div>
  )

  if (!video) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      {/* 移动端顶部导航栏 */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">{video.title}</h1>
        <a href="/" className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </a>
      </div>
      <VideoPlayer video={video} />
    </div>
  )
}
