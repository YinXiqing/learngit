'use client'
import { useEffect, useState } from 'react'

const styles: Record<string, { bar: string; icon: string; path: string }> = {
  success: {
    bar: 'bg-white border border-gray-200 text-gray-800',
    icon: 'text-green-500',
    path: 'M5 13l4 4L19 7',
  },
  error: {
    bar: 'bg-white border border-gray-200 text-gray-800',
    icon: 'text-red-500',
    path: 'M6 18L18 6M6 6l12 12',
  },
  warning: {
    bar: 'bg-white border border-gray-200 text-gray-800',
    icon: 'text-yellow-500',
    path: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  },
  info: {
    bar: 'bg-white border border-gray-200 text-gray-800',
    icon: 'text-blue-500',
    path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
}

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  onClose: () => void
}

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const s = styles[type]

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300) }, 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
      <div className={`${s.bar} flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[260px] max-w-[480px]`}>
        <svg className={`w-5 h-5 flex-shrink-0 ${s.icon}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={s.path} />
        </svg>
        <span className="flex-1">{message}</span>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
