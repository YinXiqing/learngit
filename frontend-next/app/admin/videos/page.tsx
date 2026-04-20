'use client'
import { RequireAdmin } from '@/components/AuthGuard'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import ConfirmDialog from '@/components/ConfirmDialog'
import VideoPreviewModal from '@/components/VideoPreviewModal'
import type { Video } from '@/types'

const dur = (s: number | null) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'

function statusBadge(s: string) {
  const map: Record<string, [string, string]> = {
    pending: ['bg-yellow-100 text-yellow-800', '待审核'],
    approved: ['bg-green-100 text-green-800', '已通过'],
    rejected: ['bg-red-100 text-red-800', '已拒绝'],
  }
  const [cls, label] = map[s] ?? ['bg-gray-100 text-gray-800', s]
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${cls}`}>{label}</span>
}

type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

function AdminVideosInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const statusFilter = searchParams.get('status') ?? 'all'
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [editing, setEditing] = useState<Video | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })
  const [preview, setPreview] = useState<Video | null>(null)

  useEffect(() => { fetchVideos() }, [statusFilter, page, search])

  const fetchVideos = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/videos', { params: { status: statusFilter, page, per_page: 20, search } })
      setVideos(res.data.videos); setTotalPages(res.data.pages); setSelected([])
    } catch {} finally { setLoading(false) }
  }

  const bulkUpdate = async (status: string, ids?: number[]) => {
    const toUpdate = ids ?? selected
    if (!toUpdate.length) return
    await api.post('/admin/videos/bulk-update', { video_ids: toUpdate, status })
    fetchVideos()
  }

  const deleteVideo = (id: number) => setConfirm({ isOpen: true, type: 'danger', title: '删除视频', message: '确定要删除这个视频吗？', onConfirm: async () => {
    await api.delete(`/admin/videos/${id}`); fetchVideos(); setConfirm({ isOpen: false })
  }})

  const bulkDelete = () => {
    if (!selected.length) return
    setConfirm({ isOpen: true, type: 'danger', title: '批量删除', message: `确定要删除 ${selected.length} 个视频吗？`, onConfirm: async () => {
      await api.post('/admin/videos/bulk-delete', { video_ids: selected }); fetchVideos(); setConfirm({ isOpen: false })
    }})
  }

  const saveEdit = async () => {
    if (!editing) return
    await api.put(`/admin/videos/${editing.id}`, { title: editing.title, description: editing.description, status: editing.status })
    setEditing(null); fetchVideos()
  }

  const tabs = ['all', 'pending', 'approved', 'rejected']
  const tabLabels: Record<string, string> = { all: '全部', pending: '待审核', approved: '已通过', rejected: '已拒绝' }

  return (
    <RequireAdmin>
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">视频管理</h1><p className="text-gray-600 mt-1">管理平台所有视频内容</p></div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex space-x-1">
              {tabs.map(t => (
                <button key={t} onClick={() => { router.push(`/admin/videos?status=${t}`); setPage(1) }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === t ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {tabLabels[t]}
                </button>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); setPage(1); fetchVideos() }} className="flex space-x-2">
              <input type="text" placeholder="搜索视频标题、作者..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <button type="submit" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">搜索</button>
              {videos.length > 0 && (
                <button type="button" onClick={() => setSelected(selected.length === videos.length ? [] : videos.map(v => v.id))}
                  className="bg-primary-100 text-primary-700 px-4 py-2 rounded-lg text-sm hover:bg-primary-200">
                  {selected.length === videos.length ? '取消全选' : '全选'}
                </button>
              )}
            </form>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-primary-800 font-medium">已选择 {selected.length} 个视频</span>
            <div className="flex space-x-2">
              <button onClick={() => bulkUpdate('approved')} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">批量通过</button>
              <button onClick={() => bulkUpdate('rejected')} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700">批量拒绝</button>
              <button onClick={bulkDelete} className="bg-gray-600 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700">批量删除</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="flex items-center space-x-4 animate-pulse"><div className="w-24 h-16 bg-gray-200 rounded" /><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-1/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-1/6" /></div></div>)}</div>
          ) : videos.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {videos.map(v => (
                <div key={v.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1"><input type="checkbox" checked={selected.includes(v.id)} onChange={() => setSelected(prev => prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id])} className="rounded border-gray-300" /></div>
                    <div className="col-span-5 flex items-center space-x-3">
                      <div className="relative w-24 h-16 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => setPreview(v)}>
                          {v.cover_image ? <img src={v.is_scraped && v.cover_image?.startsWith('http') ? v.cover_image : `/api/video/cover/${v.id}`} alt={v.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                          </div>
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">{dur(v.duration)}</div>
                        </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1"><Link href={`/video/${v.id}`} target="_blank" className="hover:text-primary-600">{v.title}</Link></h3>
                        <p className="text-xs text-gray-500 line-clamp-1">{v.description || '暂无简介'}</p>
                      </div>
                    </div>
                    <div className="col-span-2 text-sm text-gray-700">{v.author}</div>
                    <div className="col-span-2">{statusBadge(v.status)}</div>
                    <div className="col-span-2 flex items-center justify-center space-x-1">
                      {v.status === 'pending' && <>
                        <button onClick={() => setConfirm({ isOpen: true, type: 'success', title: '通过审核', message: `确定通过"${v.title}"？`, onConfirm: () => { bulkUpdate('approved', [v.id]); setConfirm({ isOpen: false }) }})} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">通过</button>
                        <button onClick={() => setConfirm({ isOpen: true, type: 'danger', title: '拒绝视频', message: `确定拒绝"${v.title}"？`, onConfirm: () => { bulkUpdate('rejected', [v.id]); setConfirm({ isOpen: false }) }})} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">拒绝</button>
                      </>}
                      <button onClick={() => setPreview(v)} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">预览</button>
                      <button onClick={() => setEditing({...v})} className="p-1 text-gray-400 hover:text-yellow-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => deleteVideo(v.id)} className="p-1 text-gray-400 hover:text-red-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-center py-16 text-gray-500">暂无视频</div>}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center mt-6 space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">上一页</button>
            <span className="px-4 py-2">第 {page} 页，共 {totalPages} 页</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">下一页</button>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-bold mb-4">编辑视频</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">标题</label><input type="text" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">简介</label><textarea value={editing.description ?? ''} onChange={e => setEditing({...editing, description: e.target.value})} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select value={editing.status} onChange={e => setEditing({...editing, status: e.target.value as Video['status']})} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已拒绝</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">保存</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
      {preview && <VideoPreviewModal video={preview} onClose={() => setPreview(null)} />}
    </div>
    </RequireAdmin>
  )
}

export default function AdminVideos() {
  return <Suspense><AdminVideosInner /></Suspense>
}
