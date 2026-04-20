'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast from '@/components/Toast'
import type { Video } from '@/types'

function DownloadButton({ videoId }: { videoId: number }) {
  return (
    <a href={`/api/video/download/${videoId}`}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      下载
    </a>
  )
}

declare global { interface Window { Hls: any } }

const dur = (s: number | null) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'
const fmt = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}K` : String(v)

type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

export default function VideoPlayer({ video: initialVideo }: { video: Video }) {
  const { isAdmin, user } = useAuth()
  const [video, setVideo] = useState<Video>(initialVideo)
  const [isPlaying, setIsPlaying] = useState(true)
  const [videoReady, setVideoReady] = useState(false)
  const [playError, setPlayError] = useState(false)
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchRelated()
    if (user) api.post(`/video/history/${video.id}`).catch(() => {})
    setVideoReady(false)
  }, [video.id])

  useEffect(() => {
    if (!isPlaying) return
    const initHls = (url: string) => {
      const el = videoRef.current
      if (!el || !window.Hls) return
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      if (window.Hls.isSupported()) {
        const hls = new window.Hls({ enableWorker: true })
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(el)
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          const saved = parseFloat(localStorage.getItem(`vp_${video.id}`) ?? '0')
          if (saved > 5) el.currentTime = saved
          el.play().catch(() => {})
          el.ontimeupdate = () => localStorage.setItem(`vp_${video.id}`, String(el.currentTime))
        })
        hls.on(window.Hls.Events.ERROR, (_: any, d: any) => {
          if (d.fatal) {
            hls.destroy(); hlsRef.current = null
            if (video.is_scraped) {
              fetch(`/api/video/refresh-url/${video.id}`).then(r => r.json())
                .then(data => {
                  if (data.video_url) {
                    const proxied = `/api/video/proxy?url=${encodeURIComponent(data.video_url)}`
                    initHls(proxied)
                  } else setPlayError(true)
                })
                .catch(() => setPlayError(true))
            } else { setPlayError(true) }
          }
        })
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = url; el.play().catch(() => {})
      }
    }

    // 调用 stream 接口获取播放地址
    api.get(`/video/stream/${video.id}`)
      .then(({ data }) => {
        if (data.is_external || data.is_hls) {
          const url = data.is_external
            ? `/api/video/proxy?url=${encodeURIComponent(data.video_url)}`
            : data.video_url
          setTimeout(() => initHls(url), 100)
        } else {
          // 纯 MP4
          const el = videoRef.current
          if (el) {
            el.src = data.video_url
            const saved = parseFloat(localStorage.getItem(`vp_${video.id}`) ?? '0')
            el.onloadedmetadata = () => { if (saved > 5) el.currentTime = saved }
            el.ontimeupdate = () => localStorage.setItem(`vp_${video.id}`, String(el.currentTime))
            el.play().catch(() => {})
          }
        }
        setVideoReady(false)
      })
      .catch(() => setPlayError(true))

    return () => { hlsRef.current?.destroy(); hlsRef.current = null }
  }, [isPlaying, video])

  const fetchRelated = useCallback(async () => {
    try {
      const tags = (video.tags || []).filter(Boolean)
      const params: Record<string, any> = { per_page: 8 }
      if (tags.length > 0) params.tag = tags[0]; else params.search = video.title?.slice(0, 10)
      const res = await api.get('/video/list', { params })
      setRelatedVideos(res.data.videos.filter((r: Video) => r.id !== video.id).slice(0, 6))
    } catch { setRelatedVideos([]) }
  }, [video.id, video.tags, video.title])

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
            playError
              ? <div className="w-full h-full flex flex-col items-center justify-center text-white gap-3">
                  <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <p className="text-gray-300 text-sm">视频加载失败</p>
                  <button onClick={() => { setPlayError(false); setIsPlaying(false); setTimeout(() => setIsPlaying(true), 100) }}
                    className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors">重试</button>
                </div>
              : <>
                  <video ref={videoRef} controls={videoReady} className="w-full h-full object-contain" crossOrigin="anonymous"
                    onCanPlay={() => setVideoReady(true)}
                    onTimeUpdate={e => localStorage.setItem(`vp_${video.id}`, String((e.target as HTMLVideoElement).currentTime))}
                    onLoadedMetadata={e => { const s = parseFloat(localStorage.getItem(`vp_${video.id}`) ?? '0'); if (s > 5) (e.target as HTMLVideoElement).currentTime = s }} />
                  {!videoReady && (
                    <div className="absolute inset-0 bg-black flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </>
          ) : (
            <div className="relative w-full h-full">
              {video.cover_image ? <Image src={coverSrc} alt={video.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 66vw" priority /> : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
              <button onClick={() => setIsPlaying(true)} className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group">
                <div className="w-20 h-20 bg-white dark:bg-[#1f1f1f]/90 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform">
                  <svg className="w-10 h-10 text-primary-600 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm mt-6 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{video.title}</h1>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
              <span>{fmt(video.view_count)} 次观看</span><span>•</span>
              <span>{video.created_at.slice(0, 10)}</span><span>•</span>
              <span>{dur(video.duration)}</span>
            </div>
            <DownloadButton videoId={video.id} />
          </div>
          {isAdmin() && video.status === 'pending' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">管理员审核操作</h3>
              <div className="flex space-x-3">
                <button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">通过审核</button>
                <button onClick={handleReject} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">拒绝视频</button>
              </div>
            </div>
          )}
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-medium text-primary-700">{video.author?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{video.author || '未知用户'}</p>
          </div>
          {video.description && <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{video.description}</p>}
          {(video.tags?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {video.tags!.map((tag, i) => <span key={i} className="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 text-sm rounded-full">{tag}</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">相关推荐</h3>
          {relatedVideos.length > 0 ? (
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
              {relatedVideos.map(rv => (
                <Link key={rv.id} href={`/video/${rv.id}`} className="flex space-x-3 group flex-shrink-0 w-64 lg:w-auto">
                  <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 relative">
                    {rv.cover_image
                      ? <Image src={rv.is_scraped && rv.cover_image?.startsWith('http') ? rv.cover_image : `/api/video/cover/${rv.id}`} alt={rv.title} fill className="object-cover" sizes="128px" />
                      : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">{dur(rv.duration)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-primary-600">{rv.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{rv.author}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fmt(rv.view_count)} 次观看</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="text-gray-500 dark:text-gray-400 text-sm">暂无相关推荐视频</p>}
        </div>
      </div>

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
