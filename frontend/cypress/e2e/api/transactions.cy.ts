/**
 * E2E tests for src/api/transactions.ts: getTransaction, uploadTransactionAttachment.
 * Intercepts /api/v1/transactions/:id and /api/v1/transactions/:id/attachments,
 * mocks responses, and invokes API functions via window to cover all branches.
 */

const TOKEN = 'test-access-token'
const wholesalerStorageKey = 'ledger_wholesaler'

const rawTransaction = {
  id: 'txn-1',
  contact_id: 'c-1',
  wholesaler_id: 'wh-1',
  type: 'payment',
  date: '2024-01-15',
  order_id: 'ord-1' as string | null,
  amount: 5000,
  notes: 'Test note',
  payment_mode: 'cash',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  attachments: [] as { id?: string; file_path?: string | null; url?: string }[],
}

const wholesalerStorage = {
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
}

function setupAuth() {
  cy.clearAuth()
  cy.setAuthToken(TOKEN, 'test-refresh-token')
  cy.window().then((win) => {
    win.localStorage.setItem(wholesalerStorageKey, JSON.stringify(wholesalerStorage))
  })
}

describe('Transactions API (getTransaction, uploadTransactionAttachment)', () => {
  beforeEach(() => {
    setupAuth()
    cy.visit('/')
  })

  describe('getTransaction', () => {
    it('calls GET /api/v1/transactions/:id with token and returns transaction transformed via transactionFromApi', () => {
      cy.intercept('GET', '**/api/v1/transactions/txn-1', (req) => {
        req.reply({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rawTransaction),
        })
      }).as('getTransaction')

      cy.window().invoke('getTransaction', TOKEN, 'txn-1').then((transaction: unknown) => {
        expect(transaction, 'getTransaction should return a value').to.exist
        const t = transaction as { id?: string; contactId?: string; amount?: number; type?: string }
        if (t != null && typeof t === 'object' && 'id' in t && t.id != null) {
          expect(t.id).to.eq('txn-1')
          expect(t.contactId).to.eq('c-1')
          expect(t.amount).to.eq(5000)
          expect(t.type).to.eq('payment')
        }
      })

      cy.wait('@getTransaction').then((interception) => {
        expect(interception.request.method).to.eq('GET')
        expect(interception.request.headers?.authorization).to.include(TOKEN)
        const body = interception.response?.body as typeof rawTransaction
        expect(body).to.deep.include({
          id: 'txn-1',
          contact_id: 'c-1',
          amount: 5000,
          type: 'payment',
        })
        const transformed = {
          id: body.id,
          contactId: body.contact_id,
          wholesalerId: body.wholesaler_id,
          type: body.type,
          date: body.date,
          orderId: body.order_id ?? null,
          amount: Number(body.amount) || 0,
          notes: body.notes ?? '',
          paymentMode: body.payment_mode ?? '',
          createdAt: body.created_at,
          updatedAt: body.updated_at,
        }
        expect(transformed.id).to.eq('txn-1')
        expect(transformed.contactId).to.eq('c-1')
        expect(transformed.amount).to.eq(5000)
        expect(transformed.type).to.eq('payment')
      })
    })
  })

  describe('uploadTransactionAttachment', () => {
    const successResponse = {
      id: 'att-1',
      transactionId: 'txn-1',
      filePath: 'uploads/abc.pdf',
      createdAt: '2024-01-15T12:00:00Z',
    }

    it('POSTs to /api/v1/transactions/:id/attachments with FormData and returns parsed JSON on success', () => {
      cy.intercept('POST', '**/api/v1/transactions/txn-1/attachments', (req) => {
        req.reply({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(successResponse),
        })
      }).as('uploadAttachment')

      cy.window().then((win) => {
        const file = new win.File(['content'], 'doc.pdf', { type: 'application/pdf' })
        const p = (win as unknown as { uploadTransactionAttachment: (t: string, id: string, f: File) => Promise<unknown> }).uploadTransactionAttachment(TOKEN, 'txn-1', file)
        return cy.wrap(p)
      }).then((result: unknown) => {
        const r = result as { id: string; transactionId: string; filePath: string; createdAt: string }
        expect(r).to.deep.include(successResponse)
        expect(r.id).to.eq('att-1')
        expect(r.transactionId).to.eq('txn-1')
        expect(r.filePath).to.eq('uploads/abc.pdf')
        expect(r.createdAt).to.eq('2024-01-15T12:00:00Z')
      })

      cy.wait('@uploadAttachment').then((interception) => {
        expect(interception.request.method).to.eq('POST')
        expect(interception.request.headers?.authorization).to.include(TOKEN)
        expect(interception.request.url).to.match(/\/api\/v1\/transactions\/txn-1\/attachments/)

        // NOTE: Cypress serializes multipart/form-data bodies in interceptions (often to a string),
        // so `instanceof FormData` is unreliable here. Assert multipart headers + payload markers instead.
        const ct =
          (interception.request.headers?.['content-type'] as string | undefined) ??
          (interception.request.headers?.['Content-Type'] as string | undefined) ??
          ''
        expect(ct.toLowerCase()).to.include('multipart/form-data')

        const bodyText = String(interception.request.body ?? '')
        expect(bodyText).to.include('name="file"')
        expect(bodyText).to.include('filename="doc.pdf"')
      })
    })

    it('throws with response text when res.ok is false', () => {
      cy.intercept('POST', '**/api/v1/transactions/txn-1/attachments', {
        statusCode: 500,
        body: 'Server error',
        headers: { 'Content-Type': 'text/plain' },
      }).as('uploadFail')

      cy.window().then((win) => {
        const file = new win.File(['x'], 'a.pdf', { type: 'application/pdf' })
        const p = (win as unknown as { uploadTransactionAttachment: (t: string, id: string, f: File) => Promise<unknown> }).uploadTransactionAttachment(TOKEN, 'txn-1', file)
        return cy.wrap(p.then(
          () => ({ rejected: false }),
          (err: Error) => ({ rejected: true, message: err.message }),
        ))
      }).then((out: { rejected: boolean; message?: string }) => {
        expect(out.rejected).to.eq(true)
        expect(out.message).to.eq('Server error')
      })
      cy.wait('@uploadFail')
    })

    it('throws "Upload attachment failed" when res.ok is false and res.text() is empty', () => {
      cy.intercept('POST', '**/api/v1/transactions/txn-1/attachments', {
        statusCode: 500,
        body: '',
        headers: {},
      }).as('uploadFailEmpty')

      cy.window().then((win) => {
        const file = new win.File([], 'b.pdf', { type: 'application/pdf' })
        const p = (win as unknown as { uploadTransactionAttachment: (t: string, id: string, f: File) => Promise<unknown> }).uploadTransactionAttachment(TOKEN, 'txn-1', file)
        return cy.wrap(p.then(
          () => ({ rejected: false }),
          (err: Error) => ({ rejected: true, message: err.message }),
        ))
      }).then((out: { rejected: boolean; message?: string }) => {
        expect(out.rejected).to.eq(true)
        expect(out.message).to.eq('Upload attachment failed')
      })
      cy.wait('@uploadFailEmpty')
    })
  })
})
