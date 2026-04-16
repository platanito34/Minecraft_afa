// Formatear segundos a "Xh Ym"
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Formatear segundos a minutos
export function toMinutes(seconds) {
  return Math.floor((seconds || 0) / 60)
}

// Porcentaje usado del límite
export function limitPercent(secondsToday, limitMinutes) {
  if (!limitMinutes) return 0
  return Math.min(100, Math.round((secondsToday / (limitMinutes * 60)) * 100))
}

// Color según porcentaje
export function limitColor(percent) {
  if (percent >= 100) return 'red'
  if (percent >= 80)  return 'yellow'
  return 'green'
}

// Formatear fecha relativa
export function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'ahora mismo'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  const d = Math.floor(h / 24)
  return `hace ${d}d`
}

// Capitalizar primera letra
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Estado del servidor → badge
export function serverStateBadge(state) {
  const map = {
    running:  { label: 'Online',    cls: 'badge-green'  },
    starting: { label: 'Iniciando', cls: 'badge-yellow' },
    stopping: { label: 'Parando',   cls: 'badge-yellow' },
    offline:  { label: 'Offline',   cls: 'badge-red'    },
    unknown:  { label: 'Desconocido', cls: 'badge-gray' },
  }
  return map[state] || map.unknown
}

// Rol → etiqueta
export function roleLabel(role) {
  const map = { admin: 'Administrador', teacher: 'Profesor', parent: 'Padre/Tutor' }
  return map[role] || role
}

// Rol → badge class
export function roleBadge(role) {
  const map = { admin: 'badge-red', teacher: 'badge-blue', parent: 'badge-green' }
  return map[role] || 'badge-gray'
}
