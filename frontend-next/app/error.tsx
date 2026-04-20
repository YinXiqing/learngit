'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-red-400 mb-4">500</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">出错了</h2>
        <p className="text-gray-500 mb-6">页面加载时发生了错误</p>
        <button onClick={reset} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors">重试</button>
      </div>
    </div>
  )
}
