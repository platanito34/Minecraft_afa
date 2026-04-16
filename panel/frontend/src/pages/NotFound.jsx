import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-panel dark:bg-panel-dark">
      <p className="text-6xl font-black text-gray-200 dark:text-gray-800">404</p>
      <h1 className="mt-2 text-xl font-semibold text-gray-700 dark:text-gray-300">Página no encontrada</h1>
      <p className="mt-2 text-sm text-gray-500">La página que buscas no existe.</p>
      <Link to="/dashboard" className="btn-primary mt-6">Volver al panel</Link>
    </div>
  )
}
