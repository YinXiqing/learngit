'use client'

const typeStyles: Record<string, { btn: string; icon: string }> = {
  success: { btn: 'bg-green-600 hover:bg-green-700', icon: 'text-green-600' },
  danger:  { btn: 'bg-red-600 hover:bg-red-700',     icon: 'text-red-600' },
  warning: { btn: 'bg-yellow-600 hover:bg-yellow-700', icon: 'text-yellow-600' },
  info:    { btn: 'bg-blue-600 hover:bg-blue-700',    icon: 'text-blue-600' },
}

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: string
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm,
  title = '确认操作', message = '确定要执行此操作吗？',
  confirmText = '确认', cancelText = '取消', type = 'danger',
}: ConfirmDialogProps) {
  if (!isOpen) return null
  const s = typeStyles[type] ?? typeStyles.danger
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className={`text-lg font-semibold text-gray-900 mb-2 ${s.icon}`}>{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex space-x-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">{cancelText}</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-lg transition-colors ${s.btn}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
