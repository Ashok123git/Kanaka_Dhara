describe('Chat ledger page', () => {
  const accessTokenKey = 'kanaka_dhara_token';

  const baseTransactions = [
    {
      id: 'txn-1',
      contact_id: 'contact-1',
      wholesaler_id: 'wh-1',
      type: 'order_received',
      date: '2024-01-01',
      order_id: 'order-1',
      amount: 1000,
      notes: 'Initial order',
      payment_mode: null,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'txn-2',
      contact_id: 'contact-1',
      wholesaler_id: 'wh-1',
      type: 'payment_received',
      date: '2024-01-02',
      order_id: 'order-1',
      amount: 200,
      notes: 'Advance payment',
      payment_mode: 'upi',
      created_at: '2024-01-02T11:00:00Z',
      updated_at: '2024-01-02T11:00:00Z',
      attachments: [
        { url: 'https://example.com/receipt-1.jpg' },
        { url: 'https://example.com/receipt-2.jpg' },
      ],
    },
  ];

  const setAuthenticatedSession = () => {
    // NOTE: for tests that navigate directly to /chat/:contactId, set the token in `onBeforeLoad`
    // (AuthProvider reads localStorage on initial render).
    cy.window().then(win => {
      win.localStorage.setItem(accessTokenKey, 'chat-access-token');
    });
  };

  const mockContactAndOrders = () => {
    cy.intercept('GET', '/api/v1/contacts/contact-1', {
      statusCode: 200,
      body: {
        id: 'contact-1',
        wholesaler_id: 'wh-1',
        type: 'customer',
        name: 'Acme Corp',
        mobile: '+911234567890',
        city: 'Hyderabad',
        address: 'Main Road',
        gst_number: '',
        business_type: 'Retailer',
        notes: '',
        balance: 800,
        last_activity: '2024-01-03T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      },
    }).as('getContact');

    cy.intercept('GET', '/api/v1/orders?contact_id=contact-1', {
      statusCode: 200,
      body: [
        {
          id: 'order-1',
          contact_id: 'contact-1',
          wholesaler_id: 'wh-1',
          order_number: 'ORD-1',
          date: '2024-01-01',
          total_value: 1000,
          paid_amount: 200,
          returned_value: 0,
          discount: 0,
          status: 'open',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ],
    }).as('getOrders');
  };

  const mockTransactionsStatic = () => {
    cy.intercept('GET', '**/api/v1/transactions*', {
      statusCode: 200,
      body: baseTransactions,
    }).as('getTransactions');
  };

  const newTransaction = {
    id: 'txn-3',
    contact_id: 'contact-1',
    wholesaler_id: 'wh-1',
    type: 'payment_received',
    date: '2024-01-03',
    order_id: 'order-1',
    amount: 300,
    notes: 'Second payment',
    payment_mode: 'cash',
    created_at: '2024-01-03T12:00:00Z',
    updated_at: '2024-01-03T12:00:00Z',
  };

  const mockTransactionsWithDynamicRefetch = () => {
    let callCount = 0;
    cy.intercept('GET', '**/api/v1/transactions*', req => {
      callCount += 1;
      // Return base only for first 2 calls (initial load may fire twice); then base + new after refetch
      const body = callCount <= 2 ? baseTransactions : [...baseTransactions, newTransaction];
      req.reply({ statusCode: 200, body });
    }).as('getTransactions');
  };

  const visitChat = () => {
    setAuthenticatedSession();
    mockContactAndOrders();
    mockTransactionsWithDynamicRefetch();

    cy.visit('/chat/contact-1');
    cy.wait(['@getContact', '@getOrders', '@getTransactions']);
  };

  it('loads transactions, shows header balance, and supports searching', () => {
    setAuthenticatedSession();
    mockContactAndOrders();
    mockTransactionsStatic();
    cy.visit('/chat/contact-1');
    cy.wait(['@getContact', '@getOrders', '@getTransactions']);

    // Header shows contact and balance (1000 - 200 = 800)
    cy.contains('Acme Corp').should('be.visible');
    cy.contains('Customer • Retailer').should('be.visible');
    // Intl.NumberFormat may insert narrow no-break space (U+202F) or other Unicode space
    cy.get('[data-testid="chat-header-balance"]').invoke('text').should('match', /₹[\s\u00a0\u202f]*800/);

    // Two transaction bubbles rendered with correct labels
    cy.contains('Order Received').should('be.visible');
    cy.contains('Payment Received').should('be.visible');
    cy.contains('via UPI').should('be.visible');
    cy.contains('Order #ORD-1').should('be.visible');

    // Open search and filter by type label
    cy.get('button[aria-label="Search transactions"]').click();
    cy.get('input[aria-label="Search transactions"]').type('Payment');

    cy.contains('Payment Received').should('be.visible');
    cy.contains('Order Received').should('not.exist');

    // No-match state
    cy.get('input[aria-label="Search transactions"]').clear().type('ZZZ');
    cy.contains('No transactions match your search').should('be.visible');
  });

  it('opens attachment viewer when clicking a bubble with attachments', () => {
    visitChat();

    // Click the payment bubble which has attachments
    cy.contains('Payment Received').click();

    // Attachment viewer dialog should open
    cy.get('img[alt="Attachment 1"]').should('be.visible');
  });

  it('adds a new payment transaction and updates the header balance', () => {
    // Intercepts MUST be defined before visiting so Cypress never misses requests.
    mockContactAndOrders();
    mockTransactionsWithDynamicRefetch();

    cy.intercept('POST', '**/api/v1/transactions*', (req) => {
      req.reply({ statusCode: 201, body: { id: 'txn-3' } });
    }).as('createTransaction');

    cy.visit('/chat/contact-1', {
      onBeforeLoad(win) {
        win.localStorage.setItem(accessTokenKey, 'chat-access-token');
      },
    });
    cy.wait(['@getContact', '@getOrders', '@getTransactions']);

    // Initial balance: normalize whitespace (Intl formats may include NBSP / narrow NBSP)
    cy.get('[data-testid="chat-header-balance"]')
      .invoke('text')
      .then((t) => t.replace(/\s/g, ''))
      .should('include', '₹800');

    // Open action menu from FAB → Received Payment
    cy.get('button[aria-label="Add transaction"]').click();
    cy.contains('button', 'Received Payment').click();

    // REQUIRED: pick an order when open orders exist (prevents silent no-op submit)
    cy.get('[data-testid="order-select-trigger"]').click({ force: true });
    cy.contains('[role="option"]', '#ORD-1').click({ force: true });
    cy.get('[data-testid="order-select-trigger"]').should('contain.text', 'ORD-1');

    // Fill amount and save (use stable selector)
    cy.get('input#amount').clear().type('300');
    cy.get('[data-testid="submit-transaction"]').should('not.be.disabled').click();

    cy.wait('@createTransaction', { timeout: 20000 }).then((i) => {
      expect(i.request.method).to.eq('POST');
      expect([200, 201]).to.include(i.response?.statusCode);
      // Verify request body shape
      const body = i.request.body as Record<string, unknown>;
      expect(body).to.include({
        contact_id: 'contact-1',
        type: 'payment_received',
        order_id: 'order-1',
        amount: 300,
      });
    });

    // Wait for refetch (GET /transactions) and then assert UI updates
    cy.wait('@getTransactions');
    cy.contains('Payment Received').should('be.visible');
    cy.contains(/₹[\s\u00a0\u202f]*300/).should('be.visible');

    // New balance should reflect second payment: 1000 - (200 + 300) = 500
    cy.get('[data-testid="chat-header-balance"]')
      .invoke('text')
      .then((t) => t.replace(/\s/g, ''))
      .should('include', '₹500');
  });
});

