export interface User {
  id: number
  username: string
  email: string
  role: 'user' | 'admin'
  is_active: boolean
  created_at: string
}

export interface Video {
  id: number
  title: string
  description: string | null
  tags: string[]
  filename: string
  cover_image: string | null
  file_size: number | null
  duration: number | null
  status: 'pending' | 'approved' | 'rejected'
  view_count: number
  user_id: number
  author: string | null
  source_url: string | null
  video_url: string | null
  page_url: string | null
  is_scraped: boolean
  created_at: string
}

export interface ScrapedVideo {
  id: number
  source_url: string
  title: string | null
  description: string | null
  cover_url: string | null
  video_url: string | null
  tags: string | null
  scraped_at: string | null
  status: string
}

export interface PaginatedResponse<T> {
  total: number
  pages: number
  current_page: number
  per_page: number
  items?: T[]
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateProfile: (data: Partial<Pick<User, 'email'>> & { password?: string }) => Promise<{ success: boolean; error?: string }>
  isAdmin: () => boolean
  isAuthenticated: boolean
}
