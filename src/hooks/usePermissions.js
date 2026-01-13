import { useState, useEffect, useMemo } from 'react'
import { useProject } from '../contexts/ProjectContext'

// Definizione permessi per ruolo
const ROLE_PERMISSIONS = {
  admin: {
    canAccessSettings: true,
    canCreateWP: true,
    canViewAllProjects: true,
    canManagePersonnel: true,
    canManageSquads: true,
    canManageCompanies: true,
  },
  pm: {
    canAccessSettings: true,
    canCreateWP: true,
    canViewAllProjects: true,
    canManagePersonnel: true,
    canManageSquads: true,
    canManageCompanies: true,
  },
  site_manager: {
    canAccessSettings: true,
    canCreateWP: true,
    canViewAllProjects: true,
    canManagePersonnel: true,
    canManageSquads: true,
    canManageCompanies: true,
  },
  cm: {
    canAccessSettings: true,
    canCreateWP: true,
    canViewAllProjects: true,
    canManagePersonnel: true,
    canManageSquads: true,
    canManageCompanies: true,
  },
  pem: {
    canAccessSettings: true,
    canCreateWP: true,
    canViewAllProjects: true,
    canManagePersonnel: true,
    canManageSquads: true,
    canManageCompanies: true,
  },
  engineer: {
    canAccessSettings: true,
    canCreateWP: true,
    canViewAllProjects: true,
    canManagePersonnel: true,
    canManageSquads: true,
    canManageCompanies: false,
  },
  planner: {
    canAccessSettings: true,
    canCreateWP: false,
    canViewAllProjects: true,
    canManagePersonnel: true,
    canManageSquads: true,
    canManageCompanies: false,
  },
  supervisor: {
    canAccessSettings: false,
    canCreateWP: false,
    canViewAllProjects: false,
    canManagePersonnel: false,
    canManageSquads: false,
    canManageCompanies: false,
  },
  foreman: {
    canAccessSettings: false,
    canCreateWP: false,
    canViewAllProjects: false,
    canManagePersonnel: false,
    canManageSquads: false,
    canManageCompanies: false,
  },
  sub_foreman: {
    canAccessSettings: false,
    canCreateWP: false,
    canViewAllProjects: false,
    canManagePersonnel: false,
    canManageSquads: false,
    canManageCompanies: false,
  },
  operator: {
    canAccessSettings: false,
    canCreateWP: false,
    canViewAllProjects: false,
    canManagePersonnel: false,
    canManageSquads: false,
    canManageCompanies: false,
  },
  helper: {
    canAccessSettings: false,
    canCreateWP: false,
    canViewAllProjects: false,
    canManagePersonnel: false,
    canManageSquads: false,
    canManageCompanies: false,
  },
  storekeeper: {
    canAccessSettings: false,
    canCreateWP: false,
    canViewAllProjects: false,
    canManagePersonnel: false,
    canManageSquads: false,
    canManageCompanies: false,
  },
}

// Default permissions (nessun accesso)
const DEFAULT_PERMISSIONS = {
  canAccessSettings: false,
  canCreateWP: false,
  canViewAllProjects: false,
  canManagePersonnel: false,
  canManageSquads: false,
  canManageCompanies: false,
}

export function usePermissions() {
  const { activeProject } = useProject()
  
  const permissions = useMemo(() => {
    if (!activeProject || !activeProject.userRole) {
      return DEFAULT_PERMISSIONS
    }
    
    const role = activeProject.userRole.toLowerCase()
    return ROLE_PERMISSIONS[role] || DEFAULT_PERMISSIONS
  }, [activeProject])

  const userRole = activeProject?.userRole || null

  // Helper functions
  const hasPermission = (permission) => {
    return permissions[permission] === true
  }

  const isAdmin = () => {
    return ['admin', 'pm', 'site_manager', 'cm'].includes(userRole?.toLowerCase())
  }

  const canManage = () => {
    return permissions.canAccessSettings
  }

  const isFieldRole = () => {
    return ['supervisor', 'foreman', 'sub_foreman', 'operator', 'helper'].includes(userRole?.toLowerCase())
  }

  return {
    ...permissions,
    userRole,
    hasPermission,
    isAdmin,
    canManage,
    isFieldRole,
  }
}

// Export anche le costanti per uso esterno
export { ROLE_PERMISSIONS, DEFAULT_PERMISSIONS }
