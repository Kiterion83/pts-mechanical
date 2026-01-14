import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { X, Save, FolderKanban, Calendar } from 'lucide-react'

export default function ProjectFormModal({ project, onClose, onSuccess }) {
  const { t } = useTranslation()
  const { createProject, updateProject } = useProject()
  const isEditing = !!project

  // Default working days configuration
  const defaultWorkingDays = {
    mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false
  }

  const [formData, setFormData] = useState({
    code: project?.code || '',
    name: project?.name || '',
    client: project?.client || '',
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
    daily_hours: project?.daily_hours || 8,
    working_days: project?.working_days || defaultWorkingDays,
    working_hours_start: project?.working_hours_start || '08:00',
    working_hours_end: project?.working_hours_end || '17:00',
    default_language: project?.default_language || 'IT',
    status: project?.status || 'active',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Day labels in Italian
  const dayLabels = {
    mon: { short: 'Lun', full: 'Lunedì' },
    tue: { short: 'Mar', full: 'Martedì' },
    wed: { short: 'Mer', full: 'Mercoledì' },
    thu: { short: 'Gio', full: 'Giovedì' },
    fri: { short: 'Ven', full: 'Venerdì' },
    sat: { short: 'Sab', full: 'Sabato' },
    sun: { short: 'Dom', full: 'Domenica' }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      working_days: {
        ...prev.working_days,
        [day]: !prev.working_days[day]
      }
    }))
  }

  // Calculate working days count
  const workingDaysCount = Object.values(formData.working_days).filter(Boolean).length
  const weeklyHours = workingDaysCount * Number(formData.daily_hours)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!formData.code || !formData.name || !formData.client || !formData.start_date || !formData.end_date) {
      setError(t('errors.validation'))
      setLoading(false)
      return
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      setError(t('errors.endDateBeforeStart'))
      setLoading(false)
      return
    }

    if (workingDaysCount === 0) {
      setError('Seleziona almeno un giorno lavorativo')
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
              {isEditing ? t('project.editProject') : t('project.newProject')}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-danger-light text-danger rounded-lg">
              {error}
            </div>
          )}

          {/* Code & Name Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                {t('project.projectCode')} <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="es. PRJ-001"
                className="input"
                required
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs text-gray-500 mt-1">{t('project.codeNotEditable')}</p>
              )}
            </div>
            <div>
              <label className="label">
                {t('project.projectName')} <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder={t('project.projectName')}
                className="input"
                required
              />
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="label">
              {t('project.client')} <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="client"
              value={formData.client}
              onChange={handleChange}
              placeholder={t('project.client')}
              className="input"
              required
            />
          </div>

          {/* Dates Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                {t('project.startDate')} <span className="text-danger">*</span>
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
                {t('project.endDate')} <span className="text-danger">*</span>
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

          {/* ============================================ */}
          {/* WORKING DAYS SECTION */}
          {/* ============================================ */}
          <div className="border-t border-b border-gray-200 py-5 my-2">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-primary" />
              <h3 className="font-semibold text-gray-800">Giorni Lavorativi</h3>
            </div>

            {/* Day Toggles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(dayLabels).map(([key, labels]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDayToggle(key)}
                  className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    formData.working_days[key]
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  title={labels.full}
                >
                  {labels.short}
                </button>
              ))}
            </div>

            {/* Hours Configuration */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label text-sm">Ore/Giorno</label>
                <select
                  name="daily_hours"
                  value={formData.daily_hours}
                  onChange={handleChange}
                  className="select"
                >
                  {[6, 7, 8, 9, 10, 11, 12].map(h => (
                    <option key={h} value={h}>{h} ore</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-sm">Inizio Lavoro</label>
                <input
                  type="time"
                  name="working_hours_start"
                  value={formData.working_hours_start}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="label text-sm">Fine Lavoro</label>
                <input
                  type="time"
                  name="working_hours_end"
                  value={formData.working_hours_end}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            {/* Weekly Summary */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">📅 Giorni/Settimana:</span>
                  <span className="font-bold text-blue-800">{workingDaysCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">⏱️ Ore/Settimana:</span>
                  <span className="font-bold text-blue-800">{weeklyHours}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">🕐 Orario:</span>
                  <span className="font-bold text-blue-800">
                    {formData.working_hours_start} - {formData.working_hours_end}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Row - Language & Status */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('project.defaultLanguage')}</label>
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
              <label className="label">{t('common.status')}</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select"
              >
                <option value="active">✅ {t('status.active')}</option>
                <option value="suspended">⏸️ {t('status.suspended')}</option>
                <option value="closed">🔒 {t('status.closed')}</option>
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
              {t('common.cancel')}
            </button>
            <button 
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                t('common.saving')
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  {isEditing ? t('common.save') : t('project.newProject')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
