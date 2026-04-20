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
  const [hoveredVideo, setHoveredVideo] = useState<number | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchVideos = useCallback(async (p: number, tag: string, sort: string) => {
    if (p === 1) { setVideos([]); setHasMore(true) }
    setLoadingMore(true)
    try {
      const params: Record<string, any> = { page: p, per_page: PER_PAGE, sort }
      if (tag) params.tag = tag
      const res = await api.get('/video/list', { params })
      const { videos: newVids, pages } = res.data
      setVideos(prev => p === 1 ? newVids : [...prev, ...newVids])
      setHasMore(p < pages)
      const tagSet = new Set<string>()
      newVids.forEach((v: Video) => (v.tags || []).forEach((t: string) => t.trim() && tagSet.add(t.trim())))
      if (tagSet.size > 0) setAllTags(prev => [...new Set([...prev, ...tagSet])])
    } catch {}
    finally { setLoadingMore(false) }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchVideos(1, activeTag, sortBy)
  }, [activeTag, sortBy])

  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        const next = page + 1
        setPage(next)
        fetchVideos(next, activeTag, sortBy)
      }
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, page, activeTag, sortBy, fetchVideos])

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">推荐视频</h2>
        <div className="flex items-center gap-2">
          {['newest', 'popular'].map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'newest' ? '最新' : '最热'}
            </button>
          ))}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setActiveTag('')} className={`px-3 py-1 rounded-full text-sm transition-colors ${activeTag === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>全部</button>
          {allTags.slice(0, 20).map(tag => (
            <button key={tag} onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${activeTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {videos.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((v, i) => <VideoCard key={v.id} video={v} hoveredVideo={hoveredVideo} setHoveredVideo={setHoveredVideo} formatViews={fmt} formatDuration={dur} priority={i < 4} />)}
          </div>
          <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-6">
            {loadingMore && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />}
            {!hasMore && <p className="text-gray-400 text-sm">已加载全部视频</p>}
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p>{activeTag ? `没有标签为"${activeTag}"的视频` : '暂无视频'}</p>
          {activeTag && <button onClick={() => setActiveTag('')} className="mt-2 text-primary-600 text-sm hover:underline">清除过滤</button>}
        </div>
      )}
    </>
  )
}
