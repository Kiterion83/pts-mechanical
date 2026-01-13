import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { 
  FolderKanban, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock,
  Building2,
  ChevronRight,
  Plus,
  Search
} from 'lucide-react'

export default function Projects() {
  const { t } = useTranslation()
  const { projects, activeProject, selectProject, loading } = useProject()
  const [searchTerm, setSearchTerm] = useState('')

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
        return <span className="badge-warning">Sospeso</span>
      case 'closed':
        return <span className="badge-info">Chiuso</span>
      default:
        return null
    }
  }

  const getRoleBadge = (role) => {
    const roleColors = {
      admin: 'bg-purple-100 text-purple-800',
      cm: 'bg-blue-100 text-blue-800',
      superintendent: 'bg-indigo-100 text-indigo-800',
      supervisor: 'bg-green-100 text-green-800',
      foreman: 'bg-yellow-100 text-yellow-800',
      storekeeper: 'bg-gray-100 text-gray-800',
    }
    
    const roleLabels = {
      admin: 'Admin',
      cm: 'CM',
      superintendent: 'Superintendent',
      supervisor: 'Supervisor',
      foreman: 'Foreman',
      storekeeper: 'Magazziniere',
    }

    return (
      <span className={`badge ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>
        {roleLabels[role] || role}
      </span>
    )
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
            {projects.length} progetti disponibili
          </p>
        </div>
        
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
      </div>

      {/* Active Project Banner */}
      {activeProject && (
        <div className="bg-primary text-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Progetto Attivo</p>
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
          <p className="text-gray-500">
            {searchTerm ? 'Nessun progetto trovato' : 'Nessun progetto disponibile'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => selectProject(project)}
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
                  <CheckCircle2 className="text-primary flex-shrink-0" size={24} />
                )}
              </div>

              {/* Project Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 size={16} className="text-gray-400" />
                  <span className="truncate">{project.client}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={16} className="text-gray-400" />
                  <span>{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={16} className="text-gray-400" />
                  <span>{project.daily_hours}h/giorno</span>
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
        💡 Clicca su un progetto per selezionarlo come attivo
      </div>
    </div>
  )
}
