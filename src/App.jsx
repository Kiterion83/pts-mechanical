import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from './lib/supabase'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Components
import Layout from './components/Layout'
import LoadingScreen from './components/LoadingScreen'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={session ? <Navigate to="/" replace /> : <Login />} 
        />
        
        {/* Protected routes */}
        <Route
          path="/*"
          element={
            session ? (
              <Layout session={session}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<ComingSoon title={t('nav.projects')} />} />
                  <Route path="/personnel" element={<ComingSoon title={t('nav.personnel')} />} />
                  <Route path="/squads" element={<ComingSoon title={t('nav.squads')} />} />
                  <Route path="/mto" element={<ComingSoon title={t('nav.mto')} />} />
                  <Route path="/work-packages" element={<ComingSoon title={t('nav.workPackages')} />} />
                  <Route path="/daily-reports" element={<ComingSoon title={t('nav.dailyReports')} />} />
                  <Route path="/material-requests" element={<ComingSoon title={t('nav.materialRequests')} />} />
                  <Route path="/equipment" element={<ComingSoon title={t('nav.equipment')} />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

// Placeholder component for pages not yet implemented
function ComingSoon({ title }) {
  const { t } = useTranslation()
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-6xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{title}</h1>
      <p className="text-gray-500">{t('common.loading')}...</p>
    </div>
  )
}

// 404 page
function NotFound() {
  const { t } = useTranslation()
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">404</h1>
      <p className="text-gray-500">{t('errors.notFound')}</p>
    </div>
  )
}

export default App
