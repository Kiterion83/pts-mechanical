import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import ProjectFormModal from '../components/ProjectFormModal'
import { 
  FolderKanban, 
  Calendar, 
  CheckCircle2, 
  Clock,
  Building2,
  ChevronRight,
  Search,
  Plus
} from 'lucide-react'

export default function Projects() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { projects, activeProject, selectProject, loading } = useProject()
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="badge-success">{t('status.active')}</span>
      case 'suspended':
        return <span className="badge-warning">{t('status.suspended')}</span>
      case 'closed':
        return <span className="badge-info">{t('status.closed')}</span>
      default:
        return null
    }
  }

  const getRoleBadge = (role) => {
    const roleColors = {
      admin: 'bg-purple-100 text-purple-800',
      pm: 'bg-blue-100 text-blue-800',
      site_manager: 'bg-indigo-100 text-indigo-800',
      cm: 'bg-blue-100 text-blue-800',
      pem: 'bg-teal-100 text-teal-800',
      engineer: 'bg-cyan-100 text-cyan-800',
      planner: 'bg-orange-100 text-orange-800',
      supervisor: 'bg-green-100 text-green-800',
      foreman: 'bg-yellow-100 text-yellow-800',
      storekeeper: 'bg-gray-100 text-gray-800',
    }

    return (
      <span className={`badge ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>
        {t(`roles.${role}`) || role}
      </span>
    )
  }

  // Click su card -> vai al dettaglio
  const handleProjectClick = (project) => {
    // Prima seleziona come attivo
    selectProject(project)
    // Poi naviga al dettaglio
    navigate(`/settings/projects/${project.id}`)
  }

  const handleProjectCreated = () => {
    setShowNewProjectModal(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 spinner border-4"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FolderKanban className="text-primary" />
            {t('project.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {projects.length} {t('project.available')}
          </p>
        </div>
        
        <div className="flex gap-3">
          {/* Search */}
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
          
          {/* New Project Button */}
          <button 
            onClick={() => setShowNewProjectModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">{t('project.newProject')}</span>
          </button>
        </div>
      </div>

      {/* Active Project Banner */}
      {activeProject && (
        <div 
          className="bg-primary text-white rounded-xl p-4 shadow-lg cursor-pointer hover:bg-primary-light transition"
          onClick={() => navigate(`/settings/projects/${activeProject.id}`)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">{t('project.activeProject')}</p>
              <p className="text-xl font-bold">{activeProject.name}</p>
              <p className="text-blue-200">{activeProject.code} • {activeProject.client}</p>
            </div>
            <CheckCircle2 size={40} className="text-blue-200" />
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="card text-center py-12">
          <FolderKanban size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">
            {searchTerm ? t('common.noData') : t('common.noData')}
          </p>
          <button 
            onClick={() => setShowNewProjectModal(true)}
            className="btn-primary"
          >
            <Plus size={20} className="mr-2" />
            {t('project.newProject')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className={`card cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${
                activeProject?.id === project.id 
                  ? 'ring-2 ring-primary border-primary' 
                  : 'hover:border-gray-300'
              }`}
            >
              {/* Project Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">{project.code}</span>
                    {getStatusBadge(project.status)}
                  </div>
                  <h3 className="font-semibold text-gray-800 truncate">{project.name}</h3>
                </div>
                {activeProject?.id === project.id && (
                  <CheckCircle2 className="text-primary flex-shrink-0 ml-2" size={24} />
                )}
              </div>

              {/* Project Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 size={16} className="text-gray-400 flex-shrink-0" />
                  <span className="truncate">{project.client}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                  <span>{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={16} className="text-gray-400 flex-shrink-0" />
                  <span>{project.daily_hours}h/{t('common.date').toLowerCase()}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                {getRoleBadge(project.userRole)}
                <ChevronRight size={20} className="text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="text-center text-sm text-gray-500">
        💡 {t('project.clickToSelect')}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <ProjectFormModal
          onClose={() => setShowNewProjectModal(false)}
          onSuccess={handleProjectCreated}
        />
      )}
    </div>
  )
}
