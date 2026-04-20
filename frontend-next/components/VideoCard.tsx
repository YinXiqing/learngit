'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

interface VideoCardProps {
  video: Video
  hoveredVideo: number | null
  setHoveredVideo: (id: number | null) => void
  formatViews?: (v: number) => string
  formatDuration?: (s: number) => string
  priority?: boolean
}

export default function VideoCard({ video, hoveredVideo, setHoveredVideo, formatViews, formatDuration, priority = false }: VideoCardProps) {
  const [imgError, setImgError] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const isHovered = hoveredVideo === video.id
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startHls = (url: string) => {
    const Hls = window.Hls
    if (!Hls?.isSupported() || hlsRef.current) return
    const proxy = `/api/video/proxy?url=${encodeURIComponent(url)}`
    const hls = new Hls({ enableWorker: true, maxBufferLength: 8, startLevel: 0 })
    hlsRef.current = hls
    hls.loadSource(proxy)
    const attach = () => {
      if (videoRef.current) {
        hls.attachMedia(videoRef.current)
        hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play().catch(() => {}))
        hls.on(Hls.Events.ERROR, (_: any, d: any) => {
          if (d.fatal) {
            hls.destroy(); hlsRef.current = null
            fetch(`/api/video/refresh-url/${video.id}`)
              .then(r => r.json())
              .then(data => { if (data.video_url) startHls(data.video_url) })
              .catch(() => {})
          }
        })
      } else setTimeout(attach, 20)
    }
    setTimeout(attach, 160)
  }

  const handleEnter = () => {
    if (video.is_scraped && video.source_url && window.Hls && !hlsRef.current) {
      startHls(video.source_url)
    }
    timer.current = setTimeout(() => setHoveredVideo(video.id), 150)
  }

  const handleLeave = () => {
    if (timer.current) clearTimeout(timer.current)
    setHoveredVideo(null)
    setVideoReady(false)
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
  }

  useEffect(() => {
    if (!isHovered) {
      setVideoReady(false)
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
  }, [isHovered])

  const coverSrc = video.is_scraped && video.cover_image?.startsWith('http')
    ? video.cover_image
    : `/api/video/cover/${video.id}`

  return (
    <div className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link href={`/video/${video.id}`}>
        <div className="relative aspect-video overflow-hidden bg-gray-900">
          {/* 封面图：悬浮且视频已就绪时淡出 */}
          {!imgError && video.cover_image && (
            <Image src={coverSrc} alt={video.title} fill
              className={`object-cover transition-opacity duration-300 ${isHovered && videoReady ? 'opacity-0' : 'opacity-100'}`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImgError(true)} priority={priority} loading={priority ? 'eager' : 'lazy'} />
          )}
          {/* 视频层：悬浮时渲染，就绪后淡入 */}
          {isHovered && (
            video.is_scraped ? (
              <video ref={videoRef} muted loop playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
                onCanPlay={() => setVideoReady(true)} />
            ) : (
              <video src={`/api/video/stream/${video.id}`} autoPlay muted loop
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
                onCanPlay={() => setVideoReady(true)} />
            )
          )}
          {!isHovered && (video.duration ?? 0) > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatDuration?.(video.duration!) ?? '00:00'}
            </div>
          )}
        </div>
      </Link>
      <div className="p-4" style={{ height: '100px' }}>
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors text-sm leading-snug" style={{ minHeight: '2.5rem' }}>
          <Link href={`/video/${video.id}`}>{video.title}</Link>
        </h3>
        <p className="text-sm text-gray-500 truncate">{video.author}</p>
        <div className="flex items-center text-xs text-gray-400 space-x-2 mt-auto">
          <span>{formatViews?.(video.view_count) ?? video.view_count} 次观看</span>
          <span>•</span>
          <span>{video.created_at.slice(0, 10)}</span>
        </div>
      </div>
    </div>
  )
}
