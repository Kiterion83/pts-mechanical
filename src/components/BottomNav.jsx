import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  LayoutDashboard, 
  Wrench, 
  ClipboardList, 
  ShoppingCart, 
  MoreHorizontal 
} from 'lucide-react'

const bottomNavItems = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/work-packages', icon: Wrench, labelKey: 'nav.workPackages' },
  { path: '/daily-reports', icon: ClipboardList, labelKey: 'nav.dailyReports' },
  { path: '/material-requests', icon: ShoppingCart, labelKey: 'nav.materialRequests' },
]

export default function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 z-40">
      <ul className="h-full flex items-center justify-around">
        {bottomNavItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) => `
                flex flex-col items-center justify-center px-3 py-2 min-w-[64px]
                ${isActive ? 'text-primary' : 'text-gray-500'}
              `}
            >
              <item.icon size={22} />
              <span className="text-xs mt-1 font-medium truncate">
                {t(item.labelKey).split(' ')[0]}
              </span>
            </NavLink>
          </li>
        ))}
        <li>
          <button className="flex flex-col items-center justify-center px-3 py-2 min-w-[64px] text-gray-500">
            <MoreHorizontal size={22} />
            <span className="text-xs mt-1 font-medium">Altro</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
