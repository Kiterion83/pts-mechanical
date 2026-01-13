import { Navigate } from 'react-router-dom'
import { usePermissions } from '../hooks/usePermissions'

export default function ProtectedRoute({ children, requiredPermission }) {
  const permissions = usePermissions()

  // Se non ha il permesso richiesto, redirect a dashboard
  if (requiredPermission && !permissions[requiredPermission]) {
    return <Navigate to="/" replace />
  }

  return children
}
