'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '@/lib/api'
import type { User, AuthContextType } from '@/types'

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (localStorage.getItem('token')) fetchProfile()
    else setLoading(false)
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile')
      setUser(res.data.user)
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { username, password })
      localStorage.setItem('token', res.data.access_token)
      setUser(res.data.user)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data?.detail || 'Login failed' }
    }
  }

  const register = async (username: string, email: string, password: string) => {
    try {
      await api.post('/auth/register', { username, email, password })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data?.detail || 'Registration failed' }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const updateProfile = async (data: Partial<Pick<User, 'email'>> & { password?: string }) => {
    try {
      const res = await api.put('/auth/profile', data)
      setUser(res.data.user)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data?.detail || 'Update failed' }
    }
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, updateProfile,
      isAdmin: () => user?.role === 'admin',
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
