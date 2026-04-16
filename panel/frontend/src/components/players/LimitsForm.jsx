import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'

const DAYS = [
  { value: '1', label: 'Lun' }, { value: '2', label: 'Mar' },
  { value: '3', label: 'Mié' }, { value: '4', label: 'Jue' },
  { value: '5', label: 'Vie' }, { value: '6', label: 'Sáb' },
  { value: '0', label: 'Dom' },
]

export default function LimitsForm({ player, limits, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    daily_limit_minutes:  limits?.daily_limit_minutes  || '',
    weekly_limit_minutes: limits?.weekly_limit_minutes || '',
    allowed_start_time:   limits?.allowed_start_time   || '',
    allowed_end_time:     limits?.allowed_end_time     || '',
    kick_on_limit:        limits?.kick_on_limit ?? true,
    warn_at_minutes:      limits?.warn_at_minutes      || '',
    allowed_days:         limits?.allowed_days ? limits.allowed_days.split(',') : [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      allowed_days: f.allowed_days.includes(day)
        ? f.allowed_days.filter(d => d !== day)
        : [...f.allowed_days, day],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put(`/players/${player.id}/limits`, {
        ...form,
        daily_limit_minutes:  form.daily_limit_minutes  ? parseInt(form.daily_limit_minutes)  : null,
        weekly_limit_minutes: form.weekly_limit_minutes ? parseInt(form.weekly_limit_minutes) : null,
        allowed_start_time:   form.allowed_start_time || null,
        allowed_end_time:     form.allowed_end_time   || null,
        kick_on_limit:        form.kick_on_limit,
        warn_at_minutes:      form.warn_at_minutes ? parseInt(form.warn_at_minutes) : null,
        allowed_days:         form.allowed_days.length ? form.allowed_days.join(',') : null,
      })
      onSaved?.()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{t('players.dailyLimit')}</label>
          <input type="number" min="0" max="1440" className="input"
            placeholder="Sin límite"
            value={form.daily_limit_minutes}
            onChange={e => setForm(f => ({ ...f, daily_limit_minutes: e.target.value }))} />
        </div>
        <div>
          <label className="label">{t('players.weeklyLimit')}</label>
          <input type="number" min="0" className="input"
            placeholder="Sin límite"
            value={form.weekly_limit_minutes}
            onChange={e => setForm(f => ({ ...f, weekly_limit_minutes: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Hora inicio</label>
          <input type="time" className="input"
            value={form.allowed_start_time}
            onChange={e => setForm(f => ({ ...f, allowed_start_time: e.target.value }))} />
        </div>
        <div>
          <label className="label">Hora fin</label>
          <input type="time" className="input"
            value={form.allowed_end_time}
            onChange={e => setForm(f => ({ ...f, allowed_end_time: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="label">{t('players.allowedDays')}</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {DAYS.map(day => (
            <button type="button" key={day.value}
              onClick={() => toggleDay(day.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${form.allowed_days.includes(day.value)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-400'
                }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Sin selección = todos los días</p>
      </div>

      <div>
        <label className="label">{t('players.warnBefore')}</label>
        <input type="number" min="0" max="120" className="input"
          placeholder="Ej: 15"
          value={form.warn_at_minutes}
          onChange={e => setForm(f => ({ ...f, warn_at_minutes: e.target.value }))} />
      </div>

      <div className="flex items-center gap-3">
        <input type="checkbox" id="kick_on_limit" className="h-4 w-4 accent-primary-600"
          checked={form.kick_on_limit}
          onChange={e => setForm(f => ({ ...f, kick_on_limit: e.target.checked }))} />
        <label htmlFor="kick_on_limit" className="text-sm text-gray-700 dark:text-gray-300">
          {t('players.kickOnLimit')}
        </label>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? t('common.loading') : t('players.saveLimits')}
      </button>
    </form>
  )
}
