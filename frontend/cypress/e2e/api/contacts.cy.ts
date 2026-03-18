/**
 * Contacts API: GET list, POST create, PUT update.
 * Validates UI updates from mocked API responses.
 */
describe('Contacts API (mocked)', () => {
  const wholesalerStorageKey = 'ledger_wholesaler'

  beforeEach(() => {
    cy.clearAuth()
    cy.setAuthToken('test-access-token', 'test-refresh-token')
    cy.window().then((win) => {
      win.localStorage.setItem(
        wholesalerStorageKey,
        JSON.stringify({
          id: 'wh-1',
          shopName: 'Test Shop',
          ownerName: 'Test Owner',
          mobile: '+919876543210',
          address: 'Test Address',
          gstNumber: '',
          panNumber: '',
          tradeCreditDays: 30,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }),
      )
    })
  })

  describe('GET /api/v1/contacts', () => {
    it('displays contact list from mocked GET response', () => {
      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        fixture: 'api/contacts.json',
      }).as('getContacts')

      cy.visit('/home')
      cy.wait('@getContacts')

      cy.get('[data-testid="contact-item"]').should('have.length', 2)
      cy.contains('[data-testid="contact-item"]', 'Acme Corp').should('be.visible')
      cy.contains('[data-testid="contact-item"]', 'Global Supplies').should('be.visible')
    })
  })

  describe('POST /api/v1/contacts', () => {
    it('creates contact, shows success toast, and closes sheet when POST is mocked', () => {
      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        fixture: 'api/contacts.json',
      }).as('getContacts')
      cy.intercept('POST', '/api/v1/contacts', {
        statusCode: 200,
        fixture: 'api/contact-create.json',
      }).as('createContact')

      cy.visit('/home')
      cy.wait('@getContacts')

      cy.openAddContactSheet()
      cy.get('[data-testid="add-contact-name"]').type('New Contact')
      cy.get('[data-testid="add-contact-submit"]').click()

      cy.wait('@createContact')
      cy.get('[data-testid="add-contact-form"]').should('not.exist')

      cy.contains('Contact added').should('be.visible')
    })
  })

  describe('PUT /api/v1/contacts/:id', () => {
    const singleContact = {
      id: 'contact-1',
      wholesaler_id: 'wh-1',
      type: 'customer',
      name: 'Acme Corp',
      mobile: '+911234567890',
      city: 'Hyderabad',
      address: 'Main Road',
      gst_number: '',
      business_type: 'Retailer',
      notes: 'Preferred customer',
      balance: 1500,
      last_activity: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    it('updates contact when PUT is mocked and UI reflects success', () => {
      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        body: [singleContact],
      }).as('getContacts')
      cy.intercept('GET', '/api/v1/contacts/contact-1', {
        statusCode: 200,
        body: singleContact,
      }).as('getContact')
      cy.intercept('GET', '/api/v1/transactions*', { statusCode: 200, body: [] }).as('getTransactions')
      cy.intercept('GET', '/api/v1/orders*', { statusCode: 200, body: [] }).as('getOrders')
      cy.intercept('PUT', /^.*\/api\/v1\/contacts\/[^/]+$/, {
        statusCode: 200,
        body: { ...singleContact, name: 'Acme Corp Updated', updated_at: '2024-01-20T00:00:00Z' },
      }).as('putContact')

      cy.visit('/home')
      cy.wait('@getContacts')
      cy.get('[data-testid="contact-item"]').first().click()
      cy.wait('@getContact')
      cy.wait('@getTransactions')
      cy.wait('@getOrders')

      cy.get('[data-testid="chat-more-options"]').click()
      cy.contains('Edit contact').click()
      cy.get('[data-testid="edit-contact-form"]').should('be.visible')
      cy.get('[data-testid="edit-contact-name"]').clear().type('Acme Corp Updated')
      cy.get('[data-testid="edit-contact-submit"]').click()

      cy.wait('@putContact')
      cy.get('[data-testid="edit-contact-form"]').should('not.exist')

      cy.contains('Contact updated').should('be.visible')
    })
  })

  describe('Form validation', () => {
    it('shows validation error when name is too short', () => {
      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        fixture: 'api/contacts.json',
      }).as('getContacts')
      cy.intercept('POST', '/api/v1/contacts', {
        statusCode: 200,
        body: {},
      }).as('createContact')

      cy.visit('/home')
      cy.wait('@getContacts')

      cy.openAddContactSheet()
      cy.get('[data-testid="add-contact-name"]').type('A')
      cy.get('[data-testid="add-contact-submit"]').click()

      cy.get('[data-testid="add-contact-name-error"]').should(
        'contain.text',
        'Name must be at least 2 characters',
      )

      cy.get('@createContact.all').should('have.length', 0)
    })
  })

  describe('Search and filter', () => {
    it('filters contacts by search query', () => {
      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        body: [
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
            updated_at: '2024-01-01T00:00:00Z',
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
            updated_at: '2024-01-02T00:00:00Z',
          },
          {
            id: 'c3',
            wholesaler_id: 'wh-1',
            type: 'customer',
            name: 'Gamma Imports',
            mobile: '+933333333333',
            city: 'Hyderabad',
            address: 'Market Street',
            gst_number: '',
            business_type: 'Importer',
            notes: '',
            balance: 0,
            last_activity: '2024-01-03T00:00:00Z',
            created_at: '2024-01-03T00:00:00Z',
            updated_at: '2024-01-03T00:00:00Z',
          },
        ],
      }).as('getContacts')

      cy.visit('/home')
      cy.wait('@getContacts')

      cy.get('[data-testid="contact-item"]').should('have.length', 3)

      cy.get('[data-testid="contacts-search-input"]').type('Beta')
      cy.get('[data-testid="contact-item"]').should('have.length', 1)
      cy.contains('[data-testid="contact-item"]', 'Beta Supplies').should('be.visible')

      cy.get('[data-testid="contacts-search-input"]').clear()
      cy.get('[data-testid="contact-item"]').should('have.length', 3)
    })
  })

  describe('DELETE pattern (no app implementation yet)', () => {
    it('documents DELETE mock pattern for future use', () => {
      cy.intercept('GET', '/api/v1/contacts', {
        statusCode: 200,
        fixture: 'api/contacts.json',
      }).as('getContacts')
      cy.intercept('DELETE', '/api/v1/contacts/*', {
        statusCode: 204,
        body: null,
      }).as('deleteContact')

      cy.visit('/home')
      cy.wait('@getContacts')

      // When the app adds delete contact: trigger delete in UI, then:
      // cy.wait('@deleteContact')
      // cy.get('[data-testid="contact-item"]').should('have.length', 1)
      expect(true).to.be.true
    })
  })
})
