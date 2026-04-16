import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'

export default function Login() {
  const { t, i18n } = useTranslation()
  const { login }   = useAuth()
  const { dark, toggle } = useTheme()
  const navigate    = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-panel dark:bg-panel-dark px-4">
      {/* Controles de tema e idioma */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-white dark:bg-surface-dark rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
          {['es', 'ca'].map(lang => (
            <button
              key={lang}
              onClick={() => { i18n.changeLanguage(lang); localStorage.setItem('language', lang) }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${i18n.language === lang
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={toggle}
          className="p-2 rounded-lg bg-white dark:bg-surface-dark shadow-sm
                     border border-gray-200 dark:border-gray-700
                     text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </button>
      </div>

      {/* Card de login */}
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-2xl shadow-lg mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
              <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Minecraft Panel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión escolar de servidores</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">{t('auth.password')}</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? t('auth.loggingIn') : t('auth.loginBtn')}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          Panel Minecraft Escolar &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
