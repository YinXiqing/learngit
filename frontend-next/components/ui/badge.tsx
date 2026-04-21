import { cn } from '@/lib/utils'

export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline' }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300': variant === 'default',
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300': variant === 'success',
      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300': variant === 'warning',
      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300': variant === 'destructive',
      'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300': variant === 'outline',
    }, className)} {...props} />
  )
}
