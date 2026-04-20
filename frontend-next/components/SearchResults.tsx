'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import VideoCard from '@/components/VideoCard'
import type { Video } from '@/types'

const fmt = (s: number) => s >= 1e6 ? `${(s/1e6).toFixed(1)}M` : s >= 1e3 ? `${(s/1e3).toFixed(1)}K` : String(s)
const dur = (s: number) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'

interface SearchResultsProps {
  initialVideos: Video[]
  initialTotal: number
  initialPages: number
  initialTags: string[]
  query: string
}

function SearchResultsInner({ initialVideos, initialTotal, initialPages, initialTags, query }: SearchResultsProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [total, setTotal] = useState(initialTotal)
  const [totalPages, setTotalPages] = useState(initialPages)
  const [allTags, setAllTags] = useState<string[]>(initialTags)
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [activeTag, setActiveTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [hoveredVideo, setHoveredVideo] = useState<number | null>(null)

  const search = useCallback(async (p: number, sort: string, tag: string) => {
    setLoading(true)
    try {
      const params: Record<string, any> = { search: query, sort, page: p, per_page: 12 }
      if (tag) params.tag = tag
      const res = await api.get('/video/list', { params })
      setVideos(res.data.videos)
      setTotal(res.data.total)
      setTotalPages(res.data.pages)
      const tagSet = new Set<string>()
      res.data.videos.forEach((v: Video) => (v.tags || []).forEach((t: string) => t.trim() && tagSet.add(t.trim())))
      if (tagSet.size > 0) setAllTags(prev => [...new Set([...prev, ...tagSet])])
    } catch {}
    finally { setLoading(false) }
  }, [query])

  useEffect(() => {
    setPage(1); setActiveTag(''); setSortBy('newest')
    search(1, 'newest', '')
  }, [query])

  useEffect(() => {
    if (sortBy === 'newest' && page === 1 && !activeTag) return
    search(page, sortBy, activeTag)
  }, [sortBy, page, activeTag])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">{query ? `"${query}" 的搜索结果` : '所有视频'}</h1>
          <p className="text-gray-500 text-sm mt-1">共 {total} 个视频</p>
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">排序方式:</span>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="newest">最新发布</option>
              <option value="popular">最热播放</option>
              <option value="oldest">最早发布</option>
            </select>
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setActiveTag(''); setPage(1) }} className={`px-3 py-1 rounded-full text-sm ${activeTag === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>全部</button>
              {allTags.slice(0, 20).map(tag => (
                <button key={tag} onClick={() => { setActiveTag(activeTag === tag ? '' : tag); setPage(1) }}
                  className={`px-3 py-1 rounded-full text-sm ${activeTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{tag}</button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse"><div className="aspect-video bg-gray-200" /><div className="p-4"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 rounded w-1/2" /></div></div>)}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((v, i) => <VideoCard key={v.id} video={v} hoveredVideo={hoveredVideo} setHoveredVideo={setHoveredVideo} formatViews={fmt} formatDuration={dur} priority={i < 4} />)}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center mt-8 space-x-2">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">上一页</button>
                {[...Array(Math.min(totalPages, 7))].map((_, i) => (
                  <button key={i} onClick={() => setPage(i+1)} className={`w-10 h-10 rounded-lg ${page === i+1 ? 'bg-primary-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>{i+1}</button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">下一页</button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-lg font-medium text-gray-900 mb-2">未找到相关视频</h3>
            <Link href="/" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">返回首页</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchResults(props: SearchResultsProps) {
  return <Suspense><SearchResultsInner {...props} /></Suspense>
}
