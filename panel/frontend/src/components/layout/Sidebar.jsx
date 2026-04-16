import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import {
  HomeIcon, UserGroupIcon, ServerStackIcon,
  AcademicCapIcon, ShieldExclamationIcon, Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',   icon: HomeIcon,              key: 'nav.dashboard',  roles: ['admin','teacher','parent'] },
  { to: '/players',     icon: UserGroupIcon,          key: 'nav.players',   roles: ['admin','teacher','parent'] },
  { to: '/servers',     icon: ServerStackIcon,        key: 'nav.servers',   roles: ['admin','teacher','parent'] },
  { to: '/classes',     icon: AcademicCapIcon,        key: 'nav.classes',   roles: ['admin','teacher'] },
  { to: '/moderation',  icon: ShieldExclamationIcon,  key: 'nav.moderation',roles: ['admin','teacher'] },
  { to: '/settings',    icon: Cog6ToothIcon,          key: 'nav.settings',  roles: ['admin'] },
]

export default function Sidebar({ onClose }) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const visibleItems = navItems.filter(item => item.roles.includes(user?.role))

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar dark:bg-sidebar select-none">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Minecraft Panel</div>
            <div className="text-gray-400 text-xs">Escolar</div>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white p-1">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-gray-400 text-xs truncate">{user?.email}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
