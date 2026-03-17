describe('Landing and NotFound routing', () => {
  it('shows the welcome screen and navigates to auth flow from Get Started', () => {
    // No wholesaler in storage; user should see splash then Get Started
    cy.clearLocalStorage();

    cy.visit('/');

    cy.contains('Kanaka Dhara').should('be.visible');
    cy.contains('Track your textile business, effortlessly').should('be.visible');

    // After splash delay, Get Started button appears
    cy.contains('button', 'Get Started', { timeout: 4000 }).should('be.visible').click();

    // Unauthenticated users are redirected to login when trying to reach /register
    cy.url().should('include', '/login');
  });

  it('renders the NotFound page at /404', () => {
    cy.visit('/404');

    cy.contains('404').should('be.visible');
    cy.contains('Oops! Page not found').should('be.visible');
    cy.contains('Return to Home')
      .should('have.attr', 'href', '/');
  });

  it('redirects unknown routes to /404', () => {
    cy.visit('/this-route-does-not-exist', { failOnStatusCode: false });

    cy.url().should('include', '/404');
    cy.contains('Oops! Page not found').should('be.visible');
  });
});

