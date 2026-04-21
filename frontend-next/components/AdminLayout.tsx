'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Users, Video, Rss, LogOut, Menu, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
  { href: '/admin', label: '概览', icon: LayoutDashboard, exact: true },
  { href: '/admin/videos', label: '视频管理', icon: Video },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/scraper', label: '视频抓取', icon: Rss },
]

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname()
  const { logout } = useAuth()
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <Link href="/" className="text-lg font-bold text-primary-600">视频平台</Link>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">管理后台</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link key={href} href={href} onClick={onNav} className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              active
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800 space-y-1">
        <Link href="/" onClick={onNav} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ExternalLink className="w-4 h-4" />前台首页
        </Link>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <LogOut className="w-4 h-4" />退出登录
        </button>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-[#0a0a0a]">
      {/* 桌面侧边栏 */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-white dark:bg-[#111] border-r border-gray-200 dark:border-gray-800">
        <SidebarContent />
      </aside>

      {/* 移动端遮罩 */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-[#111] shadow-xl">
            <SidebarContent onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 移动端顶部栏 */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-gray-800 shrink-0">
          <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="font-semibold text-gray-900 dark:text-gray-100">管理后台</span>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
