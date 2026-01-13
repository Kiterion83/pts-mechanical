import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'
import ProjectFormModal from '../components/ProjectFormModal'
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar,
  Clock,
  Building2,
  Users,
  FolderKanban,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { projects, activeProject, selectProject, deleteProject, refreshProjects } = useProject()
  
  const [project, setProject] = useState(null)
  const [holidays, setHolidays] = useState([])
  const [stats, setStats] = useState({ personnel: 0, squads: 0, areas: 0 })
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // New holiday form
  const [newHoliday, setNewHoliday] = useState({ date: '', description: '' })
  const [addingHoliday, setAddingHoliday] = useState(false)

  useEffect(() => {
    loadProjectData()
  }, [id])

  const loadProjectData = async () => {
    try {
      setLoading(true)

      // Find project from context first
      const contextProject = projects.find(p => p.id === id)
      if (contextProject) {
        setProject(contextProject)
      } else {
        // Load from DB
        const { data: projectData } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single()
        setProject(projectData)
      }

      // Load holidays
      const { data: holidaysData } = await supabase
        .from('project_holidays')
        .select('*')
        .eq('project_id', id)
        .order('holiday_date')
      setHolidays(holidaysData || [])

      // Load stats
      const { count: personnelCount } = await supabase
        .from('personnel')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)
        .eq('status', 'active')

      const { count: squadsCount } = await supabase
        .from('squads')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)
        .eq('status', 'active')

      const { count: areasCount } = await supabase
        .from('areas')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id)

      setStats({
        personnel: personnelCount || 0,
        squads: squadsCount || 0,
        areas: areasCount || 0
      })

    } catch (err) {
      console.error('Error loading project:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddHoliday = async (e) => {
    e.preventDefault()
    if (!newHoliday.date) return

    setAddingHoliday(true)
    try {
      const { error } = await supabase
        .from('project_holidays')
        .insert([{
          project_id: id,
          holiday_date: newHoliday.date,
          description: newHoliday.description || null
        }])

      if (error) throw error

      // Reload holidays
      const { data } = await supabase
        .from('project_holidays')
        .select('*')
        .eq('project_id', id)
        .order('holiday_date')
      setHolidays(data || [])
      
      setNewHoliday({ date: '', description: '' })
    } catch (err) {
      console.error('Error adding holiday:', err)
      alert('Errore: ' + err.message)
    } finally {
      setAddingHoliday(false)
    }
  }

  const handleDeleteHoliday = async (holidayId) => {
    if (!confirm('Eliminare questa festività?')) return

    try {
      const { error } = await supabase
        .from('project_holidays')
        .delete()
        .eq('id', holidayId)

      if (error) throw error

      setHolidays(holidays.filter(h => h.id !== holidayId))
    } catch (err) {
      console.error('Error deleting holiday:', err)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await deleteProject(id)
    if (error) {
      alert('Errore durante l\'eliminazione: ' + error)
      setDeleting(false)
    } else {
      navigate('/projects')
    }
  }

  const handleProjectUpdated = () => {
    setShowEditModal(false)
    loadProjectData()
    refreshProjects()
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateShort = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 spinner border-4"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <FolderKanban size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">Progetto non trovato</p>
        <button onClick={() => navigate('/projects')} className="btn-primary mt-4">
          Torna ai Progetti
        </button>
      </div>
    )
  }

  const isActive = activeProject?.id === project.id

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/projects')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-500">{project.code}</span>
              {isActive && (
                <span className="badge-success flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Attivo
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
          </div>
        </div>
        
        <div className="flex gap-2">
          {!isActive && (
            <button 
              onClick={() => { selectProject(project); navigate('/'); }}
              className="btn-primary"
            >
              <CheckCircle2 size={18} className="mr-2" />
              Imposta Attivo
            </button>
          )}
          <button 
            onClick={() => setShowEditModal(true)}
            className="btn-secondary"
          >
            <Edit size={18} className="mr-2" />
            Modifica
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Project Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Informazioni Progetto
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <InfoItem 
                icon={Building2} 
                label="Cliente" 
                value={project.client} 
              />
              <InfoItem 
                icon={Calendar} 
                label="Data Inizio" 
                value={formatDateShort(project.start_date)} 
              />
              <InfoItem 
                icon={Calendar} 
                label="Data Fine" 
                value={formatDateShort(project.end_date)} 
              />
              <InfoItem 
                icon={Clock} 
                label="Ore Giornaliere" 
                value={`${project.daily_hours} ore`} 
              />
              <InfoItem 
                icon={FolderKanban} 
                label="Stato" 
                value={project.status === 'active' ? 'Attivo' : project.status === 'suspended' ? 'Sospeso' : 'Chiuso'} 
              />
              <InfoItem 
                icon={FolderKanban} 
                label="Lingua Default" 
                value={project.default_language === 'IT' ? '🇮🇹 Italiano' : '🇬🇧 English'} 
              />
            </div>
          </div>

          {/* Holidays Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="text-primary" />
              Festività Progetto ({holidays.length})
            </h2>
            
            {/* Add Holiday Form */}
            <form onSubmit={handleAddHoliday} className="flex gap-3 mb-4">
              <input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                className="input flex-shrink-0"
                required
              />
              <input
                type="text"
                value={newHoliday.description}
                onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                placeholder="Descrizione (opzionale)"
                className="input flex-1"
              />
              <button 
                type="submit" 
                disabled={addingHoliday || !newHoliday.date}
                className="btn-primary flex-shrink-0"
              >
                <Plus size={18} />
              </button>
            </form>

            {/* Holidays List */}
            {holidays.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Nessuna festività configurata
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {holidays.map((holiday) => (
                  <div 
                    key={holiday.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{formatDate(holiday.holiday_date)}</p>
                      {holiday.description && (
                        <p className="text-sm text-gray-500">{holiday.description}</p>
                      )}
                    </div>
                    <button 
                      onClick={() => handleDeleteHoliday(holiday.id)}
                      className="p-2 text-gray-400 hover:text-danger hover:bg-danger-light rounded-lg transition"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Statistiche</h3>
            <div className="space-y-3">
              <StatItem icon={Users} label="Personale" value={stats.personnel} />
              <StatItem icon={Users} label="Squadre" value={stats.squads} />
              <StatItem icon={FolderKanban} label="Aree" value={stats.areas} />
            </div>
          </div>

          <div className="card bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-800 mb-2">Ruolo</h3>
            <p className="text-blue-600 text-lg font-bold uppercase">
              {project.userRole || 'Admin'}
            </p>
          </div>

          {isActive && (
            <div className="card bg-green-50 border-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 size={20} />
                <span className="font-semibold">Progetto Attivo</span>
              </div>
              <p className="text-green-600 text-sm mt-1">
                Questo è il progetto su cui stai lavorando
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <ProjectFormModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleProjectUpdated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-danger mb-4">
              <AlertTriangle size={32} />
              <h2 className="text-xl font-bold">Elimina Progetto</h2>
            </div>
            
            <p className="text-gray-600 mb-2">
              Sei sicuro di voler eliminare <strong>{project.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Questa azione eliminerà anche tutte le festività, ruoli utente e altri dati associati.
              L'azione non può essere annullata.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
                disabled={deleting}
              >
                Annulla
              </button>
              <button 
                onClick={handleDelete}
                className="btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Eliminazione...' : 'Elimina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper Components
function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon size={20} className="text-gray-400" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-800">{value}</p>
      </div>
    </div>
  )
}

function StatItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-600">
        <Icon size={18} />
        <span>{label}</span>
      </div>
      <span className="font-bold text-gray-800">{value}</span>
    </div>
  )
}
