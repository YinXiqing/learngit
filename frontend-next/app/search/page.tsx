import SearchResults from '@/components/SearchResults'
import { serverFetch } from '@/lib/server-api'
import type { Video } from '@/types'

async function searchVideos(query: string) {
  try {
    const params = new URLSearchParams({ page: '1', per_page: '12', sort: 'newest' })
    if (query) params.set('search', query)
    const res = await serverFetch(`/api/video/list?${params}`)
    if (!res.ok) return { videos: [], total: 0, pages: 1, tags: [] }
    const data = await res.json()
    const tagSet = new Set<string>()
    data.videos.forEach((v: Video) => (v.tags || []).forEach((t: string) => t.trim() && tagSet.add(t.trim())))
    return { videos: data.videos, total: data.total, pages: data.pages, tags: [...tagSet] }
  } catch {
    return { videos: [], total: 0, pages: 1, tags: [] }
  }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search: q = '' } = await searchParams
  return { title: q ? `搜索"${q}" - 视频平台` : '搜索 - 视频平台' }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search: query = '' } = await searchParams
  const { videos, total, pages, tags } = await searchVideos(query)

  return (
    <SearchResults
      initialVideos={videos}
      initialTotal={total}
      initialPages={pages}
      initialTags={tags}
      query={query}
    />
  )
}
