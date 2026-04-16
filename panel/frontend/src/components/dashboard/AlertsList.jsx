import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { formatDuration } from '../../utils/helpers'

export default function AlertsList({ alerts, loading }) {
  const { t } = useTranslation()

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
        {t('dashboard.alerts')}
        {alerts?.length > 0 && (
          <span className="badge-red">{alerts.length}</span>
        )}
      </h3>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      ) : alerts?.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">
          {t('dashboard.noAlerts')}
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map(a => (
            <li key={a.id}
              className="flex items-center justify-between p-3 rounded-lg
                         bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">{a.username}</p>
                <p className="text-xs text-red-500 dark:text-red-400">
                  {formatDuration(a.minutes_today)} / {a.daily_limit_minutes}min
                </p>
              </div>
              <span className="badge-red">Límite</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
