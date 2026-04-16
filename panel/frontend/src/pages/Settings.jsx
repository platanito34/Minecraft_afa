import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { CheckIcon } from '@heroicons/react/24/outline'
import api from '../services/api'
import LoadingSpinner from '../components/common/LoadingSpinner'

function Section({ title, children }) {
  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const { user, updateUser } = useAuth()
  const [settings, setSettings] = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  // Cambio contraseña
  const [pwForm, setPwForm]       = useState({ current: '', new: '', confirm: '' })
  const [pwError, setPwError]     = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    api.get('/settings')
      .then(r => {
        const map = {}
        r.data.forEach(s => { map[s.key] = s.value === '***' ? '' : s.value })
        setSettings(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      // Solo enviar campos no vacíos (para no sobreescribir keys con '***')
      const toSend = {}
      Object.entries(settings).forEach(([k, v]) => {
        if (v !== '' && v !== '***') toSend[k] = v
      })
      await api.put('/settings', toSend)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    finally { setSaving(false) }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (pwForm.new !== pwForm.confirm) {
      setPwError('Las contraseñas no coinciden')
      return
    }
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.current,
        newPassword: pwForm.new,
      })
      setPwSuccess(true)
      setPwForm({ current: '', new: '', confirm: '' })
    } catch (err) {
      setPwError(err.response?.data?.error || 'Error')
    }
  }

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }))

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Pterodactyl */}
        <Section title={t('settings.pterodactyl')}>
          <div>
            <label className="label">{t('settings.pterodactylUrl')}</label>
            <input className="input" type="url" placeholder="https://panel.tudominio.com"
              value={settings.pterodactyl_url || ''}
              onChange={e => set('pterodactyl_url', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('settings.apiKey')}</label>
            <input className="input" type="password" placeholder="ptla_..."
              value={settings.pterodactyl_key || ''}
              onChange={e => set('pterodactyl_key', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Application API Key — Panel → Account → API Credentials
            </p>
          </div>
          <div>
            <label className="label">{t('settings.clientKey')}</label>
            <input className="input" type="password" placeholder="ptlc_..."
              value={settings.pterodactyl_client_key || ''}
              onChange={e => set('pterodactyl_client_key', e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">Client API Key — para acciones desde el cliente</p>
          </div>
        </Section>

        {/* Email */}
        <Section title={t('settings.email')}>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="email_enabled" className="h-4 w-4 accent-primary-600"
              checked={settings.email_enabled === 'true'}
              onChange={e => set('email_enabled', e.target.checked ? 'true' : 'false')} />
            <label htmlFor="email_enabled" className="text-sm text-gray-700 dark:text-gray-300">
              {t('settings.emailEnabled')}
            </label>
          </div>
        </Section>

        {/* General */}
        <Section title="General">
          <div>
            <label className="label">{t('settings.timezone')}</label>
            <select className="input" value={settings.timezone || 'Europe/Madrid'}
              onChange={e => set('timezone', e.target.value)}>
              {['Europe/Madrid', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'UTC'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Límite diario por defecto (minutos, 0 = sin límite)</label>
            <input className="input" type="number" min="0"
              value={settings.max_daily_default || ''}
              onChange={e => set('max_daily_default', e.target.value)} />
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.loading') : t('settings.saveSettings')}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckIcon className="h-4 w-4" />
              {t('settings.saved')}
            </span>
          )}
        </div>
      </form>

      {/* Cambiar contraseña */}
      <Section title={t('auth.changePassword')}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="label">{t('auth.currentPassword')}</label>
            <input type="password" className="input" required
              value={pwForm.current}
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('auth.newPassword')}</label>
            <input type="password" className="input" required minLength={8}
              value={pwForm.new}
              onChange={e => setPwForm(f => ({ ...f, new: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('auth.confirmPassword')}</label>
            <input type="password" className="input" required
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
          </div>
          {pwError   && <p className="text-sm text-red-500">{pwError}</p>}
          {pwSuccess && (
            <p className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckIcon className="h-4 w-4" />
              Contraseña cambiada correctamente
            </p>
          )}
          <button type="submit" className="btn-primary">
            {t('auth.changePassword')}
          </button>
        </form>
      </Section>
    </div>
  )
}
