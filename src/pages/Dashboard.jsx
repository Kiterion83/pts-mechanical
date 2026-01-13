import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { supabase } from '../lib/supabase'
import { 
  Users, 
  Wrench, 
  Package,
  Clock,
  CheckCircle2,
  Activity,
  FolderKanban
} from 'lucide-react'

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeProject, loading: projectLoading } = useProject()
  const permissions = usePermissions()
  
  const [stats, setStats] = useState({
    totalPersonnel: 0,
    totalSquads: 0,
    totalWP: 0,
    wpInProgress: 0,
    wpCompleted: 0,
    pendingMR: 0,
    totalAreas: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (activeProject) {
      loadDashboardData()
    } else {
      setLoading(false)
    }
  }, [activeProject])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      const { count: personnelCount } = await supabase
        .from('personnel')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', activeProject.id)
        .eq('status', 'active')

      const { count: squadsCount } = await supabase
        .from('squads')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', activeProject.id)
        .eq('status', 'active')

      const { count: areasCount } = await supabase
        .from('areas')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', activeProject.id)

      const { data: wpData } = await supabase
        .from('work_packages')
        .select('status')
        .eq('project_id', activeProject.id)

      const wpInProgress = wpData?.filter(wp => wp.status === 'in_progress').length || 0
      const wpCompleted = wpData?.filter(wp => wp.status === 'completed').length || 0

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
        pendingMR: mrCount || 0,
        totalAreas: areasCount || 0
      })

    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!projectLoading && !activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <FolderKanban size={64} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          {t('project.selectProject')}
        </h2>
        <p className="text-gray-500 mb-6 text-center">
          {t('project.selectProject')}
        </p>
        {permissions.canAccessSettings && (
          <button onClick={() => navigate('/settings/projects')} className="btn-primary">
            {t('project.title')}
          </button>
        )}
      </div>
    )
  }

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 spinner border-4"></div>
      </div>
    )
  }

  // Calculate timeline
  const startDate = new Date(activeProject.start_date)
  const endDate = new Date(activeProject.end_date)
  const today = new Date()
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
  const elapsedDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24))
  const progressPercent = Math.min(Math.max(Math.round((elapsedDays / totalDays) * 100), 0), 100)
  const daysRemaining = Math.max(Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)), 0)

  const statCards = [
    { label: t('dashboard.activePersonnel'), value: stats.totalPersonnel, icon: Users, color: 'bg-blue-500', link: '/settings/personnel' },
    { label: t('nav.squads'), value: stats.totalSquads, icon: Users, color: 'bg-purple-500', link: '/settings/squads' },
    { label: t('nav.workPackages'), value: stats.totalWP, subtitle: `${stats.wpInProgress} ${t('status.inProgress').toLowerCase()}`, icon: Wrench, color: 'bg-green-500', link: '/work-packages' },
    { label: t('nav.materialRequests'), value: stats.pendingMR, subtitle: t('dashboard.pendingRequests'), icon: Package, color: 'bg-orange-500', link: '/material-requests' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>
          <p className="text-gray-500">{activeProject.name} • {activeProject.code}</p>
        </div>
        {permissions.canAccessSettings && (
          <button 
            onClick={() => navigate(`/settings/projects/${activeProject.id}`)}
            className="btn-secondary text-sm"
          >
            <FolderKanban size={16} className="mr-2" />
            {t('dashboard.projectDetails')}
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="card bg-gradient-to-r from-primary to-primary-light text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-blue-200 text-sm">{t('project.timeline')}</p>
            <p className="text-lg font-semibold">{activeProject.client}</p>
          </div>
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-sm text-blue-200 mb-1">
              <span>{new Date(activeProject.start_date).toLocaleDateString()}</span>
              <span>{progressPercent}%</span>
              <span>{new Date(activeProject.end_date).toLocaleDateString()}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{daysRemaining}</p>
            <p className="text-blue-200 text-sm">{t('project.daysRemaining')}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <div key={i} onClick={() => navigate(stat.link)} className="card cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{loading ? '...' : stat.value}</p>
                {stat.subtitle && <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>}
              </div>
              <div className={`${stat.color} p-3 rounded-lg text-white`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* WP Status */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('dashboard.wpStatus')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard label={t('status.completed')} value={loading ? '...' : stats.wpCompleted} icon={CheckCircle2} className="bg-success-light text-success" />
          <StatusCard label={t('status.inProgress')} value={loading ? '...' : stats.wpInProgress} icon={Activity} className="bg-info-light text-info" />
          <StatusCard label={t('status.planned')} value={loading ? '...' : Math.max(0, stats.totalWP - stats.wpInProgress - stats.wpCompleted)} icon={Clock} className="bg-warning-light text-yellow-700" />
          <StatusCard label={t('common.total')} value={loading ? '...' : stats.totalWP} icon={Wrench} className="bg-gray-100 text-gray-700" />
        </div>
      </div>
    </div>
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
