import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import {
  Bars3Icon, SunIcon, MoonIcon, BellIcon,
  ArrowRightOnRectangleIcon, UserCircleIcon,
} from '@heroicons/react/24/outline'
import api from '../../services/api'

export default function Header({ onMenuClick }) {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    api.get('/notifications/unread-count')
      .then(r => setUnread(r.data.count))
      .catch(() => {})

    const interval = setInterval(() => {
      api.get('/notifications/unread-count')
        .then(r => setUnread(r.data.count))
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const changeLang = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('language', lang)
  }

  return (
    <header className="flex h-14 items-center justify-between px-4 md:px-6
                       bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700/50
                       flex-shrink-0">
      {/* Izquierda */}
      <button
        onClick={onMenuClick}
        className="lg:hidden btn-ghost p-2 -ml-2"
        aria-label="Menú"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {/* Derecha */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Selector idioma */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {['es', 'ca'].map(lang => (
            <button
              key={lang}
              onClick={() => changeLang(lang)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${i18n.language === lang
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Toggle tema */}
        <button onClick={toggle} className="btn-ghost p-2 rounded-lg" aria-label="Cambiar tema">
          {dark
            ? <SunIcon className="h-5 w-5 text-yellow-400" />
            : <MoonIcon className="h-5 w-5" />
          }
        </button>

        {/* Notificaciones */}
        <button
          onClick={() => {/* futuro panel */}}
          className="btn-ghost p-2 rounded-lg relative"
          aria-label={t('nav.notifications')}
        >
          <BellIcon className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* Menú usuario */}
        <Menu as="div" className="relative">
          <Menu.Button className="flex items-center gap-2 btn-ghost px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center
                            text-white text-xs font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200">
              {user?.name}
            </span>
          </Menu.Button>

          <Transition as={Fragment}
            enter="transition ease-out duration-100" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-1 w-48 card py-1 z-50 focus:outline-none">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm
                      ${active ? 'bg-gray-50 dark:bg-gray-700' : ''}
                      text-gray-700 dark:text-gray-200`}
                    onClick={() => navigate('/settings')}
                  >
                    <UserCircleIcon className="h-4 w-4" />
                    {t('auth.changePassword')}
                  </button>
                )}
              </Menu.Item>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`flex w-full items-center gap-3 px-4 py-2 text-sm
                      ${active ? 'bg-gray-50 dark:bg-gray-700' : ''}
                      text-red-600 dark:text-red-400`}
                    onClick={handleLogout}
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    {t('auth.logout')}
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    </header>
  )
}
