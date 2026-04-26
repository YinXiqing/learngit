'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
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
  const initializedRef = useRef(false)


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
    initializedRef.current = false
    setPage(1); setActiveTag(''); setSortBy('newest')
    search(1, 'newest', '')
    initializedRef.current = true
  }, [query])

  useEffect(() => {
    if (!initializedRef.current) return
    search(page, sortBy, activeTag)
  }, [sortBy, page, activeTag])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{query ? `"${query}" 的搜索结果` : '所有视频'}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">共 {total} 个视频</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 mt-1">
              {[['newest', '最新'], ['popular', '最热']].map(([val, label]) => (
                <button key={val} onClick={() => { setSortBy(val); setPage(1) }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === val ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* 标签筛选 */}
          {allTags.length > 0 && (
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                <button onClick={() => { setActiveTag(''); setPage(1) }} className={`px-3 py-1 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors ${activeTag === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>全部</button>
                {allTags.slice(0, 20).map(tag => (
                  <button key={tag} onClick={() => { setActiveTag(activeTag === tag ? '' : tag); setPage(1) }}
                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors ${activeTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{tag}</button>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-gray-50 dark:from-[#0f0f0f] to-transparent pointer-events-none" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden animate-pulse"><div className="aspect-video bg-gray-200 dark:bg-[#333]" /><div className="p-4"><div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-1/2" /></div></div>)}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((v, i) => <VideoCard key={v.id} video={v} formatViews={fmt} formatDuration={dur} priority={i < 4} />)}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center mt-8 items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">上一页</button>
                {(() => {
                  const pages: (number | '...')[] = []
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i)
                  } else {
                    pages.push(1)
                    if (page > 3) pages.push('...')
                    for (let i = Math.max(2, page-1); i <= Math.min(totalPages-1, page+1); i++) pages.push(i)
                    if (page < totalPages - 2) pages.push('...')
                    pages.push(totalPages)
                  }
                  return pages.map((p, i) => p === '...'
                    ? <span key={`e${i}`} className="w-10 h-10 flex items-center justify-center text-gray-400">…</span>
                    : <button key={p} onClick={() => setPage(p)} className={`w-10 h-10 rounded-lg text-sm ${page === p ? 'bg-primary-600 text-white' : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{p}</button>
                  )
                })()}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">下一页</button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">未找到相关视频</h3>
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
