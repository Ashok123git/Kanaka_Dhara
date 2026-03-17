/**
 * Component tests for src/auth/useAuth.ts. Covers (1) useAuth returns
 * context when wrapped in AuthProvider and (2) useAuth throws when used
 * outside AuthProvider (if (!ctx) branch).
 */
import React from 'react';
import { useAuth } from '@/auth/useAuth';
import { AuthContext, AuthProvider } from '@/auth/AuthContext';
import type { AuthContextValue } from '@/auth/AuthContext';

function AuthConsumer() {
  const auth = useAuth();
  return (
    <div data-testid="auth-consumer">
      <span data-testid="auth-token">{auth.token ?? 'null'}</span>
      <span data-testid="auth-authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="auth-user-phone">{auth.user?.phone ?? 'null'}</span>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div data-testid="auth-error">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

const mockAuthValue: AuthContextValue = {
  token: 'mock-token',
  refreshToken: 'mock-refresh',
  user: { id: '1', phone: '+911234567890', wholesalerId: 'wh-1' },
  hasWholesaler: true,
  isAuthenticated: true,
  setAuth: () => {},
  setTokensFromRefresh: () => {},
  clearToken: () => {},
};

describe('useAuth (component)', () => {
  describe('happy path (inside provider)', () => {
    it('returns mock context when wrapped in AuthContext.Provider with value', () => {
      cy.mount(
        <AuthContext.Provider value={mockAuthValue}>
          <AuthConsumer />
        </AuthContext.Provider>,
      );
      cy.get('[data-testid=auth-token]').should('have.text', 'mock-token');
      cy.get('[data-testid=auth-authenticated]').should('have.text', 'true');
      cy.get('[data-testid=auth-user-phone]').should('have.text', '+911234567890');
    });

    it('returns context value when wrapped in AuthProvider', () => {
      cy.mount(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>,
      );
      cy.get('[data-testid=auth-consumer]').should('be.visible');
      cy.get('[data-testid=auth-authenticated]').should('have.text', 'false');
    });
  });

  describe('guard clause (outside AuthContext.Provider)', () => {
    it('throws "useAuth must be used within AuthProvider" and Cypress handler asserts message', () => {
      let sawExpected = false;
      cy.on('uncaught:exception', (err) => {
        // Cypress wraps app exceptions with extra context text; assert the expected message is present.
        expect(err.message).to.include('useAuth must be used within AuthProvider');
        sawExpected = true;
        return false; // prevent Cypress from failing test for this expected error
      });
      cy.mount(
        <ErrorBoundary>
          <AuthConsumer />
        </ErrorBoundary>,
      );
      cy.then(() => {
        expect(sawExpected, 'saw expected uncaught exception').to.eq(true);
      });
      cy.get('[data-testid=auth-error]').should(
        'have.text',
        'useAuth must be used within AuthProvider',
      );
    });
  });
});
