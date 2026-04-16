import clsx from 'clsx'

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'blue', loading }) {
  const colors = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    red:    'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</p>
          {loading ? (
            <div className="mt-1 h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          )}
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-2.5 rounded-xl flex-shrink-0', colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}
