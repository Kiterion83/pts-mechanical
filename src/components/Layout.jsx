import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout({ children, session }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        session={session} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
      />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="lg:ml-64 pt-16 pb-20 lg:pb-4 min-h-screen">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
      
      <BottomNav />
    </div>
  )
}
