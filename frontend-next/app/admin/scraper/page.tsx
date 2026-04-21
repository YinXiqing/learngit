'use client'
'use client'
import { RequireAdmin } from '@/components/AuthGuard'
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '@/lib/api'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { ScrapedVideo } from '@/types'

type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

const dlLabel: Record<string, { text: string; cls: string }> = {
  none:        { text: '未下载', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  downloading: { text: '下载中', cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  done:        { text: '已下载', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  failed:      { text: '失败',   cls: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
}

export default function AdminScraper() {
  const [url, setUrl] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [videos, setVideos] = useState<ScrapedVideo[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [previewVideo, setPreviewVideo] = useState<ScrapedVideo | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [tab, setTab] = useState<'pending' | 'published'>('pending')
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const pollingRef = useRef<Record<number, ReturnType<typeof setInterval>>>({})

  const toggleSelect = (id: number) => setSelected(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s
  })
  const toggleSelectAll = (ids: number[]) => setSelected(prev =>
    ids.every(id => prev.has(id)) ? new Set() : new Set(ids)
  )

  const handleBulkDownload = async (ids: number[]) => {
    setBulkLoading(true)
    try {
      const res = await api.post('/admin/scraped/batch-download', { video_ids: ids })
      showToast(res.data.message)
      fetchList(); setSelected(new Set())
    } catch (e: any) { showToast(e.response?.data?.detail || '批量下载失败', 'error') }
    finally { setBulkLoading(false) }
  }

  const handleBulkPublish = async (ids: number[]) => {
    setBulkLoading(true)
    try {
      const res = await api.post('/admin/scraped/batch-publish', { video_ids: ids })
      showToast(res.data.message); fetchList(); setSelected(new Set())
    } catch (e: any) { showToast(e.response?.data?.detail || '批量发布失败', 'error') }
    finally { setBulkLoading(false) }
  }

  const handleBulkDelete = (ids: number[]) => setConfirm({
    isOpen: true, type: 'danger', title: '批量删除', message: `确定删除选中的 ${ids.length} 条记录？`,
    onConfirm: async () => {
      try {
        await api.post('/admin/scraped/batch-delete', { video_ids: ids })
        showToast('已删除'); fetchList(); setSelected(new Set())
      } catch { showToast('删除失败', 'error') }
      setConfirm({ isOpen: false })
    }
  })

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const fetchList = useCallback(async () => {
    try { const res = await api.get('/admin/scraped?status=all&per_page=50'); setVideos(res.data.scraped_videos) } catch {}
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  const startPolling = (id: number) => {
    if (pollingRef.current[id]) return
    pollingRef.current[id] = setInterval(async () => {
      try {
        const res = await api.get(`/admin/scraped/${id}/progress`)
        const { download_status, download_progress, local_filename } = res.data
        setVideos(prev => prev.map(v => v.id === id ? { ...v, download_status, download_progress, local_filename } : v))
        if (download_status !== 'downloading') {
          clearInterval(pollingRef.current[id]); delete pollingRef.current[id]
          if (download_status === 'done') showToast('下载完成，可以发布了')
          if (download_status === 'failed') showToast('下载失败', 'error')
        }
      } catch {}
    }, 2000)
  }

  useEffect(() => {
    videos.filter(v => v.download_status === 'downloading').forEach(v => startPolling(v.id))
    return () => { Object.values(pollingRef.current).forEach(clearInterval) }
  }, [videos.length])

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault(); setScraping(true)
    try {
      if (batchMode) {
        const res = await api.post('/admin/scrape/batch', { urls: url.split('\n').map((u: string) => u.trim()).filter(Boolean) })
        showToast(res.data.message)
      } else {
        await api.post('/admin/scrape', { url }); showToast('抓取成功，请点击下载')
      }
      setUrl(''); fetchList()
    } catch (e: any) { showToast(e.response?.data?.detail || '抓取失败', 'error') }
    finally { setScraping(false) }
  }

  const handleDownload = async (v: ScrapedVideo) => {
    try {
      await api.post(`/admin/scraped/${v.id}/download`)
      setVideos(prev => prev.map(x => x.id === v.id ? { ...x, download_status: 'downloading', download_progress: 0 } : x))
      startPolling(v.id)
    } catch (e: any) { showToast(e.response?.data?.detail || '启动下载失败', 'error') }
  }

  const handlePublish = async (v: ScrapedVideo) => {
    try { await api.post(`/admin/scraped/${v.id}/import`, {}); showToast('发布成功'); fetchList() }
    catch (e: any) { showToast(e.response?.data?.detail || '发布失败', 'error') }
  }


  const handleDelete = (id: number) => setConfirm({
    isOpen: true, type: 'danger', title: '删除记录', message: '确定要删除这条抓取记录吗？',
    onConfirm: async () => {
      try { await api.delete(`/admin/scraped/${id}`); showToast('已删除'); fetchList() }
      catch { showToast('删除失败', 'error') }
      setConfirm({ isOpen: false })
    }
  })

  const handleEditTitle = async (id: number) => {
    try {
      await api.put(`/admin/scraped/${id}`, { title: editingTitle })
      setVideos(prev => prev.map(v => v.id === id ? { ...v, title: editingTitle } : v))
      setEditingId(null)
    } catch { showToast('编辑失败', 'error') }
  }

  const closePreview = () => { hlsRef.current?.destroy(); hlsRef.current = null; setPreviewVideo(null) }

  useEffect(() => {
    if (!previewVideo || !videoRef.current) return
    const video = videoRef.current
    let playUrl = ''
    if (previewVideo.status === 'published' && previewVideo.video_id) {
      playUrl = `/api/video/hls/${previewVideo.video_id}/index.m3u8`
    } else if (previewVideo.download_status === 'done') {
      playUrl = `/uploads/hls/${previewVideo.id}/index.m3u8`
    } else if (previewVideo.is_m3u8 && previewVideo.video_url) {
      playUrl = `/api/admin/proxy?url=${encodeURIComponent(previewVideo.video_url)}`
    }
    if (!playUrl) return undefined
    let hls: any = null
    import('hls.js').then(({ default: Hls }) => {
      if (Hls.isSupported()) {
        hls = new Hls(); hlsRef.current = hls
        hls.loadSource(playUrl); hls.attachMedia(video); video.play().catch(() => {})
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playUrl; video.play().catch(() => {})
      }
    })
    return () => { hls?.destroy(); hlsRef.current = null }
  }, [previewVideo])

  const pending = videos.filter(v => v.status === 'pending')
  const published = videos.filter(v => v.status === 'published')

  return (
    <RequireAdmin>
      <div className="p-6 lg:p-8 max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">视频抓取</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">抓取 → 下载到本地 → 发布到首页</p>

        {/* 抓取表单 */}
        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm p-5 mb-6">
          <form onSubmit={handleScrape} className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {batchMode ? '批量 URL（每行一个，最多 20 个）' : '视频页面 URL'}
              </label>
              <button type="button" onClick={() => { setBatchMode(!batchMode); setUrl('') }}
                className="text-xs text-primary-600 hover:underline">
                {batchMode ? '切换单条' : '切换批量'}
              </button>
            </div>
            {batchMode
              ? <textarea value={url} onChange={e => setUrl(e.target.value)} rows={4}
                  placeholder={"https://example.com/video/1\nhttps://example.com/video/2"}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100" required />
              : <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100" required />
            }
            <button type="submit" disabled={scraping}
              className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {scraping ? '抓取中...' : batchMode ? '批量抓取' : '开始抓取'}
            </button>
          </form>
        </div>

        {/* 列表标签页 */}
        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden">
          {/* Tab 头 */}
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            <button onClick={() => setTab('pending')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'pending' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              待处理 ({pending.length})
            </button>
            <button onClick={() => setTab('published')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'published' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
              已发布 ({published.length})
            </button>
          </div>

          {tab === 'pending' && (
            <>
              {/* 批量操作栏 */}
              {pending.length > 0 && (
                <div className="px-5 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 flex-wrap">
                  <input type="checkbox" className="rounded"
                    checked={pending.every(v => selected.has(v.id))}
                    onChange={() => toggleSelectAll(pending.map(v => v.id))} />
                  <span className="text-xs text-gray-400 flex-1">{selected.size > 0 ? `已选 ${selected.size} 项` : '全选'}</span>
                  {selected.size > 0 && (
                    <div className="flex gap-2">
                      <button disabled={bulkLoading} onClick={() => handleBulkDownload([...selected])}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">批量下载</button>
                      <button disabled={bulkLoading} onClick={() => handleBulkPublish([...selected])}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">批量发布</button>
                      <button disabled={bulkLoading} onClick={() => handleBulkDelete([...selected])}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">批量删除</button>
                    </div>
                  )}
                </div>
              )}
              {pending.length === 0
                ? <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">暂无待处理记录</p>
                : <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pending.map(v => (
                      <div key={v.id} className="px-5 py-4 flex items-start gap-4">
                        <input type="checkbox" className="mt-1 rounded shrink-0"
                          checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} />
                        <div className="w-24 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-900 cursor-pointer"
                          onClick={() => setPreviewVideo(v)}>
                          {v.cover_url
                            ? <img src={v.cover_url.startsWith('http') ? v.cover_url : `/uploads/${v.cover_url}`} alt=""
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingId === v.id
                            ? <div className="flex gap-2 items-center mb-1">
                                <input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleEditTitle(v.id); if (e.key === 'Escape') setEditingId(null) }}
                                  className="flex-1 border border-primary-400 rounded px-2 py-0.5 text-sm focus:outline-none dark:bg-[#2a2a2a] dark:text-gray-100" />
                                <button onClick={() => handleEditTitle(v.id)} className="text-xs text-green-600 hover:underline">保存</button>
                                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">取消</button>
                              </div>
                            : <div className="flex items-center gap-1 group/t mb-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.title || '未命名'}</p>
                                <button onClick={() => { setEditingId(v.id); setEditingTitle(v.title ?? '') }}
                                  className="opacity-0 group-hover/t:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              </div>
                          }
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mb-2">
                            {(() => { try { return new URL(v.source_url).hostname } catch { return v.source_url } })()}
                            {v.duration ? ` · ${String(Math.floor(v.duration/60)).padStart(2,'0')}:${String(v.duration%60).padStart(2,'0')}` : ''}
                          </p>
                          {v.download_status === 'downloading' && (
                            <div>
                              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <span>下载中...</span><span>{v.download_progress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div className="bg-primary-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${v.download_progress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5 flex-wrap justify-end">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${dlLabel[v.download_status]?.cls}`}>
                            {dlLabel[v.download_status]?.text}
                          </span>
                          {(v.download_status === 'none' || v.download_status === 'failed') && (
                            <button onClick={() => handleDownload(v)}
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
                              {v.download_status === 'failed' ? '重试' : '下载'}
                            </button>
                          )}
                          <button onClick={() => handlePublish(v)} disabled={v.download_status !== 'done'}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            发布
                          </button>
                          <button onClick={() => handleDelete(v.id)}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors">
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </>
          )}

          {tab === 'published' && (
            <>
              {published.length === 0
                ? <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">暂无已发布记录</p>
                : <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {published.map(v => (
                      <div key={v.id} className="px-5 py-3 flex items-center gap-4">
                        <div className="w-20 h-12 shrink-0 rounded overflow-hidden bg-gray-900 cursor-pointer"
                          onClick={() => setPreviewVideo(v)}>
                          {v.cover_url
                            ? <img src={v.cover_url.startsWith('http') ? v.cover_url : `/uploads/${v.cover_url}`} alt=""
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{v.title || '未命名'}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {v.scraped_at ? new Date(v.scraped_at).toLocaleString() : ''}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium shrink-0">已发布</span>
                      </div>
                    ))}
                  </div>
              }
            </>
          )}
        </div>
      </div>

      {/* 预览弹窗 */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-[#111] rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1a1a]">
              <span className="text-white text-sm font-medium truncate">{previewVideo.title || '视频预览'}</span>
              <button onClick={closePreview} className="text-gray-400 hover:text-white transition-colors shrink-0 ml-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-black aspect-video">
              {(previewVideo.download_status === 'none' && !previewVideo.is_m3u8)
                ? <div className="w-full h-full relative flex flex-col items-center justify-center gap-2">
                    {previewVideo.cover_url
                      ? <img src={previewVideo.cover_url} alt="" className="absolute inset-0 w-full h-full object-contain opacity-40" />
                      : null}
                    <span className="relative text-white/70 text-sm z-10">该视频格式特殊，需下载完成后可在此预览</span>
                  </div>
                : <video ref={videoRef} controls className="w-full h-full" />
              }
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })}
        onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message}
        type={confirm.type} confirmText="确认" cancelText="取消" />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </RequireAdmin>
  )
}
