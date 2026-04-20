'use client'
import { useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (e: any) {
      setError(e.response?.data?.detail || '发送失败，请重试')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center py-12 px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">忘记密码</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">输入注册邮箱，我们将发送重置链接</p>
        </div>

        {sent ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <p className="text-green-800 dark:text-green-300 font-medium mb-1">邮件已发送</p>
            <p className="text-green-700 dark:text-green-400 text-sm">请检查你的邮箱，链接 30 分钟内有效</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-primary-600 hover:underline">返回登录</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">邮箱地址</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100"
                placeholder="请输入注册邮箱" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {loading ? '发送中...' : '发送重置链接'}
            </button>
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              <Link href="/login" className="text-primary-600 hover:underline">返回登录</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
