import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'
import { 
  TrendingUp, 
  Users, 
  Wrench, 
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  FolderKanban
} from 'lucide-react'

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeProject, loading: projectLoading } = useProject()
  
  const [stats, setStats] = useState({
    totalPersonnel: 0,
    totalSquads: 0,
    totalWP: 0,
    wpInProgress: 0,
    wpCompleted: 0,
    pendingMR: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (activeProject) {
      loadDashboardData()
    }
  }, [activeProject])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load personnel count
      const { count: personnelCount } = await supabase
        .from('personnel')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', activeProject.id)
        .eq('status', 'active')

      // Load squads count
      const { count: squadsCount } = await supabase
        .from('squads')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', activeProject.id)
        .eq('status', 'active')

      // Load work packages
      const { data: wpData } = await supabase
        .from('work_packages')
        .select('status')
        .eq('project_id', activeProject.id)

      const wpInProgress = wpData?.filter(wp => wp.status === 'in_progress').length || 0
      const wpCompleted = wpData?.filter(wp => wp.status === 'completed').length || 0

      // Load pending material requests
      const { count: mrCount } = await supabase
        .from('material_requests')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', activeProject.id)
        .in('status', ['created', 'in_preparation', 'ready_for_pickup'])

      setStats({
        totalPersonnel: personnelCount || 0,
        totalSquads: squadsCount || 0,
        totalWP: wpData?.length || 0,
        wpInProgress,
        wpCompleted,
        pendingMR: mrCount || 0
      })

    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  // No active project selected
  if (!projectLoading && !activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <FolderKanban size={64} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          Nessun Progetto Selezionato
        </h2>
        <p className="text-gray-500 mb-6">
          Seleziona un progetto per visualizzare la dashboard
        </p>
        <button 
          onClick={() => navigate('/projects')}
          className="btn-primary"
        >
          Vai ai Progetti
        </button>
      </div>
    )
  }

  const statCards = [
    { 
      label: 'Personale Attivo', 
      value: stats.totalPersonnel, 
      icon: Users,
      color: 'bg-blue-500',
      link: '/personnel'
    },
    { 
      label: 'Squadre', 
      value: stats.totalSquads, 
      icon: Users,
      color: 'bg-purple-500',
      link: '/squads'
    },
    { 
      label: 'Work Packages', 
      value: stats.totalWP, 
      subtitle: `${stats.wpInProgress} in corso`,
      icon: Wrench,
      color: 'bg-green-500',
      link: '/work-packages'
    },
    { 
      label: 'Richieste Materiale', 
      value: stats.pendingMR, 
      subtitle: 'in attesa',
      icon: Package,
      color: 'bg-orange-500',
      link: '/material-requests'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>
        <p className="text-gray-500">
          {activeProject?.name} • {activeProject?.code}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div 
            key={index} 
            onClick={() => navigate(stat.link)}
            className="card cursor-pointer hover:shadow-xl transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {loading ? '...' : stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
                )}
              </div>
              <div className={`${stat.color} p-3 rounded-lg text-white`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Project Info */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FolderKanban size={20} className="text-primary" />
            Dettagli Progetto
          </h2>
          
          <div className="space-y-3">
            <InfoRow label="Codice" value={activeProject?.code} />
            <InfoRow label="Cliente" value={activeProject?.client} />
            <InfoRow 
              label="Data Inizio" 
              value={new Date(activeProject?.start_date).toLocaleDateString('it-IT')} 
            />
            <InfoRow 
              label="Data Fine" 
              value={new Date(activeProject?.end_date).toLocaleDateString('it-IT')} 
            />
            <InfoRow label="Ore Giornaliere" value={`${activeProject?.daily_hours}h`} />
            <InfoRow label="Il Tuo Ruolo" value={activeProject?.userRole?.toUpperCase()} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            Azioni Rapide
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <QuickAction 
              icon={Users} 
              label="Aggiungi Personale" 
              onClick={() => navigate('/personnel')}
            />
            <QuickAction 
              icon={Wrench} 
              label="Nuovo Work Package" 
              onClick={() => navigate('/work-packages')}
            />
            <QuickAction 
              icon={Package} 
              label="Richiedi Materiale" 
              onClick={() => navigate('/material-requests')}
            />
            <QuickAction 
              icon={Clock} 
              label="Rapportino" 
              onClick={() => navigate('/daily-reports')}
            />
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Stato Work Packages
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard 
            label="Completati" 
            value={loading ? '...' : stats.wpCompleted} 
            icon={CheckCircle2} 
            className="bg-success-light text-success" 
          />
          <StatusCard 
            label="In Corso" 
            value={loading ? '...' : stats.wpInProgress} 
            icon={Activity} 
            className="bg-info-light text-info" 
          />
          <StatusCard 
            label="Pianificati" 
            value={loading ? '...' : (stats.totalWP - stats.wpInProgress - stats.wpCompleted)} 
            icon={Clock} 
            className="bg-warning-light text-yellow-700" 
          />
          <StatusCard 
            label="Totale WP" 
            value={loading ? '...' : stats.totalWP} 
            icon={Wrench} 
            className="bg-gray-100 text-gray-700" 
          />
        </div>
      </div>
    </div>
  )
}

// Helper Components
function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value || '-'}</span>
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
    >
      <Icon size={24} className="text-primary" />
      <span className="text-sm text-gray-700 text-center">{label}</span>
    </button>
  )
}

function StatusCard({ label, value, icon: Icon, className }) {
  return (
    <div className={`p-4 rounded-xl ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm opacity-80">{label}</p>
        </div>
        <Icon size={32} className="opacity-50" />
      </div>
    </div>
  )
}
