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
  ChevronRight,
  ChevronLeft,
  Factory,
  BarChart3
} from 'lucide-react'
import { useState } from 'react'

// Main menu items (visible to all)
const mainMenuItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/mto-piping', icon: Package, labelKey: 'nav.mtoPiping' },
  { path: '/project-equipment', icon: Factory, labelKey: 'nav.projectEquipment' },
  { path: '/work-packages', icon: Wrench, labelKey: 'nav.workPackages', exact: true },
  { path: '/work-packages/gantt', icon: BarChart3, labelKey: 'nav.gantt' },  // AGGIUNTO: Gantt separato
  { path: '/daily-reports', icon: ClipboardList, labelKey: 'nav.dailyReports' },
  { path: '/material-requests', icon: ShoppingCart, labelKey: 'nav.materialRequests' },
]

// Settings menu items (visible only to authorized roles)
const settingsMenuItems = [
  { path: '/settings/projects', icon: FolderKanban, labelKey: 'nav.projects', permission: 'canAccessSettings' },
  { path: '/settings/companies', icon: Building2, labelKey: 'nav.companies', permission: 'canManageCompanies' },
  { path: '/settings/personnel', icon: Users, labelKey: 'nav.personnel', permission: 'canManagePersonnel' },
  { path: '/settings/squads', icon: UsersRound, labelKey: 'nav.squads', permission: 'canManageSquads' },
  { path: '/settings/mezzi', icon: Truck, labelKey: 'nav.mezzi', permission: 'canAccessSettings' },
]

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
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
        fixed top-16 left-0 bottom-0 bg-white shadow-lg z-40
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        overflow-visible
        ${collapsed ? 'w-16' : 'w-64'}
      `}>
        {/* Close button - mobile */}
        <button 
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} />
        </button>
        
        {/* Toggle button - desktop - inside sidebar */}
        <button 
          onClick={onToggleCollapse}
          className="hidden lg:flex absolute right-2 top-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg items-center justify-center z-50"
          title={collapsed ? 'Espandi menu' : 'Riduci menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        
        {/* Navigation - with scroll */}
        <div className="h-full overflow-y-auto pb-24">
          <nav className={`p-4 pt-2 lg:pt-14 ${collapsed ? 'px-2' : ''}`}>
          {/* Main Menu */}
          <div className="mb-6">
            {!collapsed && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-4">
                {t('nav.mainMenu')}
              </p>
            )}
            <ul className="space-y-1">
              {mainMenuItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.exact}
                    onClick={onClose}
                    title={collapsed ? t(item.labelKey) : ''}
                    className={({ isActive }) => `
                      flex items-center gap-3 ${collapsed ? 'px-3 justify-center' : 'px-4'} py-3 rounded-lg transition-colors
                      ${isActive 
                        ? 'bg-primary text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <item.icon size={20} />
                    {!collapsed && <span className="font-medium">{t(item.labelKey)}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Settings Menu - Only for authorized roles */}
          {showSettingsSection && (
            <div>
              {!collapsed ? (
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
              ) : (
                <div className="border-t border-gray-200 my-2" />
              )}
              
              {(settingsExpanded || collapsed) && (
                <ul className="space-y-1">
                  {visibleSettingsItems.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        title={collapsed ? t(item.labelKey) : ''}
                        className={({ isActive }) => `
                          flex items-center gap-3 ${collapsed ? 'px-3 justify-center' : 'px-4'} py-3 rounded-lg transition-colors
                          ${isActive 
                            ? 'bg-primary text-white' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        <item.icon size={20} />
                        {!collapsed && <span className="font-medium">{t(item.labelKey)}</span>}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </nav>
        </div>
        
        {/* Version & Role - Fixed at bottom */}
        {!collapsed && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
            <div className="text-center text-xs text-gray-400 mb-1">
              {permissions.userRole && (
                <span className="inline-block px-2 py-1 bg-gray-100 rounded text-gray-600 capitalize">
                  {permissions.userRole}
                </span>
              )}
            </div>
            <p className="text-center text-xs text-gray-400">
              PTS v3.1
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
