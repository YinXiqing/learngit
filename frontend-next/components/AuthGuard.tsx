'use client'
import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])
  if (loading || !user) return null
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!isAdmin()) router.replace('/')
    }
  }, [user, loading, router])
  if (loading || !user || !isAdmin()) return null
  return <>{children}</>
}
