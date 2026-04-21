'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import VideoCard from '@/components/VideoCard'
import api from '@/lib/api'
import type { Video } from '@/types'

const PER_PAGE = 12
const fmt = (s: number) => s >= 1e6 ? `${(s/1e6).toFixed(1)}M` : s >= 1e3 ? `${(s/1e3).toFixed(1)}K` : String(s)
const dur = (s: number) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'

interface VideoListProps {
  initialVideos: Video[]
  initialTags: string[]
  initialHasMore: boolean
}

export default function VideoList({ initialVideos, initialTags, initialHasMore }: VideoListProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [allTags, setAllTags] = useState<string[]>(initialTags)
  const [activeTag, setActiveTag] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ page, activeTag, sortBy, hasMore, loadingMore })
  stateRef.current = { page, activeTag, sortBy, hasMore, loadingMore }

  const fetchVideos = useCallback(async (p: number, tag: string, sort: string, replace: boolean) => {
    setLoadingMore(true)
    try {
      const params: Record<string, any> = { page: p, per_page: PER_PAGE, sort }
      if (tag) params.tag = tag
      const res = await api.get('/video/list', { params })
      const { videos: newVids, pages } = res.data
      // replace=true 时替换（切换 tag/sort），false 时追加（加载更多）
      setVideos(prev => replace ? newVids : [...prev, ...newVids])
      setHasMore(p < pages)
      const tagSet = new Set<string>()
      newVids.forEach((v: Video) => (v.tags || []).forEach((t: string) => t.trim() && tagSet.add(t.trim())))
      if (tagSet.size > 0) setAllTags(prev => [...new Set([...prev, ...tagSet])])
    } catch {}
    finally { setLoadingMore(false) }
  }, [])

  // 切换 tag/sort 时重置并替换数据（不清空，避免空白闪烁）
  useEffect(() => {
    setPage(1)
    fetchVideos(1, activeTag, sortBy, true)
  }, [activeTag, sortBy])

  // 无限滚动
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const obs = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      const { page, activeTag, sortBy, hasMore, loadingMore } = stateRef.current
      if (!hasMore || loadingMore) return
      const next = page + 1
      setPage(next)
      fetchVideos(next, activeTag, sortBy, false)
    }, { threshold: 0.1 })
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [fetchVideos])

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">推荐视频</h2>
        <div className="flex items-center gap-2">
          {['newest', 'popular'].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === s ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-[#333]'}`}>
              {s === 'newest' ? '最新' : '最热'}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="relative mb-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            <button onClick={() => setActiveTag('')} className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${activeTag === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>全部</button>
            {allTags.slice(0, 20).map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${activeTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {tag}
              </button>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-gray-50 dark:from-[#0f0f0f] to-transparent pointer-events-none" />
        </div>
      )}

      {videos.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((v, i) => <VideoCard key={v.id} video={v} formatViews={fmt} formatDuration={dur} priority={i < 4} />)}
          </div>
          <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-6">
            {loadingMore && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />}
            {!hasMore && <p className="text-gray-400 dark:text-gray-500 text-sm">已加载全部视频</p>}
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p>{activeTag ? `没有标签为"${activeTag}"的视频` : '暂无视频'}</p>
          {activeTag && <button onClick={() => setActiveTag('')} className="mt-2 text-primary-600 text-sm hover:underline">清除过滤</button>}
        </div>
      )}
    </>
  )
}
