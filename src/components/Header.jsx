import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu, Bell, User, LogOut, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Header({ session, onMenuClick }) {
  const { t, i18n } = useTranslation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('pts-language', lng)
    setShowLangMenu(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
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
          
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏗️</span>
            <span className="font-bold text-lg hidden sm:block">PTS</span>
          </div>
        </div>

        {/* Center: Project Selector (placeholder) */}
        <div className="hidden md:flex items-center">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-light rounded-lg hover:bg-blue-600 transition">
            <span className="text-sm font-medium">Progetto Demo</span>
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Right: Language, Notifications, User */}
        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <div className="relative">
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="p-2 hover:bg-primary-light rounded-lg touch-target flex items-center gap-1"
            >
              <span className="text-lg">{i18n.language === 'it' ? '🇮🇹' : '🇬🇧'}</span>
            </button>
            
            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg py-1 text-gray-800">
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
              3
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
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 text-gray-800">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium truncate">
                    {session?.user?.email}
                  </p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-danger"
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
  )
}
