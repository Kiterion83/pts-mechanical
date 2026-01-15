import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from './lib/supabase'

// Contexts
import { ProjectProvider } from './contexts/ProjectContext'

// Pages - Main
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Pages - Settings (solo ruoli autorizzati)
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Companies from './pages/Companies'
import Personnel from './pages/Personnel'
import Squads from './pages/Squads'
import Mezzi from './pages/Mezzi'

// Pages - Work
import WorkPackages from './pages/WorkPackages'
import DailyReports from './pages/DailyReports'
import MaterialRequests from './pages/MaterialRequests'
import MTOPiping from './pages/MTOPiping'
import ProjectEquipment from './pages/ProjectEquipment'

// Components
import Layout from './components/Layout'
import LoadingScreen from './components/LoadingScreen'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

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
              <ProjectProvider userId={session.user.id}>
                <Layout session={session}>
                  <Routes>
                    {/* Main Menu - Everyone */}
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/mto-piping" element={<MTOPiping />} />
                    <Route path="/project-equipment" element={<ProjectEquipment />} />
                    <Route path="/work-packages" element={<WorkPackages />} />
                    <Route path="/daily-reports" element={<DailyReports />} />
                    <Route path="/material-requests" element={<MaterialRequests />} />
                    
                    {/* Settings - Only authorized roles */}
                    <Route path="/settings/projects" element={
                      <ProtectedRoute requiredPermission="canAccessSettings">
                        <Projects />
                      </ProtectedRoute>
                    } />
                    <Route path="/settings/projects/:id" element={
                      <ProtectedRoute requiredPermission="canAccessSettings">
                        <ProjectDetail />
                      </ProtectedRoute>
                    } />
                    <Route path="/settings/companies" element={
                      <ProtectedRoute requiredPermission="canManageCompanies">
                        <Companies />
                      </ProtectedRoute>
                    } />
                    <Route path="/settings/personnel" element={
                      <ProtectedRoute requiredPermission="canManagePersonnel">
                        <Personnel />
                      </ProtectedRoute>
                    } />
                    <Route path="/settings/squads" element={
                      <ProtectedRoute requiredPermission="canManageSquads">
                        <Squads />
                      </ProtectedRoute>
                    } />
                    <Route path="/settings/mezzi" element={
                      <ProtectedRoute requiredPermission="canAccessSettings">
                        <Mezzi />
                      </ProtectedRoute>
                    } />

                    {/* Legacy routes redirect to new structure */}
                    <Route path="/mto" element={<Navigate to="/mto-piping" replace />} />
                    <Route path="/projects" element={<Navigate to="/settings/projects" replace />} />
                    <Route path="/projects/:id" element={<Navigate to="/settings/projects/:id" replace />} />
                    <Route path="/personnel" element={<Navigate to="/settings/personnel" replace />} />
                    <Route path="/squads" element={<Navigate to="/settings/squads" replace />} />
                    <Route path="/equipment" element={<Navigate to="/settings/mezzi" replace />} />
                    
                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ProjectProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
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
