import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl font-bold text-primary-600 mb-4">404</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">页面不存在</h2>
        <p className="text-gray-500 mb-6">你访问的页面不存在或已被删除</p>
        <Link href="/" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors">返回首页</Link>
      </div>
    </div>
  )
}
