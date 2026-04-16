import clsx from 'clsx'

export default function Badge({ children, color = 'gray', className }) {
  const colors = {
    green:  'badge-green',
    red:    'badge-red',
    yellow: 'badge-yellow',
    blue:   'badge-blue',
    gray:   'badge-gray',
  }
  return (
    <span className={clsx(colors[color] || 'badge-gray', className)}>
      {children}
    </span>
  )
}
