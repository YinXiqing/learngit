'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'

export default function NotificationBell() {
  const { user, isAdmin } = useAuth()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        if (isAdmin()) {
          const res = await api.get('/video/list?status=pending')
          setCount(res.data.total ?? 0)
        } else {
          const res = await api.get('/video/my-videos')
          setCount((res.data.videos ?? []).filter((v: { status: string }) => v.status === 'rejected').length)
        }
      } catch {}
    })()
  }, [user])

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="relative p-2 text-gray-600 hover:text-gray-900">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{count}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4">
            <p className="font-medium text-gray-900 mb-1">{isAdmin() ? '待审核视频' : '审核未通过'}</p>
            <p className="text-sm text-gray-500 mb-3">共 {count} 个</p>
            {count > 0 && (
              <Link href={isAdmin() ? '/admin/videos' : '/my-videos'} onClick={() => setOpen(false)}
                className="block w-full bg-primary-600 text-white text-center py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm">
                {isAdmin() ? '立即审核' : '查看我的视频'}
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
