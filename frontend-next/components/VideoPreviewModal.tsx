'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

export default function VideoPreviewModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; hlsRef.current?.destroy(); hlsRef.current = null }
  }, [])

  useEffect(() => {
    if (!video.is_scraped) return
    const url = video.video_url || video.source_url
    if (!url) return
    const initHls = (u: string) => {
      const el = videoRef.current
      if (!el || !window.Hls?.isSupported()) return
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      const hls = new window.Hls({ enableWorker: true })
      hlsRef.current = hls
      hls.loadSource(`/api/video/proxy?url=${encodeURIComponent(u)}`)
      hls.attachMedia(el)
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}))
    }
    if (window.Hls) { setTimeout(() => initHls(url), 100); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js'
    s.onload = () => setTimeout(() => initHls(url), 100)
    document.head.appendChild(s)
  }, [video])

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
        <div className="aspect-video bg-black">
          {video.is_scraped
            ? <video ref={videoRef} controls muted className="w-full h-full object-contain" crossOrigin="anonymous" />
            : <video controls autoPlay className="w-full h-full object-contain" src={`/api/video/stream/${video.id}`} />
          }
        </div>
      </div>
    </div>
  )
}
