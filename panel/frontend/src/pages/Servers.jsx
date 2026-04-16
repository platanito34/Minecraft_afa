import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { PlusIcon, ArrowPathIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import api from '../services/api'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ServerCard from '../components/servers/ServerCard'

function AddServerModal({ open, onClose, onAdded }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: '', pterodactyl_server_id: '', rcon_host: '',
    rcon_port: '25575', rcon_password: '', description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/servers', { ...form, rcon_port: parseInt(form.rcon_port) || 25575 })
      onAdded()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setSaving(false)
    }
  }

  const field = (key, label, type = 'text', props = {}) => (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} {...props} />
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('servers.addServer')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {field('name', t('common.name'), 'text', { required: true })}
        {field('pterodactyl_server_id', 'ID en Pterodactyl (UUID o identifier)')}
        {field('description', 'Descripción')}
        <hr className="border-gray-200 dark:border-gray-700" />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">RCON</p>
        {field('rcon_host', 'Host RCON', 'text', { placeholder: 'localhost' })}
        {field('rcon_port', 'Puerto RCON', 'number')}
        {field('rcon_password', 'Contraseña RCON', 'password')}
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

function EditServerModal({ open, onClose, server, onSaved }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: '', pterodactyl_server_id: '', rcon_host: '',
    rcon_port: '25575', rcon_password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (server) {
      setForm({
        name:                  server.name || '',
        pterodactyl_server_id: server.pterodactyl_server_id || '',
        rcon_host:             server.rcon_host || '',
        rcon_port:             String(server.rcon_port || 25575),
        rcon_password:         '',
      })
      setError('')
    }
  }, [server])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put(`/servers/${server.id}`, { ...form, rcon_port: parseInt(form.rcon_port) || 25575 })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const field = (key, label, type = 'text', props = {}) => (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} {...props} />
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title="Editar servidor" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {field('name', t('common.name'), 'text', { required: true })}
        {field('pterodactyl_server_id', 'ID en Pterodactyl (UUID o identifier)')}
        <hr className="border-gray-200 dark:border-gray-700" />
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">RCON</p>
        {field('rcon_host', 'Host RCON', 'text', { placeholder: 'localhost' })}
        {field('rcon_port', 'Puerto RCON', 'number')}
        {field('rcon_password', 'Contraseña RCON (dejar vacío para no cambiar)', 'password')}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Servers() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [servers, setServers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editServer, setEditServer] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const { data } = await api.get('/servers')
      setServers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Refrescar estado cada 30s
    const interval = setInterval(() => load(true), 30000)
    return () => clearInterval(interval)
  }, [load])

  const canAdd = user?.role === 'admin'

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('servers.title')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => load(true)} disabled={refreshing} className="btn-ghost p-2">
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {canAdd && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <PlusIcon className="h-4 w-4" />
              {t('servers.addServer')}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : servers.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">{t('servers.noServers')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              onRefresh={() => load(true)}
              onEdit={canAdd ? () => setEditServer(server) : null}
            />
          ))}
        </div>
      )}

      <AddServerModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => load()} />
      <EditServerModal
        open={!!editServer}
        onClose={() => setEditServer(null)}
        server={editServer}
        onSaved={() => load()}
      />
    </div>
  )
}
