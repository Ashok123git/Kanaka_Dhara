describe('Registration onboarding from OTP login', () => {
  const accessTokenKey = 'kanaka_dhara_token';
  const refreshTokenKey = 'kanaka_dhara_refresh_token';
  const wholesalerStorageKey = 'ledger_wholesaler';

  const interceptOtpFlowWithoutWholesaler = () => {
    cy.clearLocalStorage();
    cy.window().then(win => {
      win.sessionStorage.clear();
    });

    cy.intercept('POST', '/api/v1/auth/send-otp', {
      statusCode: 200,
      body: {
        message: 'OTP sent successfully',
        dev_otp: '654321',
      },
    }).as('sendOtp');

    cy.intercept('POST', '/api/v1/auth/verify-otp', {
      statusCode: 200,
      body: {
        access_token: 'otp-access-token',
        refresh_token: 'otp-refresh-token',
        token_type: 'bearer',
        user: {
          id: '1',
          phone: '+919876543210',
          wholesalerId: null,
        },
        has_wholesaler: false,
      },
    }).as('verifyOtpNoWholesaler');
  };

  it('redirects to /register when user has no wholesaler and completes registration', () => {
    interceptOtpFlowWithoutWholesaler();

    // Start login flow
    cy.visit('/login');
    cy.get('[data-testid="phone-input"]').type('9876543210');
    cy.get('[data-testid="send-otp-button"]').click();
    cy.wait('@sendOtp');

    // OTP step should be visible; dev_otp will be auto-filled
    cy.get('[data-testid="otp-input-0"]').should('be.visible');
    cy.get('[data-testid="verify-otp-button"]').click();
    cy.wait('@verifyOtpNoWholesaler');

    // Should navigate to registration page instead of home
    cy.url().should('include', '/register');

    // Tokens should already be stored from OTP login
    cy.window()
      .its('localStorage')
      .invoke('getItem', accessTokenKey)
      .should('eq', 'otp-access-token');

    cy.window()
      .its('localStorage')
      .invoke('getItem', refreshTokenKey)
      .should('eq', 'otp-refresh-token');

    // Mock registration API
    cy.intercept('PUT', '/api/v1/wholesalers/me', {
      statusCode: 200,
      body: {
        wholesaler: {
          id: 'wh-123',
          shopName: 'My Test Shop',
          ownerName: 'Test Owner',
          mobile: '+919876543210',
          address: 'Test Address',
          gstNumber: '',
          panNumber: '',
          tradeCreditDays: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        access_token: 'registered-access-token',
        token_type: 'bearer',
        has_wholesaler: true,
      },
    }).as('updateWholesaler');

    // Fill registration form with valid values
    cy.get('input[name="shopName"]').type('My Test Shop');
    cy.get('input[name="ownerName"]').type('Test Owner');
    cy.get('input[name="mobile"]').type('9876543210');
    cy.get('textarea[name="address"]').type('Test Address');

    cy.contains('button', 'Register & Continue').click();
    cy.wait('@updateWholesaler');

    // Should eventually land on /home after success screen
    cy.url({ timeout: 5000 }).should('include', '/home');

    // Access token should be updated from registration response
    cy.window()
      .its('localStorage')
      .invoke('getItem', accessTokenKey)
      .should('eq', 'registered-access-token');

    // Wholesaler should be saved in storage for Home header
    cy.window()
      .its('localStorage')
      .invoke('getItem', wholesalerStorageKey)
      .should('not.be.null')
      .then(value => {
        const parsed = JSON.parse(value as string);
        expect(parsed.shopName).to.eq('My Test Shop');
      });
  });

  it('shows validation errors and does not submit when required fields are invalid', () => {
    interceptOtpFlowWithoutWholesaler();

    cy.visit('/login');
    cy.get('[data-testid="phone-input"]').type('9876543210');
    cy.get('[data-testid="send-otp-button"]').click();
    cy.wait('@sendOtp');

    cy.get('[data-testid="otp-input-0"]').should('be.visible');
    cy.get('[data-testid="verify-otp-button"]').click();
    cy.wait('@verifyOtpNoWholesaler');

    cy.url().should('include', '/register');
    cy.contains('Register Your Business').should('be.visible');

    cy.intercept('PUT', '/api/v1/wholesalers/me').as('updateWholesaler');

    // Intentionally provide invalid/too-short values
    cy.get('input[name="shopName"]').should('be.visible').should('not.be.disabled').clear().type('A');
    cy.get('input[name="ownerName"]').should('be.visible').should('not.be.disabled').clear().type('B');
    cy.get('input[name="mobile"]')
      .should('be.visible')
      .should('not.be.disabled')
      .clear()
      .type('123'); // too short

    cy.contains('button', 'Register & Continue').should('be.visible').should('not.be.disabled').click();

    // Expect validation messages
    cy.contains('Shop name must be at least 2 characters').should('be.visible');
    cy.contains('Owner name must be at least 2 characters').should('be.visible');
    cy.contains('Enter a valid mobile number').should('be.visible');

    // No API call should have been made
    cy.get('@updateWholesaler.all').should('have.length', 0);
  });

  describe('GST and PAN validation on Register', () => {
    const goToRegisterForm = () => {
      interceptOtpFlowWithoutWholesaler();
      cy.visit('/login');
      cy.get('[data-testid="phone-input"]').type('9876543210');
      cy.get('[data-testid="send-otp-button"]').click();
      cy.wait('@sendOtp');
      cy.get('[data-testid="otp-input-0"]').should('be.visible');
      cy.get('[data-testid="verify-otp-button"]').click();
      cy.wait('@verifyOtpNoWholesaler');
      cy.url().should('include', '/register');
    };

    it('shows GST validation error and does not submit when GST is invalid', () => {
      goToRegisterForm();
      cy.intercept('PUT', '/api/v1/wholesalers/me').as('updateWholesaler');

      cy.get('input[name="shopName"]').type('My Test Shop');
      cy.get('input[name="ownerName"]').type('Test Owner');
      cy.get('input[name="mobile"]').type('9876543210');
      cy.get('textarea[name="address"]').type('Test Address');
      cy.get('input[name="gstNumber"]').type('invalid-gst');

      cy.contains('button', 'Register & Continue').click();

      cy.contains('Enter a valid GST number').should('be.visible');
      cy.get('@updateWholesaler.all').should('have.length', 0);
    });

    it('shows PAN validation error and does not submit when PAN is invalid', () => {
      goToRegisterForm();
      cy.intercept('PUT', '/api/v1/wholesalers/me').as('updateWholesaler');

      cy.get('input[name="shopName"]').type('My Test Shop');
      cy.get('input[name="ownerName"]').type('Test Owner');
      cy.get('input[name="mobile"]').type('9876543210');
      cy.get('textarea[name="address"]').type('Test Address');
      cy.get('input[name="panNumber"]').type('12345');

      cy.contains('button', 'Register & Continue').click();

      cy.contains('Enter a valid PAN number').should('be.visible');
      cy.get('@updateWholesaler.all').should('have.length', 0);
    });

    it('submits successfully with valid GST and PAN', () => {
      goToRegisterForm();
      cy.intercept('PUT', '/api/v1/wholesalers/me', {
        statusCode: 200,
        body: {
          wholesaler: {
            id: 'wh-123',
            shopName: 'My Test Shop',
            ownerName: 'Test Owner',
            mobile: '+919876543210',
            address: 'Test Address',
            gstNumber: '27AAAAA0000A1Z5',
            panNumber: 'ABCDE1234F',
            tradeCreditDays: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          access_token: 'registered-access-token',
          token_type: 'bearer',
          has_wholesaler: true,
        },
      }).as('updateWholesaler');

      cy.get('input[name="shopName"]').type('My Test Shop');
      cy.get('input[name="ownerName"]').type('Test Owner');
      cy.get('input[name="mobile"]').type('9876543210');
      cy.get('textarea[name="address"]').type('Test Address');
      cy.get('input[name="gstNumber"]').type('27AAAAA0000A1Z5');
      cy.get('input[name="panNumber"]').type('ABCDE1234F');

      cy.contains('button', 'Register & Continue').click();
      cy.wait('@updateWholesaler');

      cy.url({ timeout: 5000 }).should('include', '/home');
    });
  });
});

