'use client'
import { RequireAuth } from '@/components/AuthGuard'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

type Toast = { msg: string; type: 'success' | 'error' } | null

export default function Profile() {
  const { user, updateProfile } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    const res = await updateProfile({ email })
    if (res.success) showToast('邮箱已更新'); else showToast(res.error ?? '更新失败', 'error')
    setLoading(false)
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) return showToast('两次密码不一致', 'error')
    if (newPassword.length < 6) return showToast('密码至少6位', 'error')
    setLoading(true)
    const res = await updateProfile({ password: newPassword })
    if (res.success) { setNewPassword(''); setConfirmPassword(''); showToast('密码已更新') }
    else showToast(res.error ?? '更新失败', 'error')
    setLoading(false)
  }

  if (!user) return null

  return (
    <RequireAuth>
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">个人资料</h1>
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-700">{user.username?.charAt(0).toUpperCase()}</span>
            </div>
            <div><p className="text-lg font-semibold text-gray-900">{user.username}</p><p className="text-sm text-gray-500">{user.role === 'admin' ? '管理员' : '普通用户'}</p></div>
          </div>
          <form onSubmit={handleEmail} className="space-y-4">
            <h2 className="font-medium text-gray-900">修改邮箱</h2>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            <button type="submit" disabled={loading} className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">更新邮箱</button>
          </form>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <form onSubmit={handlePassword} className="space-y-4">
            <h2 className="font-medium text-gray-900">修改密码</h2>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="新密码（至少6位）" required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="确认新密码" required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            <button type="submit" disabled={loading} className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium">更新密码</button>
          </form>
        </div>
      </div>
      {toast && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{toast.msg}</div>}
    </div>
    </RequireAuth>
  )
}
