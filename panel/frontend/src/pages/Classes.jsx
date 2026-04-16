import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { PlusIcon, UserPlusIcon, TrashIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import api from '../services/api'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'

function AddClassModal({ open, onClose, onAdded, teachers }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [form, setForm]   = useState({ name: '', description: '', teacher_id: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/classes', form)
      onAdded()
      onClose()
      setForm({ name: '', description: '', teacher_id: '' })
    } catch (err) {
      setError(err.response?.data?.error || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('classes.addClass')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{t('common.name')} *</label>
          <input className="input" required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea className="input resize-none" rows={2} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        {user?.role === 'admin' && teachers.length > 0 && (
          <div>
            <label className="label">{t('classes.teacher')}</label>
            <select className="input" value={form.teacher_id}
              onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
              <option value="">Sin asignar</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
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

function AddStudentModal({ open, onClose, classId, onAdded, existingPlayerIds }) {
  const [allPlayers, setAllPlayers] = useState([])
  const [playerId, setPlayerId]     = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (!open) return
    api.get('/players').then(r => setAllPlayers(r.data)).catch(() => {})
  }, [open])

  const available = allPlayers.filter(p => !existingPlayerIds.includes(p.id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!playerId) return
    setSaving(true)
    try {
      await api.post(`/classes/${classId}/players`, { player_id: parseInt(playerId) })
      onAdded()
      onClose()
      setPlayerId('')
    } catch {
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Añadir alumno" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Seleccionar jugador</label>
          <select className="input" required value={playerId}
            onChange={e => setPlayerId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {available.map(p => (
              <option key={p.id} value={p.id}>{p.username}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={saving || !playerId} className="btn-primary flex-1">
            {saving ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Classes() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [classes, setClasses]         = useState([])
  const [teachers, setTeachers]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [addStudentCls, setAddStudent] = useState(null)
  const canEdit = ['admin', 'teacher'].includes(user?.role)

  const load = async () => {
    try {
      const [cRes] = await Promise.all([api.get('/classes')])
      setClasses(cRes.data)
      if (user?.role === 'admin') {
        const uRes = await api.get('/users')
        setTeachers(uRes.data.filter(u => u.role === 'teacher'))
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const removeStudent = async (classId, playerId) => {
    await api.delete(`/classes/${classId}/players/${playerId}`)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('classes.title')}</h1>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            {t('classes.addClass')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : classes.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">{t('classes.noClasses')}</div>
      ) : (
        <div className="space-y-4">
          {classes.map(cls => (
            <div key={cls.id} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <AcademicCapIcon className="h-5 w-5 text-primary-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cls.name}</h3>
                    {cls.teacher_name && (
                      <p className="text-xs text-gray-400">{t('classes.teacher')}: {cls.teacher_name}</p>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => setAddStudent(cls)}
                    className="btn-secondary text-xs py-1.5"
                  >
                    <UserPlusIcon className="h-3.5 w-3.5" />
                    {t('classes.addStudent')}
                  </button>
                )}
              </div>

              {cls.players?.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Sin alumnos</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(cls.players || []).map(p => (
                    <div key={p.id}
                      className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800
                                 rounded-full px-3 py-1 text-sm">
                      <span className="text-gray-700 dark:text-gray-200">{p.username}</span>
                      {canEdit && (
                        <button
                          onClick={() => removeStudent(cls.id, p.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddClassModal
        open={showAdd} onClose={() => setShowAdd(false)}
        onAdded={load} teachers={teachers}
      />
      {addStudentCls && (
        <AddStudentModal
          open={!!addStudentCls}
          onClose={() => setAddStudent(null)}
          classId={addStudentCls.id}
          existingPlayerIds={(addStudentCls.players || []).map(p => p.id)}
          onAdded={() => { load(); setAddStudent(null) }}
        />
      )}
    </div>
  )
}
