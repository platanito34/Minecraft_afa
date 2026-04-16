import clsx from 'clsx'

export default function LoadingSpinner({ fullscreen, size = 'md', className }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }

  const spinner = (
    <div className={clsx(
      'animate-spin rounded-full border-t-2 border-b-2 border-primary-500',
      sizes[size], className
    )} />
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-panel dark:bg-panel-dark z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}
