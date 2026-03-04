import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Redirect to /login if no valid token; otherwise render children.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
