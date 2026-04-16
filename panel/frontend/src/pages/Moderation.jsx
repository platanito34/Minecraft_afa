import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ShieldExclamationIcon, BoltIcon, NoSymbolIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import api from '../services/api'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ChatMonitor from '../components/moderation/ChatMonitor'
import { format } from 'date-fns'

function SanctionModal({ open, onClose, type, players, servers, onDone }) {
  const { t } = useTranslation()
  const [playerId, setPlayerId] = useState('')
  const [serverId, setServerId] = useState('')
  const [reason, setReason]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const endpoint = type === 'kick' ? '/moderation/kick'
    : type === 'ban' ? '/moderation/ban' : '/moderation/unban'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post(endpoint, { player_id: parseInt(playerId), server_id: parseInt(serverId), reason })
      onDone()
      onClose()
      setPlayerId(''); setServerId(''); setReason('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setSaving(false)
    }
  }

  const titles = { kick: t('moderation.kick'), ban: t('moderation.ban'), unban: t('moderation.unban') }

  return (
    <Modal open={open} onClose={onClose} title={titles[type]} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Jugador</label>
          <select className="input" required value={playerId}
            onChange={e => setPlayerId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Servidor</label>
          <select className="input" required value={serverId}
            onChange={e => setServerId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {type !== 'unban' && (
          <div>
            <label className="label">{t('moderation.reason')}</label>
            <input className="input" value={reason}
              onChange={e => setReason(e.target.value)} />
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" disabled={saving}
            className={type === 'kick' || type === 'ban' ? 'btn-danger flex-1' : 'btn-primary flex-1'}>
            {saving ? '...' : titles[type]}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Moderation() {
  const { t } = useTranslation()
  const [players, setPlayers]     = useState([])
  const [servers, setServers]     = useState([])
  const [sanctions, setSanctions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null) // 'kick'|'ban'|'unban'
  const [selServer, setSelServer] = useState('')

  const load = async () => {
    try {
      const [pRes, sRes, sanRes] = await Promise.all([
        api.get('/players'),
        api.get('/servers'),
        api.get('/moderation/sanctions?limit=50'),
      ])
      setPlayers(pRes.data)
      setServers(sRes.data)
      setSanctions(sanRes.data)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const typeIcon = { kick: BoltIcon, ban: NoSymbolIcon, unban: CheckCircleIcon, warn: ShieldExclamationIcon }
  const typeColor = { kick: 'text-yellow-500', ban: 'text-red-500', unban: 'text-green-500', warn: 'text-blue-500' }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('moderation.title')}</h1>

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setModal('kick')} className="btn-secondary">
          <BoltIcon className="h-4 w-4 text-yellow-500" />
          {t('moderation.kick')}
        </button>
        <button onClick={() => setModal('ban')} className="btn-danger">
          <NoSymbolIcon className="h-4 w-4" />
          {t('moderation.ban')}
        </button>
        <button onClick={() => setModal('unban')} className="btn-secondary">
          <CheckCircleIcon className="h-4 w-4 text-green-500" />
          {t('moderation.unban')}
        </button>
      </div>

      {/* Chat en tiempo real */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('moderation.chat')}
          </h3>
          <select className="input w-auto text-xs py-1"
            value={selServer}
            onChange={e => setSelServer(e.target.value)}>
            <option value="">Todos los servidores</option>
            {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <ChatMonitor serverId={selServer ? parseInt(selServer) : null} />
      </div>

      {/* Historial de sanciones */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          {t('moderation.sanctions')}
        </h3>
        {sanctions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">{t('common.noData')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                  <th className="text-left py-2 px-3">Tipo</th>
                  <th className="text-left py-2 px-3">Jugador</th>
                  <th className="text-left py-2 px-3">Motivo</th>
                  <th className="text-left py-2 px-3">Por</th>
                  <th className="text-left py-2 px-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sanctions.map(s => {
                  const Icon = typeIcon[s.type] || ShieldExclamationIcon
                  const color = typeColor[s.type] || 'text-gray-500'
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2.5 px-3">
                        <span className={`flex items-center gap-1 font-medium ${color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {t(`moderation.${s.type}`) || s.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300">{s.player_name}</td>
                      <td className="py-2.5 px-3 text-gray-500 max-w-xs truncate">{s.reason || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{s.issued_by_name || 'Sistema'}</td>
                      <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                        {format(new Date(s.issued_at), 'dd/MM/yy HH:mm')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {modal && (
        <SanctionModal
          open={!!modal}
          onClose={() => setModal(null)}
          type={modal}
          players={players}
          servers={servers}
          onDone={load}
        />
      )}
    </div>
  )
}
