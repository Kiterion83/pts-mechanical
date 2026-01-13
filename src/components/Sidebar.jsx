import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePermissions } from '../hooks/usePermissions'
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  UsersRound, 
  Package, 
  Wrench, 
  ClipboardList, 
  ShoppingCart, 
  Truck,
  Building2,
  Settings,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'

// Main menu items (visible to all)
const mainMenuItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/mto', icon: Package, labelKey: 'nav.mto' },
  { path: '/work-packages', icon: Wrench, labelKey: 'nav.workPackages' },
  { path: '/daily-reports', icon: ClipboardList, labelKey: 'nav.dailyReports' },
  { path: '/material-requests', icon: ShoppingCart, labelKey: 'nav.materialRequests' },
]

// Settings menu items (visible only to authorized roles)
const settingsMenuItems = [
  { path: '/settings/projects', icon: FolderKanban, labelKey: 'nav.projects', permission: 'canAccessSettings' },
  { path: '/settings/companies', icon: Building2, labelKey: 'nav.companies', permission: 'canManageCompanies' },
  { path: '/settings/personnel', icon: Users, labelKey: 'nav.personnel', permission: 'canManagePersonnel' },
  { path: '/settings/squads', icon: UsersRound, labelKey: 'nav.squads', permission: 'canManageSquads' },
  { path: '/settings/equipment', icon: Truck, labelKey: 'nav.equipment', permission: 'canAccessSettings' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { t } = useTranslation()
  const permissions = usePermissions()
  const [settingsExpanded, setSettingsExpanded] = useState(true)

  // Filter settings items based on permissions
  const visibleSettingsItems = settingsMenuItems.filter(item => 
    permissions[item.permission]
  )

  const showSettingsSection = visibleSettingsItems.length > 0

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed top-16 left-0 bottom-0 w-64 bg-white shadow-lg z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        overflow-y-auto
      `}>
        {/* Close button - mobile */}
        <button 
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} />
        </button>
        
        {/* Navigation */}
        <nav className="p-4 pt-2 lg:pt-4">
          {/* Main Menu */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4">
              {t('nav.mainMenu')}
            </p>
            <ul className="space-y-1">
              {mainMenuItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-primary text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{t(item.labelKey)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Settings Menu - Only for authorized roles */}
          {showSettingsSection && (
            <div>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4 hover:text-gray-600"
              >
                <span className="flex items-center gap-2">
                  <Settings size={14} />
                  {t('nav.settings')}
                </span>
                {settingsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              {settingsExpanded && (
                <ul className="space-y-1">
                  {visibleSettingsItems.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                          ${isActive 
                            ? 'bg-primary text-white' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <item.icon size={20} />
                        <span className="font-medium">{t(item.labelKey)}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </nav>
        
        {/* Version & Role */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-center text-xs text-gray-400 mb-2">
            {permissions.userRole && (
              <span className="inline-block px-2 py-1 bg-gray-100 rounded text-gray-600 capitalize">
                {permissions.userRole}
              </span>
            )}
          </div>
          <p className="text-center text-xs text-gray-400">
            PTS v3.0
          </p>
        </div>
      </aside>
    </>
  )
}
