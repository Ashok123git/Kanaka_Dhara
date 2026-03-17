describe('Login via phone + OTP', () => {
  const accessTokenKey = 'kanaka_dhara_token'
  const refreshTokenKey = 'kanaka_dhara_refresh_token'

  beforeEach(() => {
    cy.clearLocalStorage()
    cy.window().then((win) => {
      win.sessionStorage.clear()
    })

    cy.intercept('POST', '/api/v1/auth/send-otp', {
      statusCode: 200,
      body: {
        message: 'OTP sent successfully',
        dev_otp: '123456',
      },
    }).as('sendOtp')
  })

  it('stores token and redirects on successful OTP verification', () => {
    cy.intercept('POST', '/api/v1/auth/verify-otp', {
      statusCode: 200,
      body: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        user: {
          id: '1',
          phone: '+911234567890',
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
        mobile: '+911234567890',
        address: 'Test Address',
        gstNumber: '',
        panNumber: '',
        tradeCreditDays: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }).as('getMyWholesaler')

    cy.visit('/login')

    cy.get('[data-testid="phone-input"]').type('9876543210')
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

    cy.get('[data-testid="otp-error"]').should('not.exist')
  })

  it('shows error and does not store token for invalid OTP', () => {
    cy.intercept('POST', '/api/v1/auth/verify-otp', {
      statusCode: 400,
      body: {
        detail: {
          error_code: 'INVALID_OTP',
          message: 'Invalid code, please try again.',
        },
      },
    }).as('verifyOtpError')

    cy.visit('/login')

    cy.get('[data-testid="phone-input"]').type('9876543210')
    cy.get('[data-testid="send-otp-button"]').click()
    cy.wait('@sendOtp')

    cy.get('[data-testid="otp-input-0"]').should('be.visible')

    cy.get('[data-testid="otp-input-0"]').clear().type('0')
    cy.get('[data-testid="otp-input-1"]').clear().type('0')
    cy.get('[data-testid="otp-input-2"]').clear().type('0')
    cy.get('[data-testid="otp-input-3"]').clear().type('0')
    cy.get('[data-testid="otp-input-4"]').clear().type('0')
    cy.get('[data-testid="otp-input-5"]').clear().type('0')

    cy.get('[data-testid="verify-otp-button"]').click()
    cy.wait('@verifyOtpError')

    cy.get('[data-testid="otp-error"]')
      .should('be.visible')
      .and('contain', 'Invalid code, please try again.')

    cy.window()
      .its('localStorage')
      .invoke('getItem', accessTokenKey)
      .should('be.null')

    cy.url().should('include', '/login')
    cy.url().should('not.include', '/home')
  })
})
