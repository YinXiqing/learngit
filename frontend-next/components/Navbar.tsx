'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import NotificationBell from './NotificationBell'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState('')

  useEffect(() => {
    if (pathname === '/search') setQ(searchParams.get('search') || '')
  }, [pathname, searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/search?search=${encodeURIComponent(q.trim())}`)
  }

  const handleLogout = () => { logout(); router.push('/') }

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center h-14">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0 z-10">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
              </div>
              <span className="hidden sm:block text-base font-bold text-gray-900">视频平台</span>
            </Link>

            {/* 搜索栏居中 */}
            <form onSubmit={handleSearch} className="absolute left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
              <div className="relative">
                <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="搜索视频、作者..."
                  className="w-full pl-4 pr-9 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 focus:bg-white transition-all" />
                <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>

            {/* 右侧 */}
            <div className="flex items-center gap-2 ml-auto z-10">
              {user ? (
                <>
                  {/* 上传按钮 */}
                  <Link href="/upload" className="hidden sm:flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="hidden md:block">上传</span>
                  </Link>

                  <NotificationBell />

                  {/* 头像 + 下拉菜单 */}
                  <div className="relative group">
                    <button className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center hover:ring-2 hover:ring-primary-300 transition-all">
                      <span className="text-sm font-semibold text-primary-700">{user.username.charAt(0).toUpperCase()}</span>
                    </button>
                    <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-sm invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="font-medium text-gray-900 truncate">{user.username}</p>
                      </div>
                      {[
                        { href: '/my-videos', label: '我的视频' },
                        { href: '/profile', label: '个人资料' },
                        ...(isAdmin() ? [{ href: '/admin', label: '管理后台' }] : []),
                      ].map(item => (
                        <Link key={item.href} href={item.href}
                          className="block px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">{item.label}</Link>
                      ))}
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-red-500 hover:bg-gray-50 transition-colors border-t border-gray-100 mt-1">退出登录</button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-primary-600 px-2">登录</Link>
                  <Link href="/register" className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">注册</Link>
                </>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* 移动端底部导航 */}
      {!pathname.startsWith('/admin') && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex">
          {[
            { href: '/', label: '首页', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            { href: '/search', label: '搜索', d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
            ...(user ? [{ href: '/upload', label: '上传', d: 'M12 4v16m8-8H4' }] : []),
            user
              ? { href: '/my-videos', label: '我的', d: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' }
              : { href: '/login', label: '登录', d: 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${pathname === item.href ? 'text-primary-600' : 'text-gray-500'}`}>
              <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.d} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  )
}
