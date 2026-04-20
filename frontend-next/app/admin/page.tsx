'use client'
import { RequireAdmin } from '@/components/AuthGuard'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import type { Video } from '@/types'

interface Stats {
  total_users: number
  total_videos: number
  pending_videos: number
  approved_videos: number
  total_views: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ total_users: 0, total_videos: 0, pending_videos: 0, approved_videos: 0, total_views: 0 })
  const [recentVideos, setRecentVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats').then(r => setStats(r.data)),
      api.get('/admin/videos', { params: { status: 'pending', per_page: 5 } }).then(r => setRecentVideos(r.data.videos)),
    ]).finally(() => setLoading(false))
  }, [])

  const cards = [
    { title: '总用户数', value: stats.total_users, href: '/admin/users', color: 'bg-blue-100', iconColor: 'text-blue-600' },
    { title: '总视频数', value: stats.total_videos, href: '/admin/videos', color: 'bg-green-100', iconColor: 'text-green-600' },
    { title: '待审核视频', value: stats.pending_videos, href: '/admin/videos?status=pending', color: 'bg-yellow-100', iconColor: 'text-yellow-600' },
    { title: '已通过视频', value: stats.approved_videos, href: '/admin/videos?status=approved', color: 'bg-purple-100', iconColor: 'text-purple-600' },
    { title: '总播放量', value: stats.total_views, href: '/admin/videos', color: 'bg-red-100', iconColor: 'text-red-600' },
  ]

  return (
    <RequireAdmin>
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8"><h1 className="text-2xl font-bold text-gray-900">管理后台</h1><p className="text-gray-600 mt-1">平台数据概览和管理</p></div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {cards.map(c => (
            <Link key={c.title} href={c.href} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow flex items-center">
              <div className={`w-12 h-12 ${c.color} rounded-lg flex items-center justify-center mr-4 flex-shrink-0`}>
                <svg className={`w-6 h-6 ${c.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div><p className="text-sm text-gray-500">{c.title}</p><p className="text-2xl font-bold text-gray-900">{loading ? '-' : c.value.toLocaleString()}</p></div>
            </Link>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { href: '/admin/scraper', label: '视频抓取', desc: '从外部网站抓取视频', color: 'hover:border-primary-500 hover:bg-primary-50', iconBg: 'bg-primary-100', iconColor: 'text-primary-600' },
              { href: '/admin/videos?status=pending', label: '审核视频', desc: '审核待处理视频', color: 'hover:border-yellow-500 hover:bg-yellow-50', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
              { href: '/admin/users', label: '用户管理', desc: '管理用户账户', color: 'hover:border-blue-500 hover:bg-blue-50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
            ].map(item => (
              <Link key={item.href} href={item.href} className={`flex items-center p-4 border border-gray-200 rounded-lg transition-colors ${item.color}`}>
                <div className={`w-10 h-10 ${item.iconBg} rounded-lg flex items-center justify-center mr-3`}>
                  <svg className={`w-5 h-5 ${item.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div><p className="font-medium text-gray-900">{item.label}</p><p className="text-sm text-gray-500">{item.desc}</p></div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">待审核视频</h2>
            <Link href="/admin/videos?status=pending" className="text-primary-600 hover:text-primary-700 text-sm">查看全部 →</Link>
          </div>
          {recentVideos.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentVideos.map(v => (
                <div key={v.id} className="py-4 flex items-center space-x-4">
                  <div className="w-24 h-16 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                    {v.cover_image
                      ? <img src={v.is_scraped && v.cover_image?.startsWith('http') ? v.cover_image : `/api/video/cover/${v.id}`} alt={v.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{v.title}</p>
                    <p className="text-sm text-gray-500">{v.author} • {new Date(v.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link href="/admin/videos?status=pending" className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full hover:bg-yellow-200">审核</Link>
                </div>
              ))}
            </div>
          ) : <p className="text-gray-500 text-center py-4">暂无待审核视频</p>}
        </div>
      </div>
    </div>
    </RequireAdmin>
  )
}
