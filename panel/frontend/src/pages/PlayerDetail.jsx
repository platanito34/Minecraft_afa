import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import api from '../services/api'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import PlaytimeChart from '../components/dashboard/PlaytimeChart'
import LimitsForm from '../components/players/LimitsForm'
import { formatDuration } from '../utils/helpers'
import { format } from 'date-fns'

export default function PlayerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [player, setPlayer]   = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLimits, setShowLimits] = useState(false)
  const [summary, setSummary] = useState(null)

  const load = async () => {
    try {
      const [pRes, hRes, sRes] = await Promise.all([
        api.get(`/players/${id}`),
        api.get(`/playtime/${id}/history?days=30`),
        api.get('/playtime/summary'),
      ])
      setPlayer(pRes.data)
      setHistory(hRes.data)
      const s = sRes.data.find(p => String(p.id) === String(id))
      setSummary(s)
    } catch {
      navigate('/players')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const canEdit = ['admin', 'teacher'].includes(user?.role)

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>
  if (!player) return null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/players')} className="btn-ghost p-2 -ml-2">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-xl
                          flex items-center justify-center text-primary-600 font-bold">
            {player.username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{player.username}</h1>
            {player.display_name && (
              <p className="text-sm text-gray-400">{player.display_name}</p>
            )}
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setShowLimits(true)} className="btn-secondary">
            <PencilSquareIcon className="h-4 w-4" />
            {t('players.setLimits')}
          </button>
        )}
      </div>

      {/* Stats hoy */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('players.today'),     value: formatDuration(summary?.seconds_today  || 0) },
          { label: t('players.thisWeek'),  value: formatDuration(summary?.seconds_week   || 0) },
          { label: t('players.thisMonth'), value: formatDuration(summary?.seconds_month  || 0) },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Límites actuales */}
      {player.limits && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            {t('players.limits')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400">{t('players.dailyLimit')}</p>
              <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                {player.limits.daily_limit_minutes ? `${player.limits.daily_limit_minutes}m` : t('players.noLimit')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Horario</p>
              <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                {player.limits.allowed_start_time && player.limits.allowed_end_time
                  ? `${player.limits.allowed_start_time} - ${player.limits.allowed_end_time}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('players.kickOnLimit')}</p>
              <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                {player.limits.kick_on_limit ? t('common.yes') : t('common.no')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Aviso previo</p>
              <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                {player.limits.warn_at_minutes ? `${player.limits.warn_at_minutes}m antes` : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica */}
      <PlaytimeChart data={history} />

      {/* Historial de sesiones */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          {t('players.sessions')}
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('common.noData')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  <th className="text-left py-2 px-3">Fecha</th>
                  <th className="text-right py-2 px-3">Tiempo jugado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[...history].reverse().slice(0, 20).map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                      {format(new Date(d.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                      {formatDuration(d.seconds_played)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal límites */}
      <Modal open={showLimits} onClose={() => setShowLimits(false)} title={t('players.setLimits')} size="md">
        <LimitsForm
          player={player}
          limits={player.limits}
          onSaved={() => { setShowLimits(false); load() }}
        />
      </Modal>
    </div>
  )
}
