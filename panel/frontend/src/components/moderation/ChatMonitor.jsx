import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getSocket } from '../../services/socket'
import api from '../../services/api'
import { format } from 'date-fns'

export default function ChatMonitor({ serverId }) {
  const { t } = useTranslation()
  const [messages, setMessages]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [command, setCommand]         = useState('')
  const [sending, setSending]         = useState(false)
  const [cmdResponse, setCmdResponse] = useState('')
  const bottomRef = useRef(null)

  // Cargar historial
  useEffect(() => {
    const params = serverId ? `?server_id=${serverId}&limit=100` : '?limit=100'
    api.get(`/moderation/chat${params}`)
      .then(r => setMessages(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [serverId])

  // Escuchar nuevos mensajes via socket
  useEffect(() => {
    const socket = getSocket()
    const handler = (msg) => {
      if (!serverId || msg.server_id === serverId) {
        setMessages(prev => [...prev.slice(-199), msg])
      }
    }
    socket.on('chat:message', handler)
    return () => socket.off('chat:message', handler)
  }, [serverId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendCommand = async (e) => {
    e.preventDefault()
    if (!command.trim() || !serverId) return
    setSending(true)
    setCmdResponse('')
    try {
      const { data } = await api.post('/moderation/command', {
        server_id: serverId,
        command: command.trim(),
      })
      setCmdResponse(data.response)
      setCommand('')
    } catch (err) {
      setCmdResponse(err.response?.data?.error || 'Error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto bg-gray-950 rounded-xl p-3 font-mono text-xs space-y-0.5 min-h-48">
        {loading ? (
          <p className="text-gray-500 text-center py-8">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('moderation.noMessages')}</p>
        ) : (
          messages.map((m, i) => (
            <div key={m.id || i} className="flex gap-2 hover:bg-white/5 px-1 py-0.5 rounded">
              <span className="text-gray-500 flex-shrink-0">
                {m.logged_at ? format(new Date(m.logged_at), 'HH:mm:ss') : '??:??:??'}
              </span>
              {m.username && (
                <span className="text-yellow-400 flex-shrink-0">&lt;{m.username}&gt;</span>
              )}
              <span className="text-gray-200 break-all">{m.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Consola de comandos */}
      {serverId && (
        <form onSubmit={sendCommand} className="mt-3">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-gray-950 border border-gray-700 rounded-lg px-3 gap-2">
              <span className="text-green-400 font-mono text-sm">&gt;</span>
              <input
                type="text"
                value={command}
                onChange={e => setCommand(e.target.value)}
                placeholder={t('moderation.command')}
                className="flex-1 bg-transparent font-mono text-sm text-gray-200 placeholder-gray-600
                           focus:outline-none py-2"
              />
            </div>
            <button type="submit" disabled={sending || !command.trim()} className="btn-primary px-4">
              {sending ? '...' : t('moderation.sendCommand')}
            </button>
          </div>
          {cmdResponse && (
            <p className="mt-1 text-xs font-mono text-green-400 px-1">{cmdResponse}</p>
          )}
        </form>
      )}
    </div>
  )
}
