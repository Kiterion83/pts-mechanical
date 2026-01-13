import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Bell, User, LogOut, ChevronDown, FolderKanban, Check, Settings } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProject } from '../contexts/ProjectContext'

export default function Header({ session, onMenuClick }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { projects, activeProject, selectProject } = useProject()
  
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('pts-language', lng)
    setShowLangMenu(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleProjectSelect = (project) => {
    selectProject(project)
    setShowProjectMenu(false)
  }

  const handleProjectsPageClick = () => {
    setShowProjectMenu(false)
    navigate('/projects')
  }

  // Close menus when clicking outside
  const closeAllMenus = () => {
    setShowUserMenu(false)
    setShowLangMenu(false)
    setShowProjectMenu(false)
  }

  // Count active projects (all non-closed projects the user has access to)
  const activeProjectsCount = projects.filter(p => p.status === 'active').length

  return (
    <>
      {/* Backdrop to close menus */}
      {(showUserMenu || showLangMenu || showProjectMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={closeAllMenus}
        />
      )}
      
      <header className="fixed top-0 left-0 right-0 h-16 bg-primary text-white shadow-lg z-50">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Left: Menu button + Logo */}
          <div className="flex items-center gap-3">
            <button 
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-primary-light rounded-lg touch-target"
              aria-label="Menu"
            >
              <Menu size={24} />
            </button>
            
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <span className="text-2xl">🏗️</span>
              <span className="font-bold text-lg hidden sm:block">PTS</span>
            </div>
          </div>

          {/* Center: Project Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-light rounded-lg hover:bg-blue-600 transition max-w-[200px] md:max-w-[300px]"
            >
              <FolderKanban size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {activeProject ? activeProject.name : 'Seleziona Progetto'}
              </span>
              <ChevronDown size={16} className="flex-shrink-0" />
            </button>
            
            {showProjectMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 text-gray-800 z-50">
                <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    {t('project.selectProject')}
                  </p>
                  <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                    {activeProjectsCount} attivi
                  </span>
                </div>
                
                <div className="max-h-64 overflow-y-auto">
                  {projects.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500">
                      <FolderKanban size={32} className="mx-auto mb-2 text-gray-300" />
                      <p>Nessun progetto</p>
                    </div>
                  ) : (
                    projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleProjectSelect(project)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 ${
                          activeProject?.id === project.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{project.name}</p>
                            {project.status !== 'active' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                                {project.status === 'suspended' ? 'Sospeso' : 'Chiuso'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {project.code} • {project.client}
                          </p>
                        </div>
                        {activeProject?.id === project.id && (
                          <Check size={18} className="text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
                
                <div className="border-t border-gray-100">
                  <button
                    onClick={handleProjectsPageClick}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 text-primary font-medium text-sm flex items-center gap-2"
                  >
                    <Settings size={16} />
                    Gestisci Progetti
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Language, Notifications, User */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="p-2 hover:bg-primary-light rounded-lg touch-target flex items-center gap-1"
              >
                <span className="text-lg">{i18n.language === 'it' ? '🇮🇹' : '🇬🇧'}</span>
              </button>
              
              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg py-1 text-gray-800 z-50">
                  <button 
                    onClick={() => changeLanguage('it')}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${i18n.language === 'it' ? 'bg-gray-100' : ''}`}
                  >
                    <span>🇮🇹</span> Italiano
                  </button>
                  <button 
                    onClick={() => changeLanguage('en')}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${i18n.language === 'en' ? 'bg-gray-100' : ''}`}
                  >
                    <span>🇬🇧</span> English
                  </button>
                </div>
              )}
            </div>

            {/* Notifications */}
            <button className="p-2 hover:bg-primary-light rounded-lg touch-target relative">
              <Bell size={22} />
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-xs rounded-full flex items-center justify-center">
                0
              </span>
            </button>

            {/* User Menu */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-2 hover:bg-primary-light rounded-lg touch-target"
              >
                <User size={22} />
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-1 text-gray-800 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium truncate">
                      {session?.user?.email}
                    </p>
                    {activeProject && (
                      <div className="mt-1">
                        <p className="text-xs text-gray-500">Progetto attivo</p>
                        <p className="text-xs font-medium text-primary truncate">
                          {activeProject.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          Ruolo: {activeProject.userRole?.toUpperCase()}
                        </p>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center gap-2 text-danger"
                  >
                    <LogOut size={18} />
                    {t('auth.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
