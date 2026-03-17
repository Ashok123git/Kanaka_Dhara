/**
 * E2E tests for src/lib/storage.ts — getContacts, saveContacts, addContact,
 * updateContact, getTransactions. Uses cy.window() to invoke storage API
 * exposed when running under Cypress. Clears storage in beforeEach to simulate
 * and control localStorage. Targets 90%+ coverage of storage.ts branches.
 */

const CONTACTS_KEY = 'ledger_contacts'
const TRANSACTIONS_KEY = 'ledger_transactions'

const baseContact = {
  wholesalerId: 'wh-1',
  type: 'customer' as const,
  mobile: '+919876543210',
  city: 'Mumbai',
  address: '123 Test St',
  gstNumber: '',
  businessType: 'Retail',
  notes: '',
  balance: 0,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
}

const contactWithLastActivity = {
  ...baseContact,
  id: 'c-with-activity',
  name: 'Contact With Activity',
  lastActivity: '2024-02-01T12:00:00.000Z',
}

const contactWithoutLastActivity = {
  ...baseContact,
  id: 'c-no-activity',
  name: 'Contact No Activity',
  lastActivity: null as string | null,
}

const sampleTransaction = {
  id: 'tx-1',
  contactId: 'c-with-activity',
  wholesalerId: 'wh-1',
  type: 'sale' as const,
  date: '2024-01-20T09:00:00.000Z',
  orderId: null as string | null,
  amount: 1000,
  notes: 'Test transaction',
  paymentMode: 'cash',
  createdAt: '2024-01-20T09:00:00.000Z',
  updatedAt: '2024-01-20T09:00:00.000Z',
}

function assertValidDate(value: unknown): void {
  expect(value).to.exist
  expect(Number(new Date(value as string | Date))).to.be.finite
}

