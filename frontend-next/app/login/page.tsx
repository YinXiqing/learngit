'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => { if (isAuthenticated) router.replace('/') }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await login(form.username, form.password)
    if (res.success) router.replace('/')
    else { setError(res.error ?? '登录失败'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center py-12 px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">欢迎回来</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">还没有账号？<Link href="/register" className="font-medium text-primary-600 hover:text-primary-500">立即注册</Link></p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户名或邮箱</label>
            <input type="text" required value={form.username} onChange={e => setForm({...form, username: e.target.value})}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100 dark:focus:ring-primary-400 dark:bg-[#2a2a2a] dark:text-gray-100 dark:placeholder-gray-500" placeholder="请输入用户名或邮箱" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密码</label>
            <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100 dark:focus:ring-primary-400 dark:bg-[#2a2a2a] dark:text-gray-100 dark:placeholder-gray-500" placeholder="请输入密码" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {loading ? '登录中...' : '登录'}
          </button>
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">忘记密码？</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
