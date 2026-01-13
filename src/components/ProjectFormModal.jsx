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
      setError(t('errors.validation'))
      setLoading(false)
      return
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      setError(t('errors.endDateBeforeStart'))
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

          {/* Settings Row */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="label">{t('project.dailyHours')}</label>
              <select
                name="daily_hours"
                value={formData.daily_hours}
                onChange={handleChange}
                className="select"
              >
                <option value={6}>6 {t('dailyReport.hours').toLowerCase()}</option>
                <option value={7}>7 {t('dailyReport.hours').toLowerCase()}</option>
                <option value={8}>8 {t('dailyReport.hours').toLowerCase()}</option>
                <option value={9}>9 {t('dailyReport.hours').toLowerCase()}</option>
                <option value={10}>10 {t('dailyReport.hours').toLowerCase()}</option>
                <option value={11}>11 {t('dailyReport.hours').toLowerCase()}</option>
                <option value={12}>12 {t('dailyReport.hours').toLowerCase()}</option>
              </select>
            </div>
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
