'use client'
import { RequireAuth } from '@/components/AuthGuard'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api, { BACKEND_URL } from '@/lib/api'
import axios from 'axios'

export default function Upload() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ title: '', description: '', tags: '' })
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 500 * 1024 * 1024) return setError('视频文件大小不能超过500MB')
    setVideoFile(f); setError('')
  }

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoFile) return setError('请选择要上传的视频文件')
    if (!form.title.trim()) return setError('请输入视频标题')
    setUploading(true); setProgress(0); setError('')
    const data = new FormData()
    data.append('video', videoFile)
    data.append('title', form.title)
    data.append('description', form.description)
    data.append('tags', form.tags)
    if (coverFile) data.append('cover', coverFile)
    try {
      const token = localStorage.getItem('token')
      await axios.post(`${BACKEND_URL}/api/video/upload`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / (e.total ?? 1))),
      })
      setSuccess(true)
      setTimeout(() => router.push('/my-videos'), 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || '上传失败，请重试')
    } finally { setUploading(false) }
  }

  if (success) return (
    <RequireAuth>
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">上传成功！</h2>
        <p className="text-gray-600 mb-6">您的视频已上传，正在等待管理员审核。</p>
        <button onClick={() => router.push('/my-videos')} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">查看我的视频</button>
      </div>
    </div>
    </RequireAuth>
  )

  return (
    <RequireAuth>
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">上传视频</h1><p className="text-gray-600 mt-1">分享您的精彩视频内容</p></div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">视频文件 <span className="text-red-500">*</span></label>
                {!videoFile ? (
                  <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <p className="text-gray-600 mb-2">点击选择视频文件</p>
                    <p className="text-sm text-gray-400">支持 MP4, AVI, MKV, MOV, WMV，最大 500MB</p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 flex items-center space-x-4">
                    <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 truncate">{videoFile.name}</p><p className="text-sm text-gray-500">{(videoFile.size/1024/1024).toFixed(2)} MB</p></div>
                    <button type="button" onClick={() => { setVideoFile(null); if (fileRef.current) fileRef.current.value = '' }} className="text-red-500 hover:text-red-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="video/*" onChange={handleVideo} className="hidden" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">封面图片 <span className="text-gray-400">(可选)</span></label>
                {!coverFile ? (
                  <div onClick={() => coverRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors">
                    <p className="text-sm text-gray-600">点击选择封面图片</p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 flex items-center space-x-4">
                    {coverPreview && <img src={coverPreview} alt="cover" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />}
                    <div className="flex-1"><p className="font-medium text-gray-900">{coverFile.name}</p></div>
                    <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); if (coverRef.current) coverRef.current.value = '' }} className="text-red-500 hover:text-red-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                <input ref={coverRef} type="file" accept="image/*" onChange={handleCover} className="hidden" />
              </div>
            </div>
            <div className="space-y-4">
              {([
                { name: 'title', label: '视频标题 *', type: 'text', placeholder: '请输入视频标题', required: true },
                { name: 'tags', label: '标签', type: 'text', placeholder: '输入标签，用逗号分隔', required: false },
              ] as const).map(f => (
                <div key={f.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.name]} onChange={e => setForm({...form, [f.name]: e.target.value})} required={f.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder={f.placeholder} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">视频简介</label>
                <textarea rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" placeholder="请输入视频简介（可选）" />
              </div>
            </div>
          </div>
          {uploading && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 mb-1"><span>上传中...</span><span>{progress}%</span></div>
              <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} /></div>
            </div>
          )}
          <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-gray-200">
            <button type="button" onClick={() => router.push('/my-videos')} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">取消</button>
            <button type="submit" disabled={uploading || !videoFile} className="px-8 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {uploading ? '上传中...' : '上传视频'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </RequireAuth>
  )
}
