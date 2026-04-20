'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import VideoPlayer from '@/components/VideoPlayer'
import api from '@/lib/api'
import type { Video } from '@/types'

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>()
  const [video, setVideo] = useState<Video | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    api.get(`/video/detail/${id}`)
      .then(r => setVideo(r.data.video))
      .catch(() => setNotFound(true))
  }, [id])

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">视频未找到</h2>
        <a href="/" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">返回首页</a>
      </div>
    </div>
  )

  if (!video) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <VideoPlayer video={video} />
      </div>
    </div>
  )
}
