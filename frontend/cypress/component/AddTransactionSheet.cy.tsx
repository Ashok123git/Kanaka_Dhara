import AddTransactionSheet from '@/components/AddTransactionSheet';
import { AuthContext } from '@/auth/AuthContext';
import { toast } from 'sonner';
import { storageApi } from '@/lib/storage';
import { imageUtilsApi } from '@/lib/imageUtils';
import { ordersApi } from '@/api/orders';
import { transactionsApi } from '@/api/transactions';
import type { Order, Contact, TransactionType } from '@/types';

type SheetTransactionType = Extract<
  TransactionType,
  'order_received' | 'goods_sent' | 'payment_received' | 'goods_returned' | 'order_closed'
>;

function mountSheet(opts: {
  token: string | null;
  transactionType: SheetTransactionType;
  orders?: Order[];
  contactType?: 'customer' | 'supplier';
  contactId?: string;
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const {
    token,
    transactionType,
    orders = [],
    contactType = 'customer',
    contactId = 'c-1',
    onClose = cy.stub().as('onClose'),
    onSuccess = cy.stub().as('onSuccess'),
  } = opts;

  cy.mount(
    <AuthContext.Provider
      value={{
        token,
        refreshToken: null,
        user: null,
        hasWholesaler: true,
        isAuthenticated: !!token,
        setAuth: () => {},
        setTokensFromRefresh: () => {},
        clearToken: () => {},
      }}
    >
      <AddTransactionSheet
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
        transactionType={transactionType}
        contactId={contactId}
        orders={orders}
        contactType={contactType}
      />
    </AuthContext.Provider>,
  );
}

function makeOpenOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o-1',
    contactId: 'c-1',
    wholesalerId: 'w-1',
    orderNumber: '1001',
    date: '2026-03-17',
    totalValue: 1000,
    paidAmount: 0,
    returnedValue: 0,
    discount: 0,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c-1',
    wholesalerId: 'w-1',
    type: 'customer',
    name: 'Test Customer',
    mobile: '9999999999',
    city: 'City',
    address: 'Addr',
    gstNumber: '',
    businessType: '',
    notes: '',
    balance: 100,
    lastActivity: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AddTransactionSheet (component)', () => {
  beforeEach(() => {
    cy.stub(toast, 'error').as('toastError');
    cy.stub(toast, 'success').as('toastSuccess');
  });

  describe('File Handling & Edge Cases', () => {
    it('handleFileSelect: empty file list still resets input value in finally', () => {
      mountSheet({ token: null, transactionType: 'order_received' });
      cy.get('[data-testid=attachment-add-button]').should('not.be.disabled');
      cy.get('[data-testid=attachment-input]').then(($el) => {
        const el = $el[0] as HTMLInputElement;
        const setSpy = cy.spy().as('fileInputValueSet');
        Object.defineProperty(el, 'value', {
          configurable: true,
          get: () => 'not-empty',
          set: (v: string) => setSpy(v),
        });
      });
      cy.get('[data-testid=attachment-input]').trigger('change', { target: { files: [] } });
      cy.get('[data-testid=attachment-add-button]').should('not.be.disabled');
      cy.get('@fileInputValueSet').should('have.been.calledWith', '');
    });

    it('uploads image (mock isImageFile/compressImage), allows removeAttachment, and resets file input in finally', () => {
      mountSheet({ token: null, transactionType: 'order_received' });

      cy.stub(imageUtilsApi, 'isImageFile').returns(true);
      cy.stub(imageUtilsApi, 'compressImage').resolves('data:image/jpeg;base64,AAA=');

      cy.get('[data-testid=attachment-input]').selectFile(
        {
          contents: Cypress.Buffer.from('fake-image-bytes'),
          fileName: 'photo.jpg',
          mimeType: 'image/jpeg',
        },
        { force: true },
      );

      cy.get('img[alt="Attachment 1"]').should('be.visible');
      cy.get('[data-testid=remove-attachment-0]').click();
      cy.get('img[alt="Attachment 1"]').should('not.exist');

      cy.get('[data-testid=attachment-input]').invoke('val').should('eq', '');
    });

    it('finally resets file input value even when compressImage throws', () => {
      mountSheet({ token: null, transactionType: 'order_received' });

      cy.stub(imageUtilsApi, 'isImageFile').returns(true);
      cy.stub(imageUtilsApi, 'compressImage').rejects(new Error('boom'));

      cy.get('[data-testid=attachment-input]').selectFile(
        { contents: Cypress.Buffer.from('x'), fileName: 'p.jpg', mimeType: 'image/jpeg' },
        { force: true },
      );

      cy.get('[data-testid=attachment-input]').invoke('val').should('eq', '');
      cy.get('img[alt="Attachment 1"]').should('not.exist');
    });

    it('isCompressing disables Add Photo button until compression finishes', () => {
      mountSheet({ token: null, transactionType: 'order_received' });

      cy.stub(imageUtilsApi, 'isImageFile').returns(true);
      let resolveCompress: (v: string) => void;
      const compressPromise = new Promise<string>((resolve) => {
        resolveCompress = resolve;
      });
      cy.stub(imageUtilsApi, 'compressImage').returns(compressPromise as unknown as Promise<string>);

      cy.get('[data-testid=attachment-input]').selectFile(
        { contents: Cypress.Buffer.from('x'), fileName: 'p.jpg', mimeType: 'image/jpeg' },
        { force: true },
      );

      cy.get('[data-testid=attachment-add-button]')
        .should('be.disabled')
        .and('contain.text', 'Processing...');

      cy.then(() => resolveCompress!('data:image/jpeg;base64,BBB='));
      cy.get('[data-testid=attachment-add-button]').should('not.be.disabled');
      cy.get('img[alt="Attachment 1"]').should('be.visible');
    });
  });

  describe('Validation Logic', () => {
    it('shows toast for invalid/zero amount and does not submit', () => {
      mountSheet({ token: null, transactionType: 'order_received' });

      cy.get('input#orderNumber').type('ORD-X');
      cy.get('input#amount').clear().type('0');
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@toastError').should('have.been.calledWith', 'Enter a valid amount');
    });

    it("order_received requires orderNumber (toast)", () => {
      mountSheet({ token: 't', transactionType: 'order_received' });
      cy.get('input#amount').clear().type('100');
      cy.get('[data-testid=submit-transaction]').click();
      cy.get('@toastError').should('have.been.calledWith', 'Order number is required');
    });

    it('non-order types require selecting an order when openOrders exist', () => {
      mountSheet({ token: 't', transactionType: 'payment_received', orders: [makeOpenOrder()] });

      cy.get('input#amount').clear().type('10');
      cy.get('[data-testid=submit-transaction]').click();
      cy.get('@toastError').should('have.been.calledWith', 'Select an order');
    });
  });

  describe('API & Error States', () => {
    it('order_received with missing token shows Not signed in toast', () => {
      mountSheet({ token: null, transactionType: 'order_received' });
      cy.get('input#orderNumber').type('ORD-1');
      cy.get('input#amount').clear().type('100');
      cy.get('[data-testid=submit-transaction]').click();
      cy.get('@toastError').should('have.been.calledWith', 'Not signed in');
    });

    it('createOrder throws JSON string and catch parses detail for toast', () => {
      cy.stub(ordersApi, 'createOrder').rejects(new Error(JSON.stringify({ detail: 'Order create failed' })));

      cy.stub(storageApi, 'getOrders').returns([]);
      cy.stub(storageApi, 'saveOrders').as('saveOrders');

      mountSheet({ token: 't', transactionType: 'order_received' });
      cy.get('input#orderNumber').type('ORD-1');
      cy.get('input#amount').clear().type('100');
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@toastError').should('have.been.calledWith', 'Order create failed');
      cy.get('@saveOrders').should('not.have.been.called');
    });

    it('createOrder throws non-JSON string and catch falls back to string message', () => {
      cy.stub(ordersApi, 'createOrder').rejects(new Error('plain create order error'));

      mountSheet({ token: 't', transactionType: 'order_received' });
      cy.get('input#orderNumber').type('ORD-1');
      cy.get('input#amount').clear().type('100');
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@toastError').should('have.been.calledWith', 'plain create order error');
    });

    it('createTransaction throws JSON string and catch parses detail for toast', () => {
      cy.stub(transactionsApi, 'createTransaction').rejects(
        new Error(JSON.stringify({ detail: 'Transaction create failed' })),
      );

      mountSheet({ token: 't', transactionType: 'payment_received', orders: [makeOpenOrder()] });
      cy.get('input#amount').clear().type('50');
      cy.get('[data-testid=order-select-trigger]').click();
      cy.contains('[role=option]', '#1001').click();
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@toastError').should('have.been.calledWith', 'Transaction create failed');
    });

    it('createTransaction throws non-JSON string and catch falls back to string message', () => {
      cy.stub(transactionsApi, 'createTransaction').rejects(new Error('plain create tx error'));

      mountSheet({ token: 't', transactionType: 'payment_received', orders: [makeOpenOrder()] });
      cy.get('input#amount').clear().type('50');
      cy.get('[data-testid=order-select-trigger]').click();
      cy.contains('[role=option]', '#1001').click();
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@toastError').should('have.been.calledWith', 'plain create tx error');
    });

    it('attachment upload loop: multiple attachments and one upload fails → toast error', () => {
      cy.stub(transactionsApi, 'createTransaction').resolves({ id: 'tx-1' });

      cy.stub(transactionsApi, 'uploadTransactionAttachment')
        .onFirstCall()
        .resolves({ id: 'a-1', transactionId: 'tx-1', filePath: '/x', createdAt: new Date().toISOString() })
        .onSecondCall()
        .rejects(new Error('Upload failed'));

      cy.stub(imageUtilsApi, 'isImageFile').returns(true);
      cy.stub(imageUtilsApi, 'compressImage')
        .onFirstCall()
        .resolves('data:image/jpeg;base64,ONE=')
        .onSecondCall()
        .resolves('data:image/jpeg;base64,TWO=');

      mountSheet({ token: 't', transactionType: 'payment_received', orders: [makeOpenOrder()] });
      cy.get('input#amount').clear().type('50');
      cy.get('[data-testid=order-select-trigger]').click();
      cy.contains('[role=option]', '#1001').click();

      cy.get('[data-testid=attachment-input]').selectFile(
        [
          { contents: Cypress.Buffer.from('1'), fileName: 'a.jpg', mimeType: 'image/jpeg' },
          { contents: Cypress.Buffer.from('2'), fileName: 'b.jpg', mimeType: 'image/jpeg' },
        ],
        { force: true },
      );

      cy.get('[data-testid=submit-transaction]').click();
      cy.get('@toastError').should('have.been.calledWith', 'Upload failed');
    });
  });

  describe('Business Logic Branching', () => {
    it('updates order.paidAmount for payment_received (and calls updateOrder + saveOrders)', () => {
      const order = makeOpenOrder({ id: 'o-1', paidAmount: 10 });
      cy.stub(storageApi, 'getOrders').returns([order]);
      cy.stub(storageApi, 'saveOrders').as('saveOrders');

      cy.stub(transactionsApi, 'createTransaction').resolves({ id: 'tx-1' });
      cy.stub(ordersApi, 'updateOrder').resolves(order);

      mountSheet({ token: 't', transactionType: 'payment_received', orders: [order] });
      cy.get('input#amount').clear().type('50');
      cy.get('[data-testid=order-select-trigger]').click();
      cy.contains('[role=option]', '#1001').click();
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@saveOrders').should('have.been.called');
      cy.get('@saveOrders').then((stub) => {
        const call = (stub as any).getCall(0);
        const saved = call.args[0] as Order[];
        expect(saved).to.have.length(1);
        expect(saved[0].id).to.eq('o-1');
        expect(saved[0].paidAmount).to.eq(60);
      });
    });

    it('updates order.returnedValue for goods_returned', () => {
      const order = makeOpenOrder({ id: 'o-1', returnedValue: 5 });
      cy.stub(storageApi, 'getOrders').returns([order]);
      cy.stub(storageApi, 'saveOrders').as('saveOrders');

      cy.stub(transactionsApi, 'createTransaction').resolves({ id: 'tx-2' });
      cy.stub(ordersApi, 'updateOrder').resolves(order);

      mountSheet({ token: 't', transactionType: 'goods_returned', orders: [order] });
      cy.get('input#amount').clear().type('20');
      cy.get('[data-testid=order-select-trigger]').click();
      cy.contains('[role=option]', '#1001').click();
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@saveOrders').should('have.been.called');
      cy.get('@saveOrders').then((stub) => {
        const call = (stub as any).getCall(0);
        const saved = call.args[0] as Order[];
        expect(saved).to.have.length(1);
        expect(saved[0].id).to.eq('o-1');
        expect(saved[0].returnedValue).to.eq(25);
      });
    });

    it('sets order.discount and closes order for order_closed', () => {
      const order = makeOpenOrder({ id: 'o-1', discount: 0, status: 'open' });
      cy.stub(storageApi, 'getOrders').returns([order]);
      cy.stub(storageApi, 'saveOrders').as('saveOrders');

      cy.stub(transactionsApi, 'createTransaction').resolves({ id: 'tx-3' });
      cy.stub(ordersApi, 'updateOrder').resolves(order);

      mountSheet({ token: 't', transactionType: 'order_closed', orders: [order] });
      cy.get('input#amount').clear().type('30');
      cy.get('[data-testid=order-select-trigger]').click();
      cy.contains('[role=option]', '#1001').click();
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@saveOrders').should('have.been.called');
      cy.get('@saveOrders').then((stub) => {
        const call = (stub as any).getCall(0);
        const saved = call.args[0] as Order[];
        expect(saved).to.have.length(1);
        expect(saved[0].id).to.eq('o-1');
        expect(saved[0].discount).to.eq(30);
        expect(saved[0].status).to.eq('closed');
      });
    });

    it('local storage fallback: token null updates contact balance via getContacts + updateContact', () => {
      const contact = makeContact({ balance: 100 });
      cy.stub(storageApi, 'getContacts').returns([contact]);
      cy.stub(storageApi, 'updateContact').as('updateContact');
      cy.stub(storageApi, 'addTransaction').as('addTransaction');
      cy.stub(transactionsApi, 'createTransaction').as('createTransaction');

      // Use a non-order transaction type so we don't short-circuit on missing token.
      mountSheet({ token: null, transactionType: 'payment_received', contactId: 'c-1' });
      cy.get('input#amount').clear().type('40');
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('@createTransaction').should('not.have.been.called');
      cy.wrap(storageApi.getContacts).should('have.been.called');
      cy.get('@updateContact').should('have.been.calledWith', 'c-1', Cypress.sinon.match({ balance: 60 }));
      cy.get('@addTransaction').should('have.been.called');
      cy.get('@onSuccess').should('have.been.called');
    });
  });

  describe('UI States', () => {
    it('isSubmitting disables Save button and shows Saving... while request is in-flight', () => {
      let resolveTx: (v: Record<string, unknown>) => void;
      const txPromise = new Promise<Record<string, unknown>>((resolve) => {
        resolveTx = resolve;
      });
      cy.stub(transactionsApi, 'createTransaction').returns(txPromise as unknown as Promise<Record<string, unknown>>);

      mountSheet({ token: 't', transactionType: 'payment_received', orders: [makeOpenOrder()] });
      cy.get('input#amount').clear().type('10');
      cy.get('[data-testid=order-select-trigger]').click();
      cy.contains('[role=option]', '#1001').click();
      cy.get('[data-testid=submit-transaction]').click();

      cy.get('[data-testid=submit-transaction]').should('be.disabled').and('contain.text', 'Saving...');
      cy.then(() => resolveTx!({ id: 'tx-1' }));
      cy.get('[data-testid=submit-transaction]').should('not.be.disabled');
    });
  });
});