describe('Storage — getContacts, saveContacts, addContact, updateContact, getTransactions', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.window().invoke('clearAllData')
  })

  describe('getContacts()', () => {
    it('returns empty array when localStorage has no data (covers if (!data))', () => {
      cy.window().invoke('getContacts').should('deep.equal', [])
    })

    it('returns empty array when contacts key is missing', () => {
      cy.window().then((win) => win.localStorage.removeItem(CONTACTS_KEY))
      cy.window().invoke('getContacts').should('deep.equal', [])
    })

    it('parses stored contacts and converts createdAt and lastActivity to Date when lastActivity exists', () => {
      cy.window().then((win) => {
        win.localStorage.setItem(CONTACTS_KEY, JSON.stringify([contactWithLastActivity]))
      })
      cy.window()
        .invoke('getContacts')
        .then((contacts: unknown) => {
          const list = contacts as Array<{ name: string; createdAt: unknown; lastActivity: unknown }>
          expect(list).to.have.length(1)
          expect(list[0].name).to.eq('Contact With Activity')
          assertValidDate(list[0].createdAt)
          assertValidDate(list[0].lastActivity)
        })
    })

    it('parses stored contacts and sets lastActivity to undefined when null or absent (covers ternary branch)', () => {
      cy.window().then((win) => {
        win.localStorage.setItem(CONTACTS_KEY, JSON.stringify([contactWithoutLastActivity]))
      })
      cy.window()
        .invoke('getContacts')
        .then((contacts: unknown) => {
          const list = contacts as Array<{ name: string; createdAt: unknown; lastActivity: unknown }>
          expect(list).to.have.length(1)
          expect(list[0].name).to.eq('Contact No Activity')
          assertValidDate(list[0].createdAt)
          expect(list[0].lastActivity).to.be.undefined
        })
    })

    it('returns multiple contacts with correct date conversion for all', () => {
      cy.window().then((win) => {
        win.localStorage.setItem(
          CONTACTS_KEY,
          JSON.stringify([contactWithLastActivity, contactWithoutLastActivity]),
        )
      })
      cy.window().invoke('getContacts').then((contacts: unknown) => {
        const list = contacts as Array<{ id: string; createdAt: unknown; lastActivity: unknown }>
        expect(list).to.have.length(2)
        list.forEach((c) => assertValidDate(c.createdAt))
        expect(list[0].lastActivity).to.exist
        expect(list[1].lastActivity).to.be.undefined
      })
    })
  })

  describe('saveContacts()', () => {
    it('stores contacts in localStorage using JSON.stringify', () => {
      const contacts = [contactWithLastActivity, contactWithoutLastActivity]
      cy.window().invoke('saveContacts', contacts)
      cy.window().then((win) => {
        const raw = win.localStorage.getItem(CONTACTS_KEY)
        expect(raw).to.not.be.null
        const parsed = JSON.parse(raw!)
        expect(parsed).to.have.length(2)
        expect(parsed[0].name).to.eq('Contact With Activity')
        expect(parsed[1].name).to.eq('Contact No Activity')
        expect(parsed[0].createdAt).to.eq('2024-01-15T10:00:00.000Z')
      })
    })

    it('saved contacts are correctly retrieved via getContacts with date conversion', () => {
      cy.window().invoke('saveContacts', [contactWithLastActivity])
      cy.window().invoke('getContacts').then((list: unknown) => {
        const arr = list as Array<{ name: string; createdAt: unknown }>
        expect(arr).to.have.length(1)
        expect(arr[0].name).to.eq('Contact With Activity')
        assertValidDate(arr[0].createdAt)
      })
    })
  })

  describe('addContact()', () => {
    it('creates new list and persists when no contacts exist', () => {
      cy.window().invoke('getContacts').should('deep.equal', [])
      cy.window().invoke('addContact', contactWithLastActivity)
      cy.window().invoke('getContacts').then((list: unknown) => {
        const arr = list as Array<{ id: string; name: string }>
        expect(arr).to.have.length(1)
        expect(arr[0].id).to.eq('c-with-activity')
        expect(arr[0].name).to.eq('Contact With Activity')
      })
      cy.window().then((win) => {
        const raw = win.localStorage.getItem(CONTACTS_KEY)
        expect(JSON.parse(raw!).length).to.eq(1)
      })
    })

    it('adds contact to existing list and persists to storage', () => {
      cy.window().invoke('saveContacts', [contactWithLastActivity])
      cy.window().invoke('addContact', contactWithoutLastActivity)
      cy.window().invoke('getContacts').then((list: unknown) => {
        const arr = list as Array<{ id: string }>
        expect(arr).to.have.length(2)
        expect(arr.map((c) => c.id)).to.include('c-with-activity')
        expect(arr.map((c) => c.id)).to.include('c-no-activity')
      })
      cy.window().then((win) => {
        expect(JSON.parse(win.localStorage.getItem(CONTACTS_KEY)!).length).to.eq(2)
      })
    })
  })

  describe('updateContact()', () => {
    it('when contact id exists: merges updates with existing data and saves to storage (covers index !== -1)', () => {
      cy.window().invoke('saveContacts', [contactWithLastActivity, contactWithoutLastActivity])
      cy.window().invoke('updateContact', 'c-with-activity', {
        name: 'Updated Name',
        notes: 'Updated notes',
      })
      cy.window().invoke('getContacts').then((list: unknown) => {
        const arr = list as Array<{ id: string; name: string; notes: string }>
        const updated = arr.find((c) => c.id === 'c-with-activity')
        expect(updated).to.exist
        expect(updated!.name).to.eq('Updated Name')
        expect(updated!.notes).to.eq('Updated notes')
      })
      cy.window().then((win) => {
        const parsed = JSON.parse(win.localStorage.getItem(CONTACTS_KEY)!)
        const updated = parsed.find((c: { id: string }) => c.id === 'c-with-activity')
        expect(updated.name).to.eq('Updated Name')
      })
    })

    it('when contact id does not exist: no changes occur (covers index === -1)', () => {
      cy.window().invoke('saveContacts', [contactWithLastActivity])
      cy.window().invoke('updateContact', 'nonexistent-id', { name: 'No Effect' })
      cy.window().invoke('getContacts').then((list: unknown) => {
        const arr = list as Array<{ id: string; name: string }>
        expect(arr).to.have.length(1)
        expect(arr[0].id).to.eq('c-with-activity')
        expect(arr[0].name).to.eq('Contact With Activity')
      })
      cy.window().then((win) => {
        const parsed = JSON.parse(win.localStorage.getItem(CONTACTS_KEY)!)
        expect(parsed).to.have.length(1)
        expect(parsed[0].name).to.eq('Contact With Activity')
      })
    })
  })

  describe('getTransactions()', () => {
    it('returns empty array when storage has no transactions (covers if (!data))', () => {
      cy.window().invoke('getTransactions').should('deep.equal', [])
    })

    it('returns empty array when transactions key is missing', () => {
      cy.window().then((win) => win.localStorage.removeItem(TRANSACTIONS_KEY))
      cy.window().invoke('getTransactions').should('deep.equal', [])
    })

    it('parses stored transactions and converts date and createdAt to Date', () => {
      cy.window().then((win) => {
        win.localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([sampleTransaction]))
      })
      cy.window()
        .invoke('getTransactions')
        .then((transactions: unknown) => {
          const list = transactions as Array<{ id: string; date: unknown; createdAt: unknown }>
          expect(list).to.have.length(1)
          expect(list[0].id).to.eq('tx-1')
          assertValidDate(list[0].date)
          assertValidDate(list[0].createdAt)
        })
    })
  })
})
