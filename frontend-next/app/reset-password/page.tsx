'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [valid, setValid] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) { setVerifying(false); return }
    api.get(`/auth/reset-password/verify?token=${token}`)
      .then(() => setValid(true))
      .catch(() => setError('链接无效或已过期'))
      .finally(() => setVerifying(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setError('两次密码不一致')
    if (password.length < 6) return setError('密码至少 6 位')
    setLoading(true); setError('')
    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (e: any) {
      setError(e.response?.data?.detail || '重置失败，请重试')
    } finally { setLoading(false) }
  }

  if (verifying) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-sm w-full">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">重置密码</h2>
      </div>

      {success ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
          <p className="text-green-800 dark:text-green-300 font-medium">密码重置成功！</p>
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">正在跳转到登录页...</p>
        </div>
      ) : !valid ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-700 dark:text-red-400 font-medium">{error || '链接无效或已过期'}</p>
          <Link href="/forgot-password" className="mt-3 inline-block text-sm text-primary-600 hover:underline">重新发送</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">新密码</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100"
              placeholder="至少 6 位" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">确认新密码</label>
            <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-[#2a2a2a] dark:text-gray-100"
              placeholder="再次输入新密码" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {loading ? '重置中...' : '确认重置'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ResetPassword() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center py-12 px-4">
      <Suspense><ResetPasswordForm /></Suspense>
    </div>
  )
}
