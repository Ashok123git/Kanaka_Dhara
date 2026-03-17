/**
 * 401 Unauthorized: when a protected API returns 401 and refresh fails,
 * the app clears token and redirects to /login.
 */
describe('401 Unauthorized', () => {
  const accessTokenKey = 'kanaka_dhara_token'
  const refreshTokenKey = 'kanaka_dhara_refresh_token'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.window().then((win) => win.sessionStorage.clear())
  })

  it('redirects to login and clears token when protected GET returns 401 and refresh fails', () => {
    cy.intercept('GET', '/api/v1/contacts', {
      statusCode: 401,
      body: { detail: 'Unauthorized' },
    }).as('getContacts401')

    cy.intercept('POST', '/api/v1/auth/refresh', {
      statusCode: 401,
      body: { detail: 'Invalid refresh token' },
    }).as('refresh401')

    cy.window().then((win) => {
      win.localStorage.setItem(accessTokenKey, 'expired-access-token')
      win.localStorage.setItem(refreshTokenKey, 'expired-refresh-token')
    })

    cy.visit('/home')
    cy.wait('@getContacts401')
    cy.wait('@refresh401')

    cy.url().should('include', '/login')
    cy.window()
      .its('localStorage')
      .invoke('getItem', accessTokenKey)
      .should('be.null')
    cy.window()
      .its('localStorage')
      .invoke('getItem', refreshTokenKey)
      .should('be.null')
  })
})
