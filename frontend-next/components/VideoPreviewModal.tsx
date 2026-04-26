'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

interface Props {
  video: Video
  onClose: () => void
  actions?: React.ReactNode  // 底部自定义按钮
}

export default function VideoPreviewModal({ video, onClose, actions }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const initHls = (url: string) => {
      if (window.Hls?.isSupported()) {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
        const hls = new window.Hls({ enableWorker: true })
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(el)
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}))
        hls.on(window.Hls.Events.ERROR, (_: any, d: any) => { if (d.fatal) setError(true) })
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = url; el.play().catch(() => {})
      }
    }

    api.get(`/video/stream/${video.id}`)
      .then(({ data }) => {
        if (data.is_external) {
          initHls(`/api/video/proxy?url=${encodeURIComponent(data.video_url)}&referer=${encodeURIComponent(video.page_url || '')}`)
        } else if (data.is_hls) {
          initHls(data.video_url)
        } else {
          el.src = data.video_url
          el.play().catch(() => {})
        }
      })
      .catch(() => setError(true))

    return () => { hlsRef.current?.destroy(); hlsRef.current = null }
  }, [video.id])

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111] rounded-xl overflow-hidden w-full max-w-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1a1a]">
          <span className="text-white text-sm font-medium truncate">{video.title}</span>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <Link href={`/video/${video.id}`} target="_blank"
              className="text-gray-400 hover:text-white text-xs transition-colors">
              详情页 →
            </Link>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 播放区 */}
        <div className="aspect-video bg-black flex items-center justify-center">
          {error
            ? <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">视频加载失败</p>
                <button onClick={() => { setError(false) }} className="text-xs text-primary-400 hover:underline">重试</button>
              </div>
            : <video ref={videoRef} controls muted className="w-full h-full object-contain" crossOrigin="anonymous" />
          }
        </div>

        {/* 底部 actions（可选） */}
        {actions && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#1a1a1a] border-t border-white/5">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
