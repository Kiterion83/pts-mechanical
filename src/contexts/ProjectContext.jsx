import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ProjectContext = createContext(null)

export function ProjectProvider({ children, userId }) {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load projects on mount
  useEffect(() => {
    if (userId) {
      loadProjects()
    }
  }, [userId])

  // Load active project from localStorage
  useEffect(() => {
    const savedProjectId = localStorage.getItem('pts-active-project')
    if (savedProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === savedProjectId)
      if (project) {
        setActiveProject(project)
      } else if (projects.length > 0) {
        // If saved project not found, use first available
        setActiveProject(projects[0])
        localStorage.setItem('pts-active-project', projects[0].id)
      }
    } else if (projects.length > 0 && !activeProject) {
      // No saved project, use first available
      setActiveProject(projects[0])
      localStorage.setItem('pts-active-project', projects[0].id)
    }
  }, [projects])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get projects where user has a role
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select(`
          *,
          user_project_roles!inner (
            role
          )
        `)
        .eq('user_project_roles.user_id', userId)
        .eq('status', 'active')
        .order('name')

      if (fetchError) throw fetchError

      // Flatten the data to include role
      const projectsWithRole = data.map(p => ({
        ...p,
        userRole: p.user_project_roles[0]?.role
      }))

      setProjects(projectsWithRole)
    } catch (err) {
      console.error('Error loading projects:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const selectProject = (project) => {
    setActiveProject(project)
    localStorage.setItem('pts-active-project', project.id)
  }

  const value = {
    projects,
    activeProject,
    loading,
    error,
    selectProject,
    refreshProjects: loadProjects,
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
