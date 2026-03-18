describe('Auth guard and JWT behavior', () => {
  describe('unauthenticated redirect', () => {
    it('redirects to login when visiting protected route without token', () => {
      cy.clearLocalStorage()
      cy.clearAuth()

      cy.visit('/home')

      cy.url().should('include', '/login')

      cy.window()
        .its('localStorage')
        .invoke('getItem', 'kanaka_dhara_token')
        .should('be.null')
    })
  })

  describe('expired token / 401 handling', () => {
    it('clears tokens and redirects to login on 401 + failed refresh', () => {
      cy.setAuthToken('expired-access-token', 'expired-refresh-token')
      
      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 401,
        body: { detail: 'Token expired' },
      }).as('getContacts401')
      
      cy.intercept('POST', '/api/v1/auth/refresh', {
        statusCode: 401,
        body: { detail: 'Invalid refresh' },
      }).as('refresh401')
      
      cy.visit('/home')
      
      cy.wait('@getContacts401')
      cy.wait('@refresh401')
      
      cy.url().should('include', '/login')
      cy.url().should('not.include', '/home')
      
      cy.window()
        .its('localStorage')
        .invoke('getItem', 'kanaka_dhara_token')
        .should('be.null')
      
      cy.window()
        .its('localStorage')
        .invoke('getItem', 'kanaka_dhara_refresh_token')
        .should('be.null')
    })
  })

  describe('valid token access', () => {
    it('allows access to protected route when token is present and API succeeds', () => {
      cy.setAuthToken('valid-access-token', 'valid-refresh-token')

      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        fixture: 'api/contacts.json',
      }).as('getContacts')

      cy.visit('/home')
      cy.wait('@getContacts')

      cy.url().should('include', '/home')

      cy.get('[data-testid="contact-item"]').should('have.length.at.least', 1)

      cy.window()
        .its('localStorage')
        .invoke('getItem', 'kanaka_dhara_token')
        .should('eq', 'valid-access-token')
    })

    it('reads token from localStorage on initial load and stays on protected route', () => {
      cy.setAuthToken('valid-access-token-2', 'valid-refresh-token-2')

      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        fixture: 'api/contacts.json',
      }).as('getContacts')

      cy.visit('/home')
      cy.wait('@getContacts')

      cy.url().should('include', '/home')

      cy.window()
        .its('localStorage')
        .invoke('getItem', 'kanaka_dhara_token')
        .should('eq', 'valid-access-token-2')
    })
  })
})

