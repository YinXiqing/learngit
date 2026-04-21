'use client'
import { RequireAdmin } from '@/components/AuthGuard'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { Search, Check, X, Trash2, Pencil, Play } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import ConfirmDialog from '@/components/ConfirmDialog'
import VideoPreviewModal from '@/components/VideoPreviewModal'
import type { Video } from '@/types'

const dur = (s: number | null) => s ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : '00:00'

const statusBadge = (s: string) => {
  const map: Record<string, { variant: 'warning' | 'success' | 'destructive'; label: string }> = {
    pending: { variant: 'warning', label: '待审核' },
    approved: { variant: 'success', label: '已通过' },
    rejected: { variant: 'destructive', label: '已拒绝' },
  }
  const { variant, label } = map[s] ?? { variant: 'default' as any, label: s }
  return <Badge variant={variant}>{label}</Badge>
}

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
]

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

  useEffect(() => { fetchVideos() }, [statusFilter, page])
  useEffect(() => { setPage(1) }, [statusFilter])

  const fetchVideos = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/videos', { params: { status: statusFilter, page, per_page: 20, search } })
      setVideos(res.data.videos); setTotalPages(res.data.pages); setSelected([])
    } catch { } finally { setLoading(false) }
  }

  const bulkUpdate = async (status: string, ids?: number[]) => {
    const toUpdate = ids ?? selected
    if (!toUpdate.length) return
    await api.post('/admin/videos/bulk-update', { video_ids: toUpdate, status })
    fetchVideos()
  }

  const deleteVideo = (id: number) => setConfirm({
    isOpen: true, type: 'danger', title: '删除视频', message: '确定要删除这个视频吗？',
    onConfirm: async () => { await api.delete(`/admin/videos/${id}`); fetchVideos(); setConfirm({ isOpen: false }) }
  })

  const bulkDelete = () => {
    if (!selected.length) return
    setConfirm({
      isOpen: true, type: 'danger', title: '批量删除', message: `确定要删除 ${selected.length} 个视频吗？`,
      onConfirm: async () => { await api.post('/admin/videos/bulk-delete', { video_ids: selected }); fetchVideos(); setConfirm({ isOpen: false }) }
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    await api.put(`/admin/videos/${editing.id}`, { title: editing.title, description: editing.description, status: editing.status })
    setEditing(null); fetchVideos()
  }

  const allSelected = videos.length > 0 && selected.length === videos.length
  const toggleAll = () => setSelected(allSelected ? [] : videos.map(v => v.id))
  const toggleOne = (id: number) => setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  return (
    <RequireAdmin>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">视频管理</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">管理平台所有视频内容</p>
        </div>

        {/* 筛选栏 */}
        <Card className="mb-4">
          <div className="px-4 py-3 flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1 flex-wrap">
              {tabs.map(t => (
                <button key={t.key} onClick={() => router.push(`/admin/videos?status=${t.key}`)}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    statusFilter === t.key ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')}>
                  {t.label}
                </button>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); setPage(1); fetchVideos() }} className="flex gap-2 sm:ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索标题、作者..."
                  className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-48" />
              </div>
              <Button type="submit" variant="outline" size="sm">搜索</Button>
            </form>
          </div>
        </Card>

        {/* 批量操作栏 */}
        {selected.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary-800 dark:text-primary-300 font-medium">已选 {selected.length} 个</span>
            <div className="flex gap-2">
              <Button size="sm" variant="success" onClick={() => bulkUpdate('approved')}>批量通过</Button>
              <Button size="sm" variant="destructive" onClick={() => bulkUpdate('rejected')}>批量拒绝</Button>
              <Button size="sm" variant="outline" onClick={bulkDelete}>批量删除</Button>
            </div>
          </div>
        )}

        {/* 视频列表 */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-24 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">暂无视频</div>
          ) : (
            <>
              {/* 表头 */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <div className="col-span-1"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" /></div>
                <div className="col-span-5">视频</div>
                <div className="col-span-2">作者</div>
                <div className="col-span-2">状态</div>
                <div className="col-span-2 text-center">操作</div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {videos.map(v => (
                  <div key={v.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex md:grid md:grid-cols-12 gap-4 items-center">
                      <div className="hidden md:block col-span-1">
                        <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggleOne(v.id)} className="rounded" />
                      </div>
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="relative w-24 h-14 bg-gray-900 rounded-lg overflow-hidden shrink-0 cursor-pointer group" onClick={() => setPreview(v)}>
                          {v.cover_image
                            ? <Image src={v.is_scraped && v.cover_image?.startsWith('http') ? v.cover_image : `/api/video/cover/${v.id}`} alt={v.title} fill className="object-cover" sizes="96px" />
                            : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-5 h-5 text-white" />
                          </div>
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">{dur(v.duration)}</div>
                        </div>
                        <div className="min-w-0">
                          <Link href={`/video/${v.id}`} target="_blank" className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 line-clamp-1">{v.title}</Link>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{v.description || '暂无简介'}</p>
                        </div>
                      </div>
                      <div className="hidden md:block col-span-2 text-sm text-gray-600 dark:text-gray-400">{v.author}</div>
                      <div className="hidden md:block col-span-2">{statusBadge(v.status)}</div>
                      <div className="col-span-2 flex items-center justify-end md:justify-center gap-1 ml-auto md:ml-0">
                        {v.status === 'pending' && <>
                          <Button size="sm" variant="success" onClick={() => setConfirm({ isOpen: true, type: 'success', title: '通过审核', message: `确定通过"${v.title}"？`, onConfirm: () => { bulkUpdate('approved', [v.id]); setConfirm({ isOpen: false }) } })}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setConfirm({ isOpen: true, type: 'danger', title: '拒绝视频', message: `确定拒绝"${v.title}"？`, onConfirm: () => { bulkUpdate('rejected', [v.id]); setConfirm({ isOpen: false }) } })}>
                            <X className="w-3 h-3" />
                          </Button>
                        </>}
                        <Button size="sm" variant="outline" onClick={() => setEditing({ ...v })}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => deleteVideo(v.id)}><Trash2 className="w-3 h-3 text-red-500" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">第 {page} / {totalPages} 页</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一页</Button>
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">编辑视频</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">简介</label>
                <textarea value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={3}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">状态</label>
                <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as Video['status'] })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="pending">待审核</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已拒绝</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={saveEdit}>保存</Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
      {preview && <VideoPreviewModal video={preview} onClose={() => setPreview(null)} />}
    </RequireAdmin>
  )
}

export default function AdminVideos() {
  return <Suspense><AdminVideosInner /></Suspense>
}
