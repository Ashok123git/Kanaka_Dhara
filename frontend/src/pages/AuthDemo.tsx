/**
 * Demo page for E2E: displays useAuth() context so tests can assert
 * that the hook returns values when used inside AuthProvider.
 */
import { useAuth } from '@/auth/useAuth';

export default function AuthDemo() {
  const auth = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8" data-testid="auth-demo">
      <span data-testid="auth-token">{auth.token ?? 'null'}</span>
      <span data-testid="auth-authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="auth-user-phone">{auth.user?.phone ?? 'null'}</span>
    </div>
  );
}
