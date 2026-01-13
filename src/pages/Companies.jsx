import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  X,
  Save,
  Star,
  Phone,
  Mail,
  User,
  Search
} from 'lucide-react'

export default function Companies() {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (activeProject) {
      loadCompanies()
    }
  }, [activeProject])

  const loadCompanies = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('project_id', activeProject.id)
        .order('is_main', { ascending: false })
        .order('company_name')

      if (error) throw error
      setCompanies(data || [])
    } catch (err) {
      console.error('Error loading companies:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (company) => {
    setEditingCompany(company)
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingCompany(null)
    setShowModal(true)
  }

  const handleDelete = async (company) => {
    if (!confirm(`${t('common.delete')} ${company.company_name}?`)) return

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id)

      if (error) throw error
      loadCompanies()
    } catch (err) {
      console.error('Error deleting company:', err)
      alert('Error: ' + err.message)
    }
  }

  const handleSave = async (formData) => {
    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update(formData)
          .eq('id', editingCompany.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('companies')
          .insert([{ ...formData, project_id: activeProject.id }])
        if (error) throw error
      }
      setShowModal(false)
      loadCompanies()
    } catch (err) {
      console.error('Error saving company:', err)
      throw err
    }
  }

  const filteredCompanies = companies.filter(c =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const mainCompany = companies.find(c => c.is_main)
  const subcontractors = filteredCompanies.filter(c => !c.is_main)

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Building2 size={64} className="text-gray-300 mb-4" />
        <p className="text-gray-500">{t('common.noData')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="text-primary" />
            {t('company.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {activeProject.name}
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder={t('common.search') + '...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full sm:w-64"
            />
          </div>
          
          <button onClick={handleNew} className="btn-primary flex items-center gap-2">
            <Plus size={20} />
            <span className="hidden sm:inline">{t('company.newCompany')}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 spinner border-4"></div>
        </div>
      ) : (
        <>
          {/* Main Company */}
          {mainCompany && (
            <div className="card bg-gradient-to-r from-primary to-primary-light text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={20} className="text-yellow-300" />
                    <span className="text-blue-200 text-sm font-medium uppercase">
                      {t('company.mainCompany')}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">{mainCompany.company_name}</h3>
                  
                  <div className="mt-4 space-y-1 text-sm text-blue-100">
                    {mainCompany.vat_number && (
                      <p>P.IVA: {mainCompany.vat_number}</p>
                    )}
                    {mainCompany.contact_person && (
                      <p className="flex items-center gap-2">
                        <User size={14} /> {mainCompany.contact_person}
                      </p>
                    )}
                    {mainCompany.phone && (
                      <p className="flex items-center gap-2">
                        <Phone size={14} /> {mainCompany.phone}
                      </p>
                    )}
                    {mainCompany.email && (
                      <p className="flex items-center gap-2">
                        <Mail size={14} /> {mainCompany.email}
                      </p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => handleEdit(mainCompany)}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
                >
                  <Edit size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Subcontractors */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {t('company.subcontractor')} ({subcontractors.length})
            </h2>

            {subcontractors.length === 0 && !mainCompany ? (
              <div className="card text-center py-8">
                <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">{t('company.noCompanies')}</p>
              </div>
            ) : subcontractors.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-gray-500">Nessun subappaltatore registrato</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {subcontractors.map(company => (
                  <div key={company.id} className="card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-800">{company.company_name}</h3>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleEdit(company)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                          <Edit size={16} className="text-gray-500" />
                        </button>
                        <button 
                          onClick={() => handleDelete(company)}
                          className="p-2 hover:bg-danger-light rounded-lg transition"
                        >
                          <Trash2 size={16} className="text-danger" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      {company.vat_number && (
                        <p>P.IVA: {company.vat_number}</p>
                      )}
                      {company.contact_person && (
                        <p className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" /> {company.contact_person}
                        </p>
                      )}
                      {company.phone && (
                        <p className="flex items-center gap-2">
                          <Phone size={14} className="text-gray-400" /> {company.phone}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <CompanyFormModal
          company={editingCompany}
          hasMainCompany={!!mainCompany && (!editingCompany || !editingCompany.is_main)}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// Company Form Modal - SENZA CODICE
function CompanyFormModal({ company, hasMainCompany, onClose, onSave }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    company_name: company?.company_name || '',
    vat_number: company?.vat_number || '',
    contact_person: company?.contact_person || '',
    phone: company?.phone || '',
    email: company?.email || '',
    is_main: company?.is_main || false,
    status: company?.status || 'active',
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!formData.company_name.trim()) {
      setError(t('validation.required'))
      setLoading(false)
      return
    }

    try {
      await onSave(formData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Building2 className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-gray-800">
              {company ? t('company.editCompany') : t('company.newCompany')}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-light text-danger rounded-lg">{error}</div>
          )}

          <div>
            <label className="label">{t('company.companyName')} *</label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Es. Rossi Costruzioni S.r.l."
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">{t('company.vatNumber')}</label>
            <input
              type="text"
              name="vat_number"
              value={formData.vat_number}
              onChange={handleChange}
              placeholder="IT12345678901"
              className="input"
            />
          </div>

          <div>
            <label className="label">{t('company.contactPerson')}</label>
            <input
              type="text"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              placeholder="Mario Rossi"
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('company.phone')}</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+39 333 1234567"
                className="input"
              />
            </div>
            <div>
              <label className="label">{t('company.email')}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="info@azienda.it"
                className="input"
              />
            </div>
          </div>

          {/* Is Main checkbox */}
          {(!hasMainCompany || company?.is_main) && (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
              <input
                type="checkbox"
                name="is_main"
                id="is_main"
                checked={formData.is_main}
                onChange={handleChange}
                className="w-5 h-5"
              />
              <div>
                <label htmlFor="is_main" className="font-medium text-gray-800 cursor-pointer">
                  {t('company.isMain')}
                </label>
                <p className="text-sm text-gray-500">{t('company.isMainHelp')}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('common.saving') : (
                <>
                  <Save size={18} className="mr-2" />
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
