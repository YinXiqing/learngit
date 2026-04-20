'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { register, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => { if (isAuthenticated) router.replace('/') }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.username.length < 3) return setError('用户名至少需要3个字符')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('请输入有效的邮箱地址')
    if (form.password.length < 6) return setError('密码至少需要6个字符')
    if (form.password !== form.confirmPassword) return setError('两次输入的密码不一致')
    setLoading(true)
    const res = await register(form.username, form.email, form.password)
    if (res.success) { setSuccess('注册成功！请登录您的账号'); setTimeout(() => router.replace('/login'), 2000) }
    else { setError(res.error ?? '注册失败'); setLoading(false) }
  }

  const fields = [
    { name: 'username' as const, label: '用户名', type: 'text', placeholder: '请输入用户名（至少3个字符）' },
    { name: 'email' as const, label: '邮箱', type: 'email', placeholder: '请输入邮箱地址' },
    { name: 'password' as const, label: '密码', type: 'password', placeholder: '请输入密码（至少6个字符）' },
    { name: 'confirmPassword' as const, label: '确认密码', type: 'password', placeholder: '请再次输入密码' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" /></svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">创建账号</h2>
          <p className="mt-2 text-sm text-gray-600">已有账号？<Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">立即登录</Link></p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}
          {fields.map(f => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input type={f.type} required value={form[f.name]} onChange={e => setForm({...form, [f.name]: e.target.value})}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder={f.placeholder} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
