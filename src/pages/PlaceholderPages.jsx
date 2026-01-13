// Placeholder pages for modules not yet fully implemented
import { useTranslation } from 'react-i18next'
import { useProject } from '../contexts/ProjectContext'
import { useNavigate } from 'react-router-dom'
import { 
  Users, 
  UsersRound, 
  Truck, 
  Wrench, 
  ClipboardList, 
  ShoppingCart,
  Package,
  FolderKanban,
  Construction
} from 'lucide-react'

// Generic placeholder component
function PlaceholderPage({ icon: Icon, titleKey, children }) {
  const { t } = useTranslation()
  const { activeProject } = useProject()
  const navigate = useNavigate()

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <FolderKanban size={64} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          {t('project.selectProject')}
        </h2>
        <button onClick={() => navigate('/settings/projects')} className="btn-primary mt-4">
          {t('project.title')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Icon className="text-primary" />
          {t(titleKey)}
        </h1>
        <p className="text-gray-500 mt-1">{activeProject.name}</p>
      </div>
      {children || (
        <div className="card text-center py-12">
          <Construction size={64} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {t('common.loading')}...
          </h2>
          <p className="text-gray-500">
            Questa sezione è in fase di sviluppo
          </p>
        </div>
      )}
    </div>
  )
}

// Personnel Page
export function Personnel() {
  return <PlaceholderPage icon={Users} titleKey="personnel.title" />
}

// Squads Page
export function Squads() {
  return <PlaceholderPage icon={UsersRound} titleKey="squad.title" />
}

// Equipment Page
export function Equipment() {
  return <PlaceholderPage icon={Truck} titleKey="equipment.title" />
}

// Work Packages Page
export function WorkPackages() {
  return <PlaceholderPage icon={Wrench} titleKey="workPackage.title" />
}

// Daily Reports Page
export function DailyReports() {
  return <PlaceholderPage icon={ClipboardList} titleKey="dailyReport.title" />
}

// Material Requests Page
export function MaterialRequests() {
  return <PlaceholderPage icon={ShoppingCart} titleKey="materialRequest.title" />
}

// MTO Page
export function MTO() {
  return <PlaceholderPage icon={Package} titleKey="nav.mto" />
}
