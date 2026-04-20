'use client'
import { RequireAdmin } from '@/components/AuthGuard'
import { useState, useEffect } from 'react'
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
  const [selected, setSelected] = useState<number[]>([])
  const [editing, setEditing] = useState<User | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false })

  useEffect(() => { fetchUsers() }, [page, search])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/users', { params: { page, per_page: 20, search } })
      setUsers(res.data.users); setTotalPages(res.data.pages); setSelected([])
    } catch {} finally { setLoading(false) }
  }

  const deleteUser = (id: number) => setConfirm({ isOpen: true, type: 'danger', title: '删除用户', message: '确定要删除这个用户吗？用户的所有视频也将被删除。', onConfirm: async () => {
    await api.delete(`/admin/users/${id}`); fetchUsers(); setConfirm({ isOpen: false })
  }})

  const bulkDelete = () => {
    if (!selected.length) return
    setConfirm({ isOpen: true, type: 'danger', title: '批量删除', message: `确定要删除 ${selected.length} 个用户吗？`, onConfirm: async () => {
      for (const id of selected) await api.delete(`/admin/users/${id}`)
      fetchUsers(); setConfirm({ isOpen: false })
    }})
  }

  const saveEdit = async () => {
    if (!editing) return
    await api.put(`/admin/users/${editing.id}`, { role: editing.role, is_active: editing.is_active })
    setEditing(null); fetchUsers()
  }

  return (
    <RequireAdmin>
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">用户管理</h1><p className="text-gray-600 mt-1">管理平台所有用户账户</p></div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <form onSubmit={e => { e.preventDefault(); setPage(1); fetchUsers() }} className="flex space-x-2">
            <input type="text" placeholder="搜索用户名或邮箱..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <button type="submit" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">搜索</button>
          </form>
        </div>

        {selected.length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-primary-800 font-medium">已选择 {selected.length} 个用户</span>
            <button onClick={bulkDelete} className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700">批量删除</button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="flex items-center space-x-4 animate-pulse"><div className="w-10 h-10 bg-gray-200 rounded-full" /><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-1/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-1/6" /></div></div>)}</div>
          ) : users.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left"><input type="checkbox" checked={selected.length === users.length && users.length > 0} onChange={() => setSelected(selected.length === users.length ? [] : users.map(u => u.id))} className="rounded border-gray-300" /></th>
                  {['用户', '角色', '状态', '注册时间', '操作'].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4"><input type="checkbox" checked={selected.includes(u.id)} onChange={() => setSelected(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])} className="rounded border-gray-300" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center"><span className="text-lg font-medium text-primary-700">{u.username.charAt(0).toUpperCase()}</span></div>
                        <div><p className="font-medium text-gray-900">{u.username}</p><p className="text-sm text-gray-500">{u.email}</p></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>{u.role === 'admin' ? '管理员' : '普通用户'}</span></td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{u.is_active ? '正常' : '已禁用'}</span></td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button onClick={() => setEditing({...u})} className="text-blue-600 hover:text-blue-800 text-sm">编辑</button>
                        <button onClick={() => api.put(`/admin/users/${u.id}`, { is_active: !u.is_active }).then(fetchUsers)} className={`text-sm ${u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>{u.is_active ? '禁用' : '启用'}</button>
                        <button onClick={() => deleteUser(u.id)} className="text-red-600 hover:text-red-800 text-sm">删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-center py-16 text-gray-500">暂无用户</div>}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center mt-6 space-x-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">上一页</button>
            <span className="px-4 py-2">第 {page} 页，共 {totalPages} 页</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">下一页</button>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-bold mb-4">编辑用户</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">用户名</label><input type="text" value={editing.username} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label><input type="email" value={editing.email} disabled className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select value={editing.role} onChange={e => setEditing({...editing, role: e.target.value as 'user' | 'admin'})} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="user">普通用户</option><option value="admin">管理员</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select value={editing.is_active ? 'active' : 'inactive'} onChange={e => setEditing({...editing, is_active: e.target.value === 'active'})} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="active">正常</option><option value="inactive">已禁用</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">保存</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={confirm.isOpen} onClose={() => setConfirm({ isOpen: false })} onConfirm={confirm.onConfirm} title={confirm.title} message={confirm.message} type={confirm.type} confirmText="确认" cancelText="取消" />
    </div>
    </RequireAdmin>
  )
}
