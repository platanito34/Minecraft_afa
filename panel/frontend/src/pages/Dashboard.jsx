import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import {
  ClockIcon, CalendarDaysIcon, ChartBarIcon,
  ServerStackIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import api from '../services/api'
import StatsCard from '../components/dashboard/StatsCard'
import PlaytimeChart from '../components/dashboard/PlaytimeChart'
import AlertsList from '../components/dashboard/AlertsList'
import { formatDuration } from '../utils/helpers'

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [summary, setSummary]     = useState([])
  const [alerts, setAlerts]       = useState([])
  const [servers, setServers]     = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, alertRes, srvRes] = await Promise.all([
          api.get('/playtime/summary'),
          api.get('/playtime/alerts'),
          api.get('/servers'),
        ])
        setSummary(sumRes.data)
        setAlerts(alertRes.data)
        setServers(srvRes.data)

        // Cargar historial del primer jugador (o todos combinados)
        if (sumRes.data.length > 0) {
          const firstPlayer = sumRes.data[0]
          const histRes = await api.get(`/playtime/${firstPlayer.id}/history?days=30`)
          setChartData(histRes.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Calcular totales
  const totalMinutesToday = summary.reduce((a, p) => a + (p.minutes_today || 0), 0)
  const totalMinutesWeek  = summary.reduce((a, p) => a + (p.minutes_week  || 0), 0)
  const onlineServers     = servers.filter(s => s.status?.current_state === 'running').length

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.welcome', { name: user?.name?.split(' ')[0] })}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {new Date().toLocaleDateString(
            user?.language === 'ca' ? 'ca-ES' : 'es-ES',
            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={t('dashboard.playedToday')}
          value={formatDuration(totalMinutesToday)}
          icon={ClockIcon}
          color="blue"
          loading={loading}
        />
        <StatsCard
          title={t('dashboard.playedWeek')}
          value={formatDuration(totalMinutesWeek)}
          icon={CalendarDaysIcon}
          color="purple"
          loading={loading}
        />
        <StatsCard
          title={t('dashboard.serversOnline')}
          value={loading ? '—' : `${onlineServers}/${servers.length}`}
          icon={ServerStackIcon}
          color={onlineServers > 0 ? 'green' : 'gray'}
          loading={loading}
        />
        <StatsCard
          title={t('dashboard.alerts')}
          value={loading ? '—' : alerts.length}
          icon={ExclamationTriangleIcon}
          color={alerts.length > 0 ? 'red' : 'green'}
          loading={loading}
        />
      </div>

      {/* Gráfica + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PlaytimeChart data={chartData} loading={loading} />
        </div>
        <AlertsList alerts={alerts} loading={loading} />
      </div>

      {/* Tabla de jugadores */}
      {!loading && summary.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-4 w-4 text-gray-400" />
            {t('dashboard.recentActivity')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Jugador</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Hoy</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Semana</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-500">Límite</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary.map(p => {
                  const pct = p.daily_limit_minutes
                    ? Math.min(100, Math.round((p.minutes_today / p.daily_limit_minutes) * 100))
                    : 0
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{p.username}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-300">
                        {formatDuration(p.minutes_today)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-300">
                        {formatDuration(p.minutes_week)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-500">
                        {p.daily_limit_minutes ? `${p.daily_limit_minutes}m` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {p.daily_limit_minutes ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
