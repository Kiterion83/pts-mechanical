import { useTranslation } from 'react-i18next'
import { 
  TrendingUp, 
  Users, 
  Wrench, 
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity
} from 'lucide-react'

export default function Dashboard() {
  const { t } = useTranslation()

  // Mock data - will be replaced with real data from Supabase
  const stats = [
    { 
      label: t('dashboard.hoursWorked'), 
      value: '1,248', 
      change: '+12%', 
      icon: Clock,
      color: 'bg-blue-500'
    },
    { 
      label: 'Work Packages', 
      value: '24', 
      change: '8 in corso', 
      icon: Wrench,
      color: 'bg-green-500'
    },
    { 
      label: t('nav.squads'), 
      value: '6', 
      change: '32 operatori', 
      icon: Users,
      color: 'bg-purple-500'
    },
    { 
      label: t('nav.materialRequests'), 
      value: '12', 
      change: '3 pronte', 
      icon: Package,
      color: 'bg-orange-500'
    },
  ]

  const recentActivities = [
    { type: 'wp_completed', message: 'WP-P-0012 completato', squad: 'Piping A', time: '10 min fa' },
    { type: 'material_ready', message: 'MR-0045 pronta per ritiro', squad: 'Piping B', time: '25 min fa' },
    { type: 'wp_started', message: 'WP-P-0015 iniziato', squad: 'Piping C', time: '1 ora fa' },
    { type: 'daily_submitted', message: 'Rapportino inviato', squad: 'Support A', time: '2 ore fa' },
  ]

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>
        <p className="text-gray-500">Progetto Demo - Gennaio 2026</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.change}</p>
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
        {/* Progress Overview */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            {t('common.progress')} Generale
          </h2>
          
          <div className="space-y-4">
            <ProgressBar label="Saldature" value={68} color="bg-blue-500" />
            <ProgressBar label="Supporti" value={45} color="bg-green-500" />
            <ProgressBar label="Giunti Flangiati" value={52} color="bg-purple-500" />
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Progress Totale</span>
              <span className="text-2xl font-bold text-primary">55%</span>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            Attività Recenti
          </h2>
          
          <div className="space-y-3">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`p-2 rounded-full ${
                  activity.type === 'wp_completed' ? 'bg-success-light text-success' :
                  activity.type === 'material_ready' ? 'bg-warning-light text-yellow-700' :
                  'bg-info-light text-info'
                }`}>
                  {activity.type === 'wp_completed' ? <CheckCircle2 size={16} /> :
                   activity.type === 'material_ready' ? <Package size={16} /> :
                   <AlertCircle size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.squad} • {activity.time}</p>
                </div>
              </div>
            ))}
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
            value={8} 
            icon={CheckCircle2} 
            className="bg-success-light text-success" 
          />
          <StatusCard 
            label="In Corso" 
            value={12} 
            icon={Activity} 
            className="bg-info-light text-info" 
          />
          <StatusCard 
            label="Pianificati" 
            value={6} 
            icon={Clock} 
            className="bg-warning-light text-yellow-700" 
          />
          <StatusCard 
            label="Non Assegnati" 
            value={3} 
            icon={AlertCircle} 
            className="bg-danger-light text-danger" 
          />
        </div>
      </div>
    </div>
  )
}

// Helper Components
function ProgressBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{value}%</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
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
