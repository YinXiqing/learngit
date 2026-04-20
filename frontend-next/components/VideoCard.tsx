'use client'
import { useState, useRef, memo, useEffect } from 'react'
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

  const pendingUrl = useRef<string | null>(null)
  const isHoveredRef = useRef(false)

  const tryStartHls = (url: string, retryCount = 0) => {
    const doStart = (el: HTMLVideoElement) => {
      if (!window.Hls?.isSupported() || hlsRef.current) return
      const src = url.startsWith('/') ? url : `/api/video/proxy?url=${encodeURIComponent(url)}`
      const hls = new window.Hls({ enableWorker: true, maxBufferLength: 8, startLevel: 0 })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(el)
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}))
      hls.on(window.Hls.Events.ERROR, (_: any, d: any) => {
        if (d.fatal && retryCount < 2 && video.is_scraped) {
          hls.destroy(); hlsRef.current = null
          fetch(`/api/video/refresh-url/${video.id}`)
            .then(r => r.json())
            .then(data => { if (data.video_url && isHoveredRef.current) tryStartHls(data.video_url, retryCount + 1) })
            .catch(() => {})
        }
      })
    }
    const retry = (n = 10) => {
      const el = videoRef.current
      if (el) {
        window.Hls ? doStart(el) : (() => {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js'
          s.onload = () => doStart(el)
          document.head.appendChild(s)
        })()
      } else if (n > 0) setTimeout(() => retry(n - 1), 30)
    }
    retry()
  }

  // isHovered 变 true 后，如果 pendingUrl 已就绪则启动
  useEffect(() => {
    isHoveredRef.current = isHovered
    if (isHovered && pendingUrl.current) {
      tryStartHls(pendingUrl.current)
    }
  }, [isHovered])

  const handleEnter = () => {
    pendingUrl.current = null
    if (video.is_scraped && video.source_url) {
      pendingUrl.current = video.source_url
    } else if (video.hls_ready) {
      pendingUrl.current = `/api/video/hls/${video.id}/index.m3u8`
    }
    timer.current = setTimeout(() => setIsHovered(true), 150)
  }

  const handleLeave = () => {
    if (timer.current) clearTimeout(timer.current)
    isHoveredRef.current = false
    setIsHovered(false); setVideoReady(false)
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
  }

  return (
    <div className="group bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link href={`/video/${video.id}`}>
        <div className="relative aspect-video overflow-hidden bg-gray-900">
          {!imgError && video.cover_image && (
            <Image src={video.is_scraped && video.cover_image.startsWith('http') ? video.cover_image : `/api/video/cover/${video.id}`} alt={video.title} fill
              className={`object-cover transition-opacity duration-300 ${isHovered && videoReady ? 'opacity-0' : 'opacity-100'}`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" onError={() => setImgError(true)} priority={priority} loading={priority ? 'eager' : 'lazy'} />
          )}
          {isHovered && (video.is_scraped
            ? <video ref={videoRef} muted loop playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`} onCanPlay={() => setVideoReady(true)} />
            : video.hls_ready
              ? <video ref={videoRef} muted loop playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`} onCanPlay={() => setVideoReady(true)} />
              : <video src={`/api/video/file/${video.id}`} autoPlay muted loop className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoReady ? 'opacity-100' : 'opacity-0'}`} onCanPlay={() => setVideoReady(true)} />
          )}
          {!isHovered && (video.duration ?? 0) > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{formatDuration?.(video.duration!) ?? '00:00'}</div>
          )}
        </div>
      </Link>
      <div className="p-4" style={{ height: '100px' }}>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm leading-snug" style={{ minHeight: '2.5rem' }}>
          <Link href={`/video/${video.id}`}>{video.title}</Link>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{video.author}</p>
        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 space-x-2">
          <span>{formatViews?.(video.view_count) ?? video.view_count} 次观看</span><span>•</span><span>{video.created_at.slice(0, 10)}</span>
        </div>
      </div>
    </div>
  )
}

export default memo(VideoCard)
