import VideoList from '@/components/VideoList'
import { serverFetch } from '@/lib/server-api'
import type { Video } from '@/types'

async function getInitialVideos() {
  try {
    const res = await serverFetch('/api/video/list?page=1&per_page=12&sort=newest')
    if (!res.ok) return { videos: [], tags: [], hasMore: false }
    const data = await res.json()
    const tagSet = new Set<string>()
    data.videos.forEach((v: Video) => (v.tags || []).forEach((t: string) => t.trim() && tagSet.add(t.trim())))
    return { videos: data.videos, tags: [...tagSet], hasMore: data.pages > 1 }
  } catch {
    return { videos: [], tags: [], hasMore: false }
  }
}

export const metadata = { title: '首页 - 视频平台' }

export default async function Home() {
  const { videos, tags, hasMore } = await getInitialVideos()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VideoList initialVideos={videos} initialTags={tags} initialHasMore={hasMore} />
      </section>
    </div>
  )
}
