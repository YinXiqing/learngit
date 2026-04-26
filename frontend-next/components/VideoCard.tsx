'use client'
import { useState, useRef, memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

function VideoCard({ video, formatViews, formatDuration, priority = false }: {
  video: Video; formatViews?: (v: number) => string; formatDuration?: (s: number) => string; priority?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startPreview = () => {
    const el = videoRef.current
    if (!el) return

    const src = `/api/video/hls/${video.id}/index.m3u8`

    if (window.Hls?.isSupported()) {
      const hls = new window.Hls({ enableWorker: true, maxBufferLength: 8, startLevel: 0 })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(el)
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}))
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src
      el.play().catch(() => {})
    }
  }

  const handleEnter = () => {
    if (window.matchMedia('(hover: none)').matches) return
    timer.current = setTimeout(() => {
      setIsHovered(true)
      // 等 video 元素渲染后再启动
      setTimeout(startPreview, 50)
    }, 200)
  }

  const handleLeave = () => {
    if (timer.current) clearTimeout(timer.current)
    setIsHovered(false)
    setVideoReady(false)
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    if (videoRef.current) { videoRef.current.src = '' }
  }

  const coverSrc = `/api/video/cover/${video.id}`

  return (
    <div className="group bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow"
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link href={`/video/${video.id}`}>
        <div className="relative aspect-video overflow-hidden bg-gray-900">
          {!imgError && video.cover_image && (
            <Image src={coverSrc} alt={video.title} fill
              className={`object-cover transition-opacity duration-300 ${isHovered && videoReady ? 'opacity-0' : 'opacity-100'}`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImgError(true)} priority={priority} loading={priority ? 'eager' : 'lazy'} />
          )}
          {isHovered && (
            <video ref={videoRef} muted loop playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`}
              onCanPlay={() => setVideoReady(true)} />
          )}
          {!isHovered && (video.duration ?? 0) > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatDuration?.(video.duration!) ?? '00:00'}
            </div>
          )}
        </div>
      </Link>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm leading-snug min-h-[2.5rem]">
          <Link href={`/video/${video.id}`}>{video.title}</Link>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{video.author}</p>
        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 space-x-2">
          <span>{formatViews?.(video.view_count) ?? video.view_count} 次观看</span><span>•</span>
          <span>{video.created_at.slice(0, 10)}</span>
        </div>
      </div>
    </div>
  )
}

export default memo(VideoCard)
