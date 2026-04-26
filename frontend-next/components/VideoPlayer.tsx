'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import api, { BACKEND_URL } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast from '@/components/Toast'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

const dur = (s: number | null) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'
const fmt = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}K` : String(v)

type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

export default function VideoPlayer({ video: initialVideo }: { video: Video }) {
  const { isAdmin, user } = useAuth()
  const [video, setVideo] = useState<Video>(initialVideo)
  const [playError, setPlayError] = useState<string | false>(false)
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const fetchRelated = useCallback(async () => {
    try {
      const tags = (video.tags || []).filter(Boolean)
      const params: Record<string, any> = { per_page: 8 }
      if (tags.length > 0) params.tag = tags[0]; else params.search = video.title?.slice(0, 10)
      const res = await api.get('/video/list', { params })
      setRelatedVideos(res.data.videos.filter((r: Video) => r.id !== video.id).slice(0, 6))
    } catch { setRelatedVideos([]) }
  }, [video.id, video.tags, video.title])

  useEffect(() => {
    window.scrollTo(0, 0)
    fetchRelated()
    if (user) api.post(`/video/history/${video.id}`).catch(() => {})
    setPlayError(false)

    const el = videoRef.current
    if (!el) return

    const restoreProgress = () => {
      const saved = parseFloat(localStorage.getItem(`vp_${video.id}`) ?? '0')
      if (saved > 5) el.currentTime = saved
    }

    api.get(`/video/stream/${video.id}`)
      .then(({ data }) => {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

        if (data.is_hls) {
          const url = data.video_url

          if (window.Hls?.isSupported()) {
            const hls = new window.Hls({ enableWorker: true })
            hlsRef.current = hls
            hls.loadSource(url)
            hls.attachMedia(el)
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              restoreProgress()
              el.play().catch(() => {})
            })
            hls.on(window.Hls.Events.ERROR, (_: any, d: any) => { if (d.fatal) setPlayError('error') })
          } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
            el.src = url
            el.onloadedmetadata = restoreProgress
          }
        } else {
          el.src = data.video_url
          el.onloadedmetadata = restoreProgress
          el.play().catch(() => {})
        }
      })
      .catch((e) => { setPlayError(e?.response?.status === 503 ? 'processing' : 'error') })

    const saveProgress = () => localStorage.setItem(`vp_${video.id}`, String(el.currentTime))
    let lastSave = 0
    const throttledSave = () => {
      const now = Date.now()
      if (now - lastSave >= 5000) { lastSave = now; saveProgress() }
    }
    el.addEventListener('timeupdate', throttledSave)
    return () => {
      el.removeEventListener('timeupdate', throttledSave)
      hlsRef.current?.destroy(); hlsRef.current = null
    }
  }, [video.id])

  const handleApprove = () => setConfirm({ isOpen: true, type: 'info', title: '审核通过', message: '确定要通过这个视频的审核吗？', onConfirm: async () => {
    try { await api.put(`/admin/videos/${video.id}`, { status: 'approved' }); setVideo({...video, status: 'approved'}); showToast('视频已通过审核 ✓') } catch { showToast('操作失败', 'error') }
    setConfirm({ isOpen: false })
  }})

  const handleReject = () => setConfirm({ isOpen: true, type: 'danger', title: '拒绝视频', message: '确定要拒绝这个视频吗？', onConfirm: async () => {
    try { await api.put(`/admin/videos/${video.id}`, { status: 'rejected' }); setVideo({...video, status: 'rejected'}); showToast('视频已拒绝', 'error') } catch { showToast('操作失败', 'error') }
    setConfirm({ isOpen: false })
  }})

  const coverSrc = `/api/video/cover/${video.id}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 sm:gap-6">
      <div>
        <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
          {playError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-white gap-3">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              <p className="text-gray-300 text-sm">{playError === 'processing' ? '视频正在处理中' : '视频加载失败'}</p>
              <button onClick={() => { setPlayError(false); setVideo({...video}) }}
                className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors">重试</button>
            </div>
          ) : (
            <video ref={videoRef} controls muted className="w-full h-full object-contain" crossOrigin="anonymous"
              poster={video.cover_image ? coverSrc : undefined} />
          )}
        </div>

        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm mt-4 p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{video.title}</h1>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-3">
              <span>{fmt(video.view_count)} 次观看</span><span>•</span>
              <span>{video.created_at.slice(0, 10)}</span><span>•</span>
              <span>{dur(video.duration)}</span>
            </div>
            {user ? (
              <a href={`${BACKEND_URL}/api/video/download/${video.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                下载
              </a>
            ) : (
              <a href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                下载
              </a>
            )}
          </div>

          {isAdmin() && video.status === 'pending' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">管理员审核操作</p>
              <div className="flex gap-3">
                <button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">通过审核</button>
                <button onClick={handleReject} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">拒绝视频</button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-lg font-medium text-primary-700">{video.author?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{video.author || '未知用户'}</p>
          </div>

          {video.description && <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap text-sm">{video.description}</p>}
          {(video.tags?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {video.tags!.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 text-sm rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">相关推荐</h3>
          {relatedVideos.length > 0 ? (
            <div className="relative">
              <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
                {relatedVideos.map(rv => (
                  <Link key={rv.id} href={`/video/${rv.id}`} className="flex gap-3 group flex-shrink-0 w-64 lg:w-auto">
                    <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 relative bg-gray-900">
                      {rv.cover_image
                        ? <Image src={rv.is_scraped && rv.cover_image?.startsWith('http') ? rv.cover_image : `/api/video/cover/${rv.id}`}
                            alt={rv.title} fill className="object-cover" sizes="128px" />
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
              <div className="lg:hidden absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-white dark:from-[#1f1f1f] to-transparent pointer-events-none" />
            </div>
          ) : <p className="text-gray-500 dark:text-gray-400 text-sm">暂无相关推荐视频</p>}
        </div>
      </div>

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm}
        title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
