describe('Home tabs and contact filters', () => {
  const accessTokenKey = 'kanaka_dhara_token';

  const setAuthenticatedSession = () => {
    cy.window().then(win => {
      win.localStorage.setItem(accessTokenKey, 'valid-access-token');
    });
  };

  const interceptContacts = (body: unknown) => {
    cy.intercept('GET', '/api/v1/contacts', {
      statusCode: 200,
      body,
    }).as('getContacts');
  };

  const selectCity = (city: string) => {
    cy.get('[data-testid="contacts-city-filter"]').click();
    cy.contains('[role="option"]', city).click();
  };

  const clearCityFilter = () => {
    cy.get('[data-testid="contacts-city-filter"]').click();
    cy.contains('[role="option"]', 'All Cities').click();
  };

  it('switches between customers, suppliers, and office tabs', () => {
    setAuthenticatedSession();

    interceptContacts([
      {
        id: 'c1',
        wholesaler_id: 'wh-1',
        type: 'customer',
        name: 'Customer One',
        mobile: '+911111111111',
        city: 'Hyderabad',
        address: 'Main Road',
        gst_number: '',
        business_type: 'Retailer',
        notes: '',
        balance: 1000,
        last_activity: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 's1',
        wholesaler_id: 'wh-1',
        type: 'supplier',
        name: 'Supplier One',
        mobile: '+922222222222',
        city: 'Mumbai',
        address: 'Industrial Area',
        gst_number: '',
        business_type: 'Wholesale',
        notes: '',
        balance: -500,
        last_activity: '2024-01-02T00:00:00Z',
        created_at: '2024-01-02T00:00:00Z',
      },
    ]);

    cy.visit('/home');
    cy.wait('@getContacts');

    // Customers tab is active by default
    cy.contains('[data-testid="contact-item"]', 'Customer One').should('be.visible');
    cy.contains('[data-testid="contact-item"]', 'Supplier One').should('not.exist');

    // Switch to Suppliers tab
    cy.contains('button', 'Suppliers').click();
    cy.contains('[data-testid="contact-item"]', 'Supplier One').should('be.visible');
    cy.contains('[data-testid="contact-item"]', 'Customer One').should('not.exist');

    // Switch to Office tab
    cy.contains('button', 'Office').click();
    cy.contains('Account').should('be.visible');
    cy.contains('Settings').should('be.visible');
  });

  it('filters contacts by search query and city within the active tab', () => {
    setAuthenticatedSession();

    interceptContacts([
      {
        id: 'c1',
        wholesaler_id: 'wh-1',
        type: 'customer',
        name: 'Alpha Traders',
        mobile: '+911111111111',
        city: 'Hyderabad',
        address: 'Main Road',
        gst_number: '',
        business_type: 'Retailer',
        notes: '',
        balance: 0,
        last_activity: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'c2',
        wholesaler_id: 'wh-1',
        type: 'customer',
        name: 'Beta Supplies',
        mobile: '+922222222222',
        city: 'Mumbai',
        address: 'Industrial Area',
        gst_number: '',
        business_type: 'Wholesale',
        notes: '',
        balance: 0,
        last_activity: '2024-01-02T00:00:00Z',
        created_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 's1',
        wholesaler_id: 'wh-1',
        type: 'supplier',
        name: 'Supplier One',
        mobile: '+933333333333',
        city: 'Hyderabad',
        address: 'Market Street',
        gst_number: '',
        business_type: 'Importer',
        notes: '',
        balance: 0,
        last_activity: '2024-01-03T00:00:00Z',
        created_at: '2024-01-03T00:00:00Z',
      },
    ]);

    cy.visit('/home');
    cy.wait('@getContacts');

    // Customers tab: three contacts, two cities
    cy.get('[data-testid="contact-item"]').should('have.length', 2);

    // Filter by city
    selectCity('Hyderabad');
    cy.get('[data-testid="contact-item"]').should('have.length', 1);
    cy.contains('[data-testid="contact-item"]', 'Alpha Traders').should('be.visible');

    // Clear city filter and use text search
    clearCityFilter();
    cy.get('[data-testid="contacts-search-input"]').type('Beta');
    cy.get('[data-testid="contact-item"]').should('have.length', 1);
    cy.contains('[data-testid="contact-item"]', 'Beta Supplies').should('be.visible');

    // Switch to Suppliers tab: only supplier should be shown
    cy.contains('button', 'Suppliers').click();
    cy.get('[data-testid="contact-item"]').should('have.length', 1);
    cy.contains('[data-testid="contact-item"]', 'Supplier One').should('be.visible');
  });

  it('shows an empty state when there are no contacts in the active tab', () => {
    setAuthenticatedSession();

    interceptContacts([]);

    cy.visit('/home');
    cy.wait('@getContacts');

    cy.contains('No Customers Yet').should('be.visible');
    cy.contains('Tap the + button to add your first customer').should('be.visible');
  });
});

