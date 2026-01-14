import { useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout({ children, session }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Sidebar collassata (solo icone) su desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('pts-sidebar-collapsed')
    return saved === 'true'
  })

  // Salva preferenza
  useEffect(() => {
    localStorage.setItem('pts-sidebar-collapsed', sidebarCollapsed)
  }, [sidebarCollapsed])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        session={session} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <main className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} pt-16 pb-20 lg:pb-4 min-h-screen transition-all duration-300`}>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
      
      <BottomNav />
    </div>
  )
}
