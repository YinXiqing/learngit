'use client'
import { RequireAdmin } from '@/components/AuthGuard'
import { useState, useEffect } from 'react'
import { Search, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { User } from '@/types'

type ConfirmState = { isOpen: boolean; type?: string; title?: string; message?: string; onConfirm?: () => void }

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })

  useEffect(() => { fetchUsers() }, [page])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users', { params: { page, per_page: 20, search } })
      setUsers(res.data.users); setTotalPages(res.data.pages)
    } catch { } finally { setLoading(false) }
  }

  const deleteUser = (id: number) => setConfirm({
    isOpen: true, type: 'danger', title: '删除用户', message: '确定要删除这个用户吗？用户的所有视频也将被删除。',
    onConfirm: async () => { await api.delete(`/admin/users/${id}`); fetchUsers(); setConfirm({ isOpen: false }) }
  })

  const saveEdit = async () => {
    if (!editing) return
    await api.put(`/admin/users/${editing.id}`, { role: editing.role, is_active: editing.is_active })
    setEditing(null); fetchUsers()
  }

  return (
    <RequireAdmin>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">用户管理</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">管理平台所有用户账户</p>
        </div>

        <Card className="mb-4">
          <div className="px-4 py-3">
            <form onSubmit={e => { e.preventDefault(); setPage(1); fetchUsers() }} className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索用户名或邮箱..."
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <Button type="submit" variant="outline" size="sm">搜索</Button>
            </form>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">暂无用户</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['用户', '角色', '状态', '注册时间', '操作'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">{u.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.username}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>
                        {u.role === 'admin' ? '管理员' : '普通用户'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.is_active ? 'success' : 'destructive'}>
                        {u.is_active ? '正常' : '已禁用'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing({ ...u })}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => api.put(`/admin/users/${u.id}`, { is_active: !u.is_active }).then(fetchUsers)}>
                          {u.is_active ? '禁用' : '启用'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteUser(u.id)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-6">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">第 {page} / {totalPages} 页</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一页</Button>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">编辑用户</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户名</label>
                <input value={editing.username} disabled className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 dark:text-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">角色</label>
                <select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value as 'user' | 'admin' })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">状态</label>
                <select value={editing.is_active ? 'active' : 'inactive'} onChange={e => setEditing({ ...editing, is_active: e.target.value === 'active' })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="active">正常</option>
                  <option value="inactive">已禁用</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={saveEdit}>保存</Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
    </RequireAdmin>
  )
}
