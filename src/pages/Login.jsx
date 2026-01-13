import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Mail, Lock, AlertCircle, User } from 'lucide-react'

export default function Login() {
  const { t, i18n } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Check if identifier is email or username
    const isEmail = identifier.includes('@')
    
    const { error } = await supabase.auth.signInWithPassword({
      email: isEmail ? identifier : `${identifier}@pts.local`,
      password,
    })

    if (error) {
      setError(t('auth.loginError'))
    }
    
    setLoading(false)
  }

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('pts-language', lng)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-4xl">🏗️</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{t('app.name')}</h1>
          <p className="text-blue-200 mt-2">{t('app.tagline')}</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
            {t('auth.login')}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-danger-light text-danger rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">{t('auth.email')} / {t('auth.username')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="input pl-10"
                  placeholder={t('auth.email')}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </button>
          </form>

          {/* Language Switcher */}
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => changeLanguage('it')}
              className={`px-3 py-1 rounded ${i18n.language === 'it' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              🇮🇹 Italiano
            </button>
            <button
              onClick={() => changeLanguage('en')}
              className={`px-3 py-1 rounded ${i18n.language === 'en' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-200 text-sm mt-6">
          PTS v3.0 - © 2026
        </p>
      </div>
    </div>
  )
}
