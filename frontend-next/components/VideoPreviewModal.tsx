'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

export default function VideoPreviewModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; hlsRef.current?.destroy(); hlsRef.current = null }
  }, [])

  useEffect(() => {
    const initHls = (url: string, retryCount = 0) => {
      const el = videoRef.current
      if (!el) return
      if (window.Hls?.isSupported()) {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
        const hls = new window.Hls({ enableWorker: true })
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(el)
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}))
        hls.on(window.Hls.Events.ERROR, (_: any, d: any) => {
          if (d.fatal) {
            hls.destroy(); hlsRef.current = null
            if (retryCount < 2 && video.is_scraped) {
              fetch(`/api/video/refresh-url/${video.id}`)
                .then(r => r.json())
                .then(data => {
                  if (data.video_url) {
                    initHls(`/api/video/proxy?url=${encodeURIComponent(data.video_url)}`, retryCount + 1)
                  } else setError(true)
                })
                .catch(() => setError(true))
            } else setError(true)
          }
        })
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = url; el.play().catch(() => {})
      }
    }

    const load = () => {
      if (window.Hls) { doLoad() } else {
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js'
        s.onload = doLoad
        document.head.appendChild(s)
      }
    }

    const doLoad = () => {
      api.get(`/video/stream/${video.id}`)
        .then(({ data }) => {
          const el = videoRef.current
          if (!el) return
          if (data.is_external) {
            initHls(`/api/video/proxy?url=${encodeURIComponent(data.video_url)}`)
          } else if (data.is_hls) {
            initHls(data.video_url)
          } else if (data.is_mp4) {
            el.src = data.video_url
            el.play().catch(() => {})
          }
        })
        .catch(() => setError(true))
    }

    setTimeout(load, 100)
  }, [video.id])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-black rounded-xl overflow-hidden w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
          <span className="text-white text-sm font-medium truncate">{video.title}</span>
          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            <Link href={`/video/${video.id}`} target="_blank" className="text-gray-400 hover:text-white text-xs">详情页 →</Link>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="aspect-video bg-black flex items-center justify-center">
          {error
            ? <p className="text-gray-400 text-sm">视频加载失败</p>
            : <video ref={videoRef} controls className="w-full h-full object-contain" crossOrigin="anonymous" />
          }
        </div>
      </div>
    </div>
  )
}
