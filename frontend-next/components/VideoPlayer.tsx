'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

const dur = (s: number | null) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'
const fmt = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}K` : String(v)

type Toast = { msg: string; type: 'success' | 'error' } | null
type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

export default function VideoPlayer({ video: initialVideo }: { video: Video }) {
  const { isAdmin } = useAuth()
  const [video, setVideo] = useState<Video>(initialVideo)
  const [isPlaying, setIsPlaying] = useState(false)
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([])
  const [toast, setToast] = useState<Toast>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = `${video.title} - 视频平台`
    fetchRelated()
    setIsPlaying(true)
  }, [video.id])

  useEffect(() => {
    if (!isPlaying || !video?.is_scraped) return
    const initHls = (url: string) => {
      const el = videoRef.current
      if (!el || !window.Hls) return
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      const proxied = `/api/video/proxy?url=${encodeURIComponent(url)}`
      if (window.Hls.isSupported()) {
        const hls = new window.Hls({ enableWorker: true })
        hlsRef.current = hls
        hls.loadSource(proxied)
        hls.attachMedia(el)
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          const saved = parseFloat(localStorage.getItem(`vp_${video.id}`) ?? '0')
          if (saved > 5) el.currentTime = saved
          el.play().catch(() => {})
          el.ontimeupdate = () => localStorage.setItem(`vp_${video.id}`, String(el.currentTime))
        })
        hls.on(window.Hls.Events.ERROR, (_: any, d: any) => {
          if (d.fatal) {
            fetch(`/api/video/refresh-url/${video.id}`).then(r => r.json()).then(data => { if (data.video_url) initHls(data.video_url) }).catch(() => {})
          }
        })
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = proxied; el.play().catch(() => {})
      }
    }
    const url = video.video_url || video.source_url
    if (!url) return
    if (window.Hls) {
      const t = setTimeout(() => initHls(url), 100)
      return () => { clearTimeout(t); hlsRef.current?.destroy(); hlsRef.current = null }
    }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js'
    s.onload = () => setTimeout(() => initHls(url), 100)
    document.head.appendChild(s)
    return () => { hlsRef.current?.destroy(); hlsRef.current = null }
  }, [isPlaying, video])

  const fetchRelated = async () => {
    try {
      const tags = (video.tags || []).filter(Boolean)
      const params: Record<string, any> = { per_page: 8 }
      if (tags.length > 0) params.tag = tags[0]; else params.search = video.title?.slice(0, 10)
      const res = await api.get('/video/list', { params })
      setRelatedVideos(res.data.videos.filter((r: Video) => r.id !== video.id).slice(0, 6))
    } catch { setRelatedVideos([]) }
  }

  const handleApprove = () => setConfirm({ isOpen: true, type: 'info', title: '审核通过', message: '确定要通过这个视频的审核吗？', onConfirm: async () => {
    try { await api.put(`/admin/videos/${video.id}`, { status: 'approved' }); setVideo({...video, status: 'approved'}); showToast('视频已通过审核 ✓') } catch { showToast('操作失败', 'error') }
    setConfirm({ isOpen: false })
  }})

  const handleReject = () => setConfirm({ isOpen: true, type: 'danger', title: '拒绝视频', message: '确定要拒绝这个视频吗？', onConfirm: async () => {
    try { await api.put(`/admin/videos/${video.id}`, { status: 'rejected' }); setVideo({...video, status: 'rejected'}); showToast('视频已拒绝', 'error') } catch { showToast('操作失败', 'error') }
    setConfirm({ isOpen: false })
  }})

  const coverSrc = video.is_scraped && video.cover_image?.startsWith('http') ? video.cover_image : `/api/video/cover/${video.id}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
      <div className="lg:col-span-2">
        <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
          {isPlaying ? (
            video.is_scraped
              ? <video ref={videoRef} controls muted className="w-full h-full object-contain" crossOrigin="anonymous" />
              : <video controls autoPlay className="w-full h-full object-contain" src={`/api/video/stream/${video.id}`}
                  onTimeUpdate={e => localStorage.setItem(`vp_${video.id}`, String((e.target as HTMLVideoElement).currentTime))}
                  onLoadedMetadata={e => { const s = parseFloat(localStorage.getItem(`vp_${video.id}`) ?? '0'); if (s > 5) (e.target as HTMLVideoElement).currentTime = s }}>
                  您的浏览器不支持视频播放。
                </video>
          ) : (
            <div className="relative w-full h-full">
              {video.cover_image ? <Image src={coverSrc} alt={video.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 66vw" priority /> : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
              <button onClick={() => setIsPlaying(true)} className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group">
                <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform">
                  <svg className="w-10 h-10 text-primary-600 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{video.title}</h1>
          <div className="flex items-center text-sm text-gray-500 space-x-4 mb-4">
            <span>{fmt(video.view_count)} 次观看</span><span>•</span>
            <span>{video.created_at.slice(0, 10)}</span><span>•</span>
            <span>{dur(video.duration)}</span>
          </div>
          {isAdmin() && video.status === 'pending' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-800 mb-3">管理员审核操作</h3>
              <div className="flex space-x-3">
                <button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">通过审核</button>
                <button onClick={handleReject} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">拒绝视频</button>
              </div>
            </div>
          )}
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-primary-700">{video.author?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <p className="font-medium text-gray-900">{video.author || '未知用户'}</p>
          </div>
          {video.description && <p className="text-gray-600 whitespace-pre-wrap">{video.description}</p>}
          {(video.tags?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {video.tags!.map((tag, i) => <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">{tag}</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">相关推荐</h3>
          {relatedVideos.length > 0 ? (
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {relatedVideos.map(rv => (
                <Link key={rv.id} href={`/video/${rv.id}`} className="flex space-x-3 group flex-shrink-0 w-64 lg:w-auto">
                  <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 relative">
                    {rv.cover_image
                      ? <img src={rv.is_scraped && rv.cover_image?.startsWith('http') ? rv.cover_image : `/api/video/cover/${rv.id}`} alt={rv.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">{dur(rv.duration)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary-600">{rv.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{rv.author}</p>
                    <p className="text-xs text-gray-400 mt-1">{fmt(rv.view_count)} 次观看</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="text-gray-500 text-sm">暂无相关推荐视频</p>}
        </div>
      </div>

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
      {toast && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{toast.msg}</div>}
    </div>
  )
}
