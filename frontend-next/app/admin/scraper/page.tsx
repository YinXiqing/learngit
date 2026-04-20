'use client'
import { RequireAdmin } from '@/components/AuthGuard'
import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast from '@/components/Toast'
import type { ScrapedVideo } from '@/types'

type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

declare global { interface Window { Hls: any } }

export default function AdminScraper() {
  const [url, setUrl] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [scrapedVideos, setScrapedVideos] = useState<ScrapedVideo[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [previewVideo, setPreviewVideo] = useState<ScrapedVideo | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })
  const [selected, setSelected] = useState<number[]>([])
  const [previewChecking, setPreviewChecking] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)

  useEffect(() => { fetchScraped() }, [])

  useEffect(() => {
    if (success || error) { const t = setTimeout(() => { setSuccess(''); setError('') }, 5000); return () => clearTimeout(t) }
  }, [success, error])

  useEffect(() => {
    if (!previewVideo?.video_url) return
    const proxied = `/api/video/proxy?url=${encodeURIComponent(previewVideo.video_url)}`
    const t = setTimeout(() => {
      const loadHls = (): Promise<any> => new Promise(res => {
        if (window.Hls) return res(window.Hls)
        const s = document.createElement('script')
        s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js'
        s.onload = () => res(window.Hls)
        document.head.appendChild(s)
      })
      loadHls().then(Hls => {
        const el = videoRef.current
        if (!el) return
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true })
          hlsRef.current = hls
          hls.loadSource(proxied)
          hls.attachMedia(el)
          hls.on(Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}))
        } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = proxied; el.play().catch(() => {})
        }
      })
    }, 200)
    return () => { clearTimeout(t); if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
  }, [previewVideo?.id, previewVideo?.video_url])

  const fetchScraped = async () => {
    try { const res = await api.get('/admin/scraped'); setScrapedVideos(res.data.scraped_videos) } catch {}
  }

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('')
    try {
      if (batchMode) {
        const urls = url.split('\n').map(u => u.trim()).filter(Boolean)
        const res = await api.post('/admin/scrape/batch', { urls })
        setSuccess(res.data.message)
      } else {
        const res = await api.post('/admin/scrape', { url })
        setSuccess('抓取成功！')
      }
      setUrl(''); fetchScraped()
    } catch (e: any) { setError(e.response?.data?.detail || '抓取失败，请检查URL') }
    finally { setLoading(false) }  }

  const handlePublish = async (id: number) => {
    try { await api.post(`/admin/scraped/${id}/import`, {}); setSuccess('视频发布成功！'); fetchScraped(); if (previewVideo?.id === id) closePreview() }
    catch (e: any) { setError(e.response?.data?.detail || '发布失败') }
  }

  const handleDelete = (id: number) => setConfirm({ isOpen: true, type: 'danger', title: '删除抓取记录', message: '确定要删除这条抓取记录吗？', onConfirm: async () => {
    try { await api.delete(`/admin/scraped/${id}`); setSuccess('已删除'); fetchScraped(); if (previewVideo?.id === id) closePreview() } catch { setError('删除失败') }
    setConfirm({ isOpen: false })
  }})

  const handleBatchPublish = () => {
    if (!selected.length) return setError('请先选择视频')
    setConfirm({ isOpen: true, type: 'warning', title: '批量发布', message: `确定发布选中的 ${selected.length} 个视频？`, onConfirm: async () => {
      setBatchLoading(true)
      try { const res = await api.post('/admin/scraped/batch-publish', { video_ids: selected }); setSuccess(res.data.message || '批量发布成功'); setSelected([]); fetchScraped() }
      catch { setError('批量发布失败') } finally { setBatchLoading(false) }
      setConfirm({ isOpen: false })
    }})
  }

  const handleBatchDelete = () => {
    if (!selected.length) return setError('请先选择视频')
    setConfirm({ isOpen: true, type: 'danger', title: '批量删除', message: `确定删除选中的 ${selected.length} 条记录？`, onConfirm: async () => {
      setBatchLoading(true)
      try { const res = await api.post('/admin/scraped/batch-delete', { video_ids: selected }); setSuccess(res.data.message || '批量删除成功'); setSelected([]); fetchScraped() }
      catch { setError('批量删除失败') } finally { setBatchLoading(false) }
      setConfirm({ isOpen: false })
    }})
  }

  const handleEditTitle = async (id: number) => {
    try { await api.put(`/admin/scraped/${id}`, { title: editingTitle }); setScrapedVideos(prev => prev.map(v => v.id === id ? { ...v, title: editingTitle } : v)); setEditingId(null) }
    catch { setError('编辑失败') }
  }

  const closePreview = () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } setPreviewVideo(null) }

  const pendingIds = scrapedVideos.filter(v => v.status === 'pending').map(v => v.id)

  return (
    <RequireAdmin>
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">视频抓取</h1><p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">从外部网站抓取视频信息并导入平台</p></div>

        {error && <Toast message={error} type="error" onClose={() => setError('')} />}
        {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}

        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm p-6 mb-6">
          <form onSubmit={handleScrape} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{batchMode ? '批量抓取（每行一个URL，最多20个）' : '视频页面URL'}</label>
              <button type="button" onClick={() => { setBatchMode(!batchMode); setUrl('') }} className="text-xs text-primary-600 hover:underline">
                {batchMode ? '切换单条模式' : '切换批量模式'}
              </button>
            </div>
            {batchMode
              ? <textarea value={url} onChange={e => setUrl(e.target.value)} placeholder={"https://example.com/video/1\nhttps://example.com/video/2"} rows={5} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100 dark:focus:ring-primary-400 text-sm font-mono" required />
              : <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="输入视频页面URL" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100 dark:focus:ring-primary-400 text-sm" required />
            }
            <button type="submit" disabled={loading} className="bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">
              {loading ? '抓取中...' : batchMode ? '批量抓取' : '开始抓取'}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">抓取记录 ({scrapedVideos.length})</h2>
              {pendingIds.length > 0 && (
                <button onClick={() => setSelected(selected.length === pendingIds.length ? [] : pendingIds)} className="text-xs text-primary-600 hover:underline">
                  {selected.length === pendingIds.length ? '取消全选' : '全选待处理'}
                </button>
              )}
            </div>
            {selected.length > 0 && (
              <div className="flex gap-2">
                <button onClick={handleBatchPublish} disabled={batchLoading} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {batchLoading ? '处理中...' : `批量发布 (${selected.length})`}
                </button>
                <button onClick={handleBatchDelete} disabled={batchLoading} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {batchLoading ? '处理中...' : `批量删除 (${selected.length})`}
                </button>
              </div>
            )}
          </div>

          {scrapedVideos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <p>暂无抓取记录</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {scrapedVideos.map(v => (
                <div key={v.id} className="p-4 flex items-center gap-4">
                  {v.status === 'pending' && (
                    <input type="checkbox" checked={selected.includes(v.id)} onChange={() => setSelected(prev => prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id])} className="h-4 w-4 text-primary-600 rounded" />
                  )}
                  <div className="w-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-900 cursor-pointer relative group" style={{ height: '72px' }} onClick={() => setPreviewVideo(v)}>
                    {v.cover_url
                      ? <><img src={v.cover_url} alt={v.title ?? ''} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} /><div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all"><svg className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg></div></>
                      : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingId === v.id ? (
                      <div className="flex gap-2 items-center">
                        <input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditTitle(v.id); if (e.key === 'Escape') setEditingId(null) }} className="flex-1 border border-primary-400 rounded px-2 py-1 text-sm focus:outline-none" />
                        <button onClick={() => handleEditTitle(v.id)} className="text-xs text-green-600 hover:underline">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 dark:text-gray-500 hover:underline">取消</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group/title">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{v.title || '未命名'}</p>
                        <button onClick={() => { setEditingId(v.id); setEditingTitle(v.title ?? '') }} className="opacity-0 group-hover/title:opacity-100 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{v.scraped_at ? new Date(v.scraped_at).toLocaleString() : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${v.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' : v.status === 'published' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400'}`}>
                      {v.status === 'pending' ? '待处理' : v.status === 'published' ? '已发布' : v.status}
                    </span>
                    {v.status === 'pending' && <>
                      <button onClick={() => handlePublish(v.id)} className="px-2.5 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">发布</button>
                      <button onClick={() => handleDelete(v.id)} className="px-2.5 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">删除</button>
                    </>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {previewVideo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white dark:bg-[#1f1f1f] rounded-xl max-w-3xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">{previewVideo.title || '视频预览'}</h3>
              <button onClick={closePreview} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="bg-black aspect-video">
              {previewVideo.video_url
                ? <video ref={videoRef} controls muted className="w-full h-full" crossOrigin="anonymous" />
                : previewVideo.cover_url
                  ? <img src={previewVideo.cover_url} alt={previewVideo.title ?? ''} className="w-full h-full object-contain" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">无视频地址</div>}
            </div>
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">抓取时间：{previewVideo.scraped_at ? new Date(previewVideo.scraped_at).toLocaleString() : ''}</div>
            <div className="px-4 pb-4 flex justify-end gap-2">
              <button onClick={closePreview} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">关闭</button>
              {previewVideo.status === 'pending' && <button onClick={() => handlePublish(previewVideo.id)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">发布视频</button>}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
    </div>
    </RequireAdmin>
  )
}
