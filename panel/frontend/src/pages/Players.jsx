import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import {
  MagnifyingGlassIcon, PlusIcon, ClockIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import api from '../services/api'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { formatDuration, limitPercent, limitColor } from '../utils/helpers'

function AddPlayerModal({ open, onClose, onAdded }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ uuid: '', username: '', display_name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/players', form)
      onAdded()
      onClose()
      setForm({ uuid: '', username: '', display_name: '' })
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('players.addPlayer')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">UUID de Minecraft *</label>
          <input className="input" required value={form.uuid}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            onChange={e => setForm(f => ({ ...f, uuid: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">Para servidores offline, genera un UUID válido.</p>
        </div>
        <div>
          <label className="label">{t('players.username')} *</label>
          <input className="input" required maxLength={16} value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </div>
        <div>
          <label className="label">{t('players.displayName')}</label>
          <input className="input" value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? t('common.loading') : t('common.add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Players() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [players, setPlayers]     = useState([])
  const [summary, setSummary]     = useState({})
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)

  const load = async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/players'),
        api.get('/playtime/summary'),
      ])
      setPlayers(pRes.data)
      const map = {}
      sRes.data.forEach(p => { map[p.id] = p })
      setSummary(map)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    (p.display_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const canAdd = ['admin', 'teacher'].includes(user?.role)

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('players.title')}</h1>
        {canAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            {t('players.addPlayer')}
          </button>
        )}
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder={t('players.search')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">{t('players.noPlayers')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(player => {
            const s = summary[player.id] || {}
            const pct = limitPercent(s.seconds_today, s.daily_limit_minutes)
            const col = limitColor(pct)
            return (
              <div
                key={player.id}
                onClick={() => navigate(`/players/${player.id}`)}
                className="card p-4 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700
                           transition-all duration-150 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center
                                    justify-center text-primary-600 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{player.username}</p>
                      {player.display_name && (
                        <p className="text-xs text-gray-400 truncate">{player.display_name}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <ClockIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500">Hoy:</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {formatDuration(s.seconds_today || 0)}
                  </span>
                  {s.daily_limit_minutes && (
                    <span className="text-xs text-gray-400">/ {s.daily_limit_minutes}m</span>
                  )}
                </div>

                {s.daily_limit_minutes && (
                  <div className="mt-2 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        col === 'red' ? 'bg-red-500' : col === 'yellow' ? 'bg-yellow-400' : 'bg-green-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AddPlayerModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={load} />
    </div>
  )
}
