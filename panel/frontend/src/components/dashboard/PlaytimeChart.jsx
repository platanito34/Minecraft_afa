import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-gray-700 dark:text-gray-200">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {Math.round(p.value / 60)}m
        </p>
      ))}
    </div>
  )
}

export default function PlaytimeChart({ data, loading }) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="card p-5">
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = (data || []).map(d => ({
    date: format(parseISO(d.date), 'd MMM', { locale: es }),
    segundos: Number(d.seconds_played) || 0,
  }))

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
        Tiempo de juego — últimos 30 días
      </h3>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
          {t('common.noData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-gray-400" />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-gray-400"
              tickFormatter={v => `${Math.round(v / 60)}m`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="segundos"
              name="Tiempo"
              stroke="#3b82f6"
              fill="url(#grad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
