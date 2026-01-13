import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { X, Save, FolderKanban } from 'lucide-react'

export default function ProjectFormModal({ project, onClose, onSuccess }) {
  const { t } = useTranslation()
  const { createProject, updateProject } = useProject()
  const isEditing = !!project

  const [formData, setFormData] = useState({
    code: project?.code || '',
    name: project?.name || '',
    client: project?.client || '',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    daily_hours: project?.daily_hours || 8,
    default_language: project?.default_language || 'IT',
    status: project?.status || 'active',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!formData.code || !formData.name || !formData.client || !formData.start_date || !formData.end_date) {
      setError('Compila tutti i campi obbligatori')
      setLoading(false)
      return
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      setError('La data fine deve essere successiva alla data inizio')
      setLoading(false)
      return
    }

    try {
      let result
      if (isEditing) {
        result = await updateProject(project.id, formData)
      } else {
        result = await createProject(formData)
      }

      if (result.error) {
        setError(result.error)
      } else {
        onSuccess(result.data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FolderKanban className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-gray-800">
              {isEditing ? 'Modifica Progetto' : 'Nuovo Progetto'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-light text-danger rounded-lg">
              {error}
            </div>
          )}

          {/* Code & Name Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Codice Progetto <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="es. PRJ-001"
                className="input"
                required
                disabled={isEditing} // Code non modificabile dopo creazione
              />
              {isEditing && (
                <p className="text-xs text-gray-500 mt-1">Il codice non può essere modificato</p>
              )}
            </div>
            <div>
              <label className="label">
                Nome Progetto <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="es. Centrale Gas Parma"
                className="input"
                required
              />
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="label">
              Cliente <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="client"
              value={formData.client}
              onChange={handleChange}
              placeholder="es. Snam Rete Gas S.p.A."
              className="input"
              required
            />
          </div>

          {/* Dates Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Data Inizio <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">
                Data Fine <span className="text-danger">*</span>
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
          </div>

          {/* Settings Row */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">Ore Giornaliere</label>
              <select
                name="daily_hours"
                value={formData.daily_hours}
                onChange={handleChange}
                className="select"
              >
                <option value={6}>6 ore</option>
                <option value={7}>7 ore</option>
                <option value={8}>8 ore</option>
                <option value={9}>9 ore</option>
                <option value={10}>10 ore</option>
                <option value={11}>11 ore</option>
                <option value={12}>12 ore</option>
              </select>
            </div>
            <div>
              <label className="label">Lingua Default</label>
              <select
                name="default_language"
                value={formData.default_language}
                onChange={handleChange}
                className="select"
              >
                <option value="IT">🇮🇹 Italiano</option>
                <option value="EN">🇬🇧 English</option>
              </select>
            </div>
            <div>
              <label className="label">Stato</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select"
              >
                <option value="active">✅ Attivo</option>
                <option value="suspended">⏸️ Sospeso</option>
                <option value="closed">🔒 Chiuso</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button 
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Annulla
            </button>
            <button 
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                'Salvataggio...'
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  {isEditing ? 'Salva Modifiche' : 'Crea Progetto'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
