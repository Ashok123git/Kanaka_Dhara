/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      loginWithOtp(phone?: string, devOtp?: string): Chainable<void>
      openAddContactSheet(): Chainable<void>
      fillContactForm(values: { name?: string; mobile?: string; city?: string }): Chainable<void>
      setAuthToken(accessToken: string, refreshToken?: string): Chainable<void>
      clearAuth(): Chainable<void>
    }
  }
}

Cypress.Commands.add('loginWithOtp', (phone = '9876543210', devOtp = '123456') => {
  const accessTokenKey = 'kanaka_dhara_token'
  const refreshTokenKey = 'kanaka_dhara_refresh_token'

  cy.clearLocalStorage()
  cy.window().then((win) => {
    win.sessionStorage.clear()
  })

  cy.intercept('POST', '/api/v1/auth/send-otp', {
    statusCode: 200,
    body: {
      message: 'OTP sent successfully',
      dev_otp: devOtp,
    },
  }).as('sendOtp')

  cy.intercept('POST', '/api/v1/auth/verify-otp', {
    statusCode: 200,
    body: {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      user: {
        id: '1',
        phone: `+91${phone}`,
        wholesalerId: 'wh-1',
      },
      has_wholesaler: true,
    },
  }).as('verifyOtpSuccess')

  cy.intercept('GET', '/api/v1/wholesalers/me', {
    statusCode: 200,
    body: {
      id: 'wh-1',
      shopName: 'Test Shop',
      ownerName: 'Test Owner',
      mobile: `+91${phone}`,
      address: 'Test Address',
      gstNumber: '',
      panNumber: '',
      tradeCreditDays: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }).as('getMyWholesaler')

  cy.visit('/login')

  cy.get('[data-testid="phone-input"]').type(phone)
  cy.get('[data-testid="send-otp-button"]').click()
  cy.wait('@sendOtp')

  cy.get('[data-testid="otp-input-0"]').should('be.visible')
  cy.get('[data-testid="verify-otp-button"]').click()
  cy.wait('@verifyOtpSuccess')
  cy.wait('@getMyWholesaler')

  cy.window()
    .its('localStorage')
    .invoke('getItem', accessTokenKey)
    .should('eq', 'test-access-token')

  cy.window()
    .its('localStorage')
    .invoke('getItem', refreshTokenKey)
    .should('eq', 'test-refresh-token')

  cy.url().should('include', '/home')
})

Cypress.Commands.add('openAddContactSheet', () => {
  cy.get('[data-testid="add-contact-button"]').click()
  cy.get('[data-testid="add-contact-form"]').should('be.visible')
})

Cypress.Commands.add('fillContactForm', (values: { name?: string; mobile?: string; city?: string }) => {
  if (values.name !== undefined) {
    cy.get('[data-testid="add-contact-name"]').clear().type(values.name)
  }
  if (values.mobile !== undefined) {
    cy.get('input[name="mobile"]').clear().type(values.mobile)
  }
  if (values.city !== undefined) {
    cy.get('input[name="city"]').clear().type(values.city)
  }
})

Cypress.Commands.add('setAuthToken', (accessToken: string, refreshToken?: string) => {
  cy.window().then((win) => {
    win.localStorage.setItem('kanaka_dhara_token', accessToken)
    if (refreshToken !== undefined) {
      win.localStorage.setItem('kanaka_dhara_refresh_token', refreshToken)
    }
  })
})

Cypress.Commands.add('clearAuth', () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('kanaka_dhara_token')
    win.localStorage.removeItem('kanaka_dhara_refresh_token')
    win.sessionStorage.clear()
  })
})

export {}
