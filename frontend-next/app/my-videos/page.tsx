'use client'
import { RequireAuth } from '@/components/AuthGuard'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import api from '@/lib/api'
import ConfirmDialog from '@/components/ConfirmDialog'
import VideoPreviewModal from '@/components/VideoPreviewModal'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

const dur = (s: number | null) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'
const fmt = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}K` : String(v)

function statusBadge(s: string) {
  const map: Record<string, [string, string]> = {
    pending: ['bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300', '审核中'],
    approved: ['bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300', '已通过'],
    rejected: ['bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300', '已拒绝'],
  }
  const [cls, label] = map[s] ?? ['bg-gray-100 dark:bg-[#2a2a2a] text-gray-800 dark:text-gray-200', s]
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${cls}`}>{label}</span>
}

type EditingVideo = Video & { tags: string[] }
type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

export default function MyVideos() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [editing, setEditing] = useState<EditingVideo | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })
  const [preview, setPreview] = useState<Video | null>(null)

  useEffect(() => { fetchVideos() }, [])

  const fetchVideos = async () => {
    try { const res = await api.get('/video/my-videos'); setVideos(res.data.videos) }
    catch {} finally { setLoading(false) }
  }

  const deleteVideo = (id: number) => setConfirm({ isOpen: true, type: 'danger', title: '删除视频', message: '确定要删除这个视频吗？此操作不可撤销。', onConfirm: async () => {
    try { await api.delete(`/video/my-videos/${id}/delete`); fetchVideos() } catch {}
    setConfirm({ isOpen: false })
  }})

  const saveEdit = () => setConfirm({ isOpen: true, type: 'info', title: '保存视频信息', message: '确定要保存修改吗？', onConfirm: async () => {
    if (!editing) return
    try { await api.put(`/video/my-videos/${editing.id}/edit`, { title: editing.title, description: editing.description, tags: editing.tags }); setEditing(null); fetchVideos() } catch {}
    setConfirm({ isOpen: false })
  }})

  const tabs = [
    { id: 'all', label: '全部', count: videos.length },
    { id: 'approved', label: '已通过', count: videos.filter(v => v.status === 'approved').length },
    { id: 'pending', label: '审核中', count: videos.filter(v => v.status === 'pending').length },
    { id: 'rejected', label: '已拒绝', count: videos.filter(v => v.status === 'rejected').length },
  ]
  const filtered = activeTab === 'all' ? videos : videos.filter(v => v.status === activeTab)

  return (
    <RequireAuth>
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">我的视频</h1><p className="text-gray-600 dark:text-gray-400 mt-1">管理您上传的视频内容</p></div>
          <Link href="/upload" className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span>上传视频</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-[#1f1f1f] rounded-t-xl shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'}`}>
                {t.label} <span className="ml-2 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 py-0.5 px-2 rounded-full text-xs">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f1f1f] rounded-b-xl shadow-sm">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(3)].map((_, i) => <div key={i} className="flex items-center space-x-4 animate-pulse"><div className="w-40 h-24 bg-gray-200 dark:bg-[#333] rounded-lg" /><div className="flex-1"><div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-1/3 mb-2" /><div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-1/4" /></div></div>)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map(v => (
                <div key={v.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-6 flex items-center space-x-4">
                      <div className="relative w-32 h-20 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => setPreview(v)}>
                          {v.cover_image
                            ? <Image src={v.is_scraped && v.cover_image?.startsWith('http') ? v.cover_image : `/api/video/cover/${v.id}`} alt={v.title} fill className="object-cover" sizes="128px" />
                            : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{dur(v.duration)}</div>
                        </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2"><Link href={`/video/${v.id}`} className="hover:text-primary-600">{v.title}</Link></h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{v.description || '暂无简介'}</p>
                      </div>
                    </div>
                    <div className="col-span-2">{statusBadge(v.status)}</div>
                    <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <div>{fmt(v.view_count)} 次观看</div>
                      <div>{new Date(v.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="col-span-2 flex items-center justify-center space-x-2">
                      <button onClick={() => setPreview(v)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">预览</button>
                      <button onClick={() => setEditing({...v, tags: v.tags ?? []})} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => deleteVideo(v.id)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">暂无视频</h3>
              {activeTab === 'all' && <Link href="/upload" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">上传视频</Link>}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">编辑视频信息</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label><input type="text" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">简介</label><textarea value={editing.description ?? ''} onChange={e => setEditing({...editing, description: e.target.value})} rows={4} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标签</label><input type="text" value={editing.tags.join(', ')} onChange={e => setEditing({...editing, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})} placeholder="用逗号分隔" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400" /></div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">取消</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">保存</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
      {preview && <VideoPreviewModal video={preview} onClose={() => setPreview(null)} />}
    </div>
    </RequireAuth>
  )
}
