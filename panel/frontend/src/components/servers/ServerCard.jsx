import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PlayIcon, StopIcon, ArrowPathIcon, ServerIcon,
  CpuChipIcon, CircleStackIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline'
import api from '../../services/api'
import { serverStateBadge } from '../../utils/helpers'
import Badge from '../common/Badge'

export default function ServerCard({ server, onRefresh, onEdit }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const state = server.status?.current_state || 'unknown'
  const badge = serverStateBadge(state)

  const resources = server.status?.resources
  const cpuPct    = resources?.cpu_absolute?.toFixed(1) || '—'
  const memMB     = resources?.memory_bytes
    ? Math.round(resources.memory_bytes / 1024 / 1024)
    : null
  const memLimit  = server.status?.limits?.memory || 0

  const powerAction = async (action) => {
    setLoading(true)
    try {
      await api.post(`/servers/${server.id}/power`, { action })
      setTimeout(() => { onRefresh?.(); setLoading(false) }, 3000)
    } catch {
      setLoading(false)
    }
  }

  const isRunning = state === 'running'
  const isOff     = state === 'offline'

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0">
            <ServerIcon className="h-5 w-5 text-gray-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{server.name}</h3>
            {server.description && (
              <p className="text-xs text-gray-400 truncate">{server.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge color={badge.cls.replace('badge-', '')}>{badge.label}</Badge>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
              title="Editar servidor"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Recursos */}
      {resources && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <CpuChipIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500">{t('servers.cpu')}:</span>
            <span className="font-medium text-gray-900 dark:text-white">{cpuPct}%</span>
          </div>
          {memMB !== null && (
            <div className="flex items-center gap-2 text-sm">
              <CircleStackIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500">{t('servers.memory')}:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {memMB}MB{memLimit ? `/${memLimit}MB` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 flex-wrap">
        {isOff && (
          <button
            onClick={() => powerAction('start')}
            disabled={loading}
            className="btn-primary flex-1 text-xs py-1.5"
          >
            <PlayIcon className="h-3.5 w-3.5" />
            {t('servers.start')}
          </button>
        )}
        {isRunning && (
          <>
            <button
              onClick={() => powerAction('restart')}
              disabled={loading}
              className="btn-secondary flex-1 text-xs py-1.5"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              {t('servers.restart')}
            </button>
            <button
              onClick={() => powerAction('stop')}
              disabled={loading}
              className="btn-danger flex-1 text-xs py-1.5"
            >
              <StopIcon className="h-3.5 w-3.5" />
              {t('servers.stop')}
            </button>
          </>
        )}
        {!isOff && !isRunning && (
          <p className="text-xs text-gray-400">
            {loading ? 'Procesando...' : 'Estado: ' + state}
          </p>
        )}
      </div>
    </div>
  )
}
