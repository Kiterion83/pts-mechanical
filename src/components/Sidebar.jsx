import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  X
} from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/projects', icon: FolderKanban, labelKey: 'nav.projects' },
  { path: '/personnel', icon: Users, labelKey: 'nav.personnel' },
  { path: '/squads', icon: UsersRound, labelKey: 'nav.squads' },
  { path: '/mto', icon: Package, labelKey: 'nav.mto' },
  { path: '/work-packages', icon: Wrench, labelKey: 'nav.workPackages' },
  { path: '/daily-reports', icon: ClipboardList, labelKey: 'nav.dailyReports' },
  { path: '/material-requests', icon: ShoppingCart, labelKey: 'nav.materialRequests' },
  { path: '/equipment', icon: Truck, labelKey: 'nav.equipment' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { t } = useTranslation()

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
          <ul className="space-y-1">
            {navItems.map((item) => (
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
        </nav>
        
        {/* Version */}
        <div className="absolute bottom-4 left-4 right-4 text-center text-xs text-gray-400">
          PTS v2.0
        </div>
      </aside>
    </>
  )
}
