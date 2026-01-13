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
        setActiveProject(projects[0])
        localStorage.setItem('pts-active-project', projects[0].id)
      }
    } else if (projects.length > 0 && !activeProject) {
      setActiveProject(projects[0])
      localStorage.setItem('pts-active-project', projects[0].id)
    }
  }, [projects])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select(`
          *,
          user_project_roles!inner (
            role
          )
        `)
        .eq('user_project_roles.user_id', userId)
        .order('name')

      if (fetchError) throw fetchError

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

  const createProject = async (projectData) => {
    try {
      // Create project
      const { data: newProject, error: createError } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single()

      if (createError) throw createError

      // Assign current user as admin
      const { error: roleError } = await supabase
        .from('user_project_roles')
        .insert([{
          user_id: userId,
          project_id: newProject.id,
          role: 'admin'
        }])

      if (roleError) throw roleError

      // Reload projects
      await loadProjects()
      
      return { data: newProject, error: null }
    } catch (err) {
      console.error('Error creating project:', err)
      return { data: null, error: err.message }
    }
  }

  const updateProject = async (projectId, projectData) => {
    try {
      const { data, error: updateError } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', projectId)
        .select()
        .single()

      if (updateError) throw updateError

      // Reload projects
      await loadProjects()
      
      // Update active project if it was the one updated
      if (activeProject?.id === projectId) {
        setActiveProject({ ...activeProject, ...data })
      }

      return { data, error: null }
    } catch (err) {
      console.error('Error updating project:', err)
      return { data: null, error: err.message }
    }
  }

  const deleteProject = async (projectId) => {
    try {
      // First delete related data (cascade should handle most, but let's be explicit)
      await supabase.from('project_holidays').delete().eq('project_id', projectId)
      await supabase.from('user_project_roles').delete().eq('project_id', projectId)
      
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (deleteError) throw deleteError

      // If deleted project was active, select another
      if (activeProject?.id === projectId) {
        const remainingProjects = projects.filter(p => p.id !== projectId)
        if (remainingProjects.length > 0) {
          selectProject(remainingProjects[0])
        } else {
          setActiveProject(null)
          localStorage.removeItem('pts-active-project')
        }
      }

      // Reload projects
      await loadProjects()

      return { error: null }
    } catch (err) {
      console.error('Error deleting project:', err)
      return { error: err.message }
    }
  }

  const value = {
    projects,
    activeProject,
    loading,
    error,
    selectProject,
    createProject,
    updateProject,
    deleteProject,
    refreshProjects: loadProjects,
    userId,
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
