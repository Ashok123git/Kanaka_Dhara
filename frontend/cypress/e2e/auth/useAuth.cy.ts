/**
 * E2E tests for src/auth/useAuth.ts. Verifies that useAuth() returns
 * AuthContext when the component is rendered inside AuthProvider (app root).
 */
describe('useAuth (E2E — inside AuthProvider)', () => {
  beforeEach(() => {
    cy.clearAuth()
  })

  it('returns context and displays token and isAuthenticated when wrapped in AuthProvider', () => {
    cy.setAuthToken('test-token-123', 'test-refresh-token')
    cy.visit('/auth-demo')

    cy.get('[data-testid=auth-demo]').should('be.visible')
    cy.get('[data-testid=auth-token]').should('have.text', 'test-token-123')
    cy.get('[data-testid=auth-authenticated]').should('have.text', 'true')
  })

  it('returns context with null token when not authenticated', () => {
    cy.visit('/auth-demo')

    cy.get('[data-testid=auth-demo]').should('be.visible')
    cy.get('[data-testid=auth-token]').should('have.text', 'null')
    cy.get('[data-testid=auth-authenticated]').should('have.text', 'false')
  })
})
