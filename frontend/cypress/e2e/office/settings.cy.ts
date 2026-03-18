describe('Office settings updates and persistence', () => {
  const wholesalerStorageKey = 'ledger_wholesaler';

  const seedWholesaler = () => {
    const wholesaler = {
      id: 'wh-1',
      shopName: 'Original Shop',
      ownerName: 'Original Owner',
      mobile: '+911234567890',
      address: 'Old Address',
      gstNumber: '',
      panNumber: '',
      tradeCreditDays: 30,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    // Seed auth token using shared helper so AuthContext picks it up
    cy.setAuthToken('office-access-token');

    cy.window().then(win => {
      win.localStorage.setItem(wholesalerStorageKey, JSON.stringify(wholesaler));
    });
  };

  it('updates account details and reflects the new shop name in the Home header', () => {
    seedWholesaler();

    cy.intercept('GET', '/api/v1/contacts', {
      statusCode: 200,
      body: [],
    }).as('getContacts');

    cy.intercept('PUT', '/api/v1/wholesalers/me', {
      statusCode: 200,
      body: {
        wholesaler: {
          id: 'wh-1',
          shopName: 'Updated Shop',
          ownerName: 'Updated Owner',
          mobile: '+911234567890',
          address: 'New Address',
          gstNumber: '',
          panNumber: '',
          tradeCreditDays: 30,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-10T00:00:00Z',
        },
      },
    }).as('updateWholesalerAccount');

    cy.visit('/home');
    cy.wait('@getContacts');

    // Initial header shows original shop name
    cy.contains('Original Shop').should('be.visible');

    // Go to Office tab
    cy.contains('button', 'Office').click();
    cy.contains('Account').should('be.visible');

    // Open Account sheet
    cy.contains('Account').click();
    cy.contains('Shop Name *').should('be.visible');

    // Update shop name and save
    cy.get('input[placeholder="Enter shop name"]').clear().type('Updated Shop');
    cy.contains('button', 'Save Changes').click();

    cy.wait('@updateWholesalerAccount');

    // Home header should now reflect updated shop name
    cy.contains('Updated Shop').should('be.visible');
  });

  it('updates trade credit days in settings and persists to storage', () => {
    seedWholesaler();

    cy.intercept('GET', '/api/v1/contacts', {
      statusCode: 200,
      body: [],
    }).as('getContacts');

    cy.intercept('PUT', '**/api/v1/wholesalers/me*', {
      statusCode: 200,
      body: {},
    }).as('updateWholesalerSettings');

    cy.visit('/home');
    cy.wait('@getContacts');

    cy.contains('button', 'Office').click();
    cy.contains('Settings').should('be.visible');

    // Open Settings sheet (click the Office menu item "Settings", not the sheet title)
    cy.contains('button', 'Settings').click();
    cy.contains('Trade Credit Period (Days)').should('be.visible');

    // Update trade credit days: replace value without clear to avoid invalid 0 (min 1)
    cy.get('input[name="tradeCreditDays"]').type('{selectall}45');
    cy.get('input[name="tradeCreditDays"]').should('have.value', '45');
    cy.contains('button', 'Save Settings').click();

    cy.wait('@updateWholesalerSettings');

    // Verify updated value persisted in localStorage
    cy.window()
      .its('localStorage')
      .invoke('getItem', wholesalerStorageKey)
      .should('not.be.null')
      .then(value => {
        const parsed = JSON.parse(value as string);
        expect(parsed.tradeCreditDays).to.eq(45);
      });
  });

  describe('GST and PAN validation on Account sheet', () => {
    const openAccountSheet = () => {
      seedWholesaler();
      cy.intercept('GET', '/api/v1/contacts', { statusCode: 200, body: [] }).as('getContacts');
      cy.visit('/home');
      cy.wait('@getContacts');
      cy.contains('button', 'Office').click();
      cy.contains('Account').click();
      cy.contains('Shop Name *').should('be.visible');
    };

    it('shows GST validation error and does not call API when GST is invalid in Account', () => {
      openAccountSheet();
      cy.intercept('PUT', '/api/v1/wholesalers/me').as('updateWholesaler');

      cy.get('input[name="gstNumber"]').clear().type('bad-gst');
      cy.contains('button', 'Save Changes').click();

      cy.contains('Enter a valid GST number').should('be.visible');
      cy.get('@updateWholesaler.all').should('have.length', 0);
    });

    it('shows PAN validation error and does not call API when PAN is invalid in Account', () => {
      openAccountSheet();
      cy.intercept('PUT', '/api/v1/wholesalers/me').as('updateWholesaler');

      cy.get('input[name="panNumber"]').clear().type('short');
      cy.contains('button', 'Save Changes').click();

      cy.contains('Enter a valid PAN number').should('be.visible');
      cy.get('@updateWholesaler.all').should('have.length', 0);
    });

    it('saves Account with valid GST and PAN', () => {
      openAccountSheet();
      cy.intercept('PUT', '/api/v1/wholesalers/me', {
        statusCode: 200,
        body: {
          wholesaler: {
            id: 'wh-1',
            shopName: 'Original Shop',
            ownerName: 'Original Owner',
            mobile: '+911234567890',
            address: 'Old Address',
            gstNumber: '27AAAAA0000A1Z5',
            panNumber: 'ABCDE1234F',
            tradeCreditDays: 30,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-10T00:00:00Z',
          },
        },
      }).as('updateWholesaler');

      cy.get('input[name="gstNumber"]').clear().type('27AAAAA0000A1Z5');
      cy.get('input[name="panNumber"]').clear().type('ABCDE1234F');
      cy.contains('button', 'Save Changes').click();

      cy.wait('@updateWholesaler');
    });
  });
});

