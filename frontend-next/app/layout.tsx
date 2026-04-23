import './globals.css'
import type { ReactNode } from 'react'
import Script from 'next/script'
import { AuthProvider } from '@/contexts/AuthContext'
import { ChatProvider } from '@/contexts/ChatContext'
import Navbar from '@/components/Navbar'
import ChatWidget from '@/components/ChatWidget'

export const metadata = { title: '视频平台', description: '轻量级视频分享平台', icons: { icon: '/icon.svg' } }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        {/* 防止主题切换闪烁：在 JS 加载前读取 localStorage 并应用主题 */}
        <script dangerouslySetInnerHTML={{ __html: `
          history.scrollRestoration='manual';
          (function(){
            var t = localStorage.getItem('theme');
            if (t === 'light') document.documentElement.classList.remove('dark');
            else document.documentElement.classList.add('dark');
          })();
        `}} />
        <Script src="/hls.min.js" strategy="afterInteractive" />
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="bg-gray-800 dark:bg-[#1a1a1a] text-gray-300 py-8 hidden md:block border-t border-gray-700 dark:border-gray-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <h3 className="text-white font-semibold mb-4">关于我们</h3>
                    <p className="text-sm">轻量级视频分享平台，为用户提供优质的视频观看和分享体验。</p>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-4">快速链接</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/" className="hover:text-white transition-colors">首页</a></li>
                      <li><a href="/search" className="hover:text-white transition-colors">搜索</a></li>
                      <li><a href="/login" className="hover:text-white transition-colors">登录</a></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-4">联系我们</h3>
                    <p className="text-sm">如有任何问题或建议，请随时与我们联系。</p>
                  </div>
                </div>
                <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm">
                  <p>&copy; {new Date().getFullYear()} 视频平台. 保留所有权利。</p>
                </div>
              </div>
            </footer>
            <div id="mobile-nav-spacer" className="md:hidden h-16" />
          </div>
          <ChatProvider>
            <ChatWidget />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
