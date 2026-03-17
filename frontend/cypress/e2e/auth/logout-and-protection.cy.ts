describe('Logout behavior and route protection', () => {
  const accessTokenKey = 'kanaka_dhara_token';
  const refreshTokenKey = 'kanaka_dhara_refresh_token';

  const assertTokensCleared = () => {
    cy.window()
      .its('localStorage')
      .invoke('getItem', accessTokenKey)
      .should('be.null');

    cy.window()
      .its('localStorage')
      .invoke('getItem', refreshTokenKey)
      .should('be.null');
  };

  it('logs out from Home and protects subsequent access to protected routes', () => {
    cy.setAuthToken('valid-access-token', 'valid-refresh-token');

    cy.intercept('GET', '/api/v1/contacts', {
      statusCode: 200,
      body: [],
    }).as('getContacts');

    cy.visit('/home');
    cy.wait('@getContacts');

    // Open header menu and click Logout
    cy.get('button[aria-label="More options"]').click();
    cy.contains('Logout').click();

    cy.url().should('include', '/login');
    assertTokensCleared();

    // Visiting /home again should redirect back to /login via ProtectedRoute
    cy.visit('/home');
    cy.url().should('include', '/login');

    // Visiting /chat/:contactId should also be protected
    cy.visit('/chat/contact-1');
    cy.url().should('include', '/login');
  });

  it('logs out from Register and protects subsequent access', () => {
    cy.setAuthToken('valid-access-token-2', 'valid-refresh-token-2');

    cy.visit('/register');

    // Open header menu and click Logout
    cy.get('button[aria-label="More options"]').click();
    cy.contains('Logout').click();

    cy.url().should('include', '/login');
    assertTokensCleared();

    // Protected routes should redirect to login
    cy.visit('/home');
    cy.url().should('include', '/login');

    cy.visit('/chat/contact-1');
    cy.url().should('include', '/login');
  });
});

