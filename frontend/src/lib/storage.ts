import type { Wholesaler, Contact, Transaction, Order } from '@/types';

const STORAGE_KEYS = {
  WHOLESALER: 'ledger_wholesaler',
  CONTACTS: 'ledger_contacts',
  TRANSACTIONS: 'ledger_transactions',
  ORDERS: 'ledger_orders',
} as const;

// Wholesaler
export function getWholesaler(): Wholesaler | null {
  const data = localStorage.getItem(STORAGE_KEYS.WHOLESALER);
  if (!data) return null;
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
  };
}

export function saveWholesaler(wholesaler: Wholesaler): void {
  localStorage.setItem(STORAGE_KEYS.WHOLESALER, JSON.stringify(wholesaler));
}

// Contacts (Customers & Suppliers)
export function getContacts(): Contact[] {
  const data = localStorage.getItem(STORAGE_KEYS.CONTACTS);
  if (!data) return [];
  return JSON.parse(data).map((c: Contact) => ({
    ...c,
    lastActivity: c.lastActivity ? new Date(c.lastActivity) : undefined,
    createdAt: new Date(c.createdAt),
  }));
}

export function saveContacts(contacts: Contact[]): void {
  localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
}

export function addContact(contact: Contact): void {
  const contacts = getContacts();
  contacts.push(contact);
  saveContacts(contacts);
}

export function updateContact(id: string, updates: Partial<Contact>): void {
  const contacts = getContacts();
  const index = contacts.findIndex(c => c.id === id);
  if (index !== -1) {
    contacts[index] = { ...contacts[index], ...updates };
    saveContacts(contacts);
  }
}

// Transactions
export function getTransactions(): Transaction[] {
  const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  if (!data) return [];
  return JSON.parse(data).map((t: Transaction) => ({
    ...t,
    date: new Date(t.date),
    createdAt: new Date(t.createdAt),
  }));
}

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

export function addTransaction(transaction: Transaction): void {
  const transactions = getTransactions();
  transactions.push(transaction);
  saveTransactions(transactions);
}

export function getTransactionsByContact(contactId: string): Transaction[] {
  return getTransactions().filter(t => t.contactId === contactId);
}

// Orders
export function getOrders(): Order[] {
  const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (!data) return [];
  return JSON.parse(data).map((o: Order) => ({
    ...o,
    date: new Date(o.date),
    createdAt: new Date(o.createdAt),
  }));
}

export function saveOrders(orders: Order[]): void {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}

export function addOrder(order: Order): void {
  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
}

export function getOrdersByContact(contactId: string): Order[] {
  return getOrders().filter(o => o.contactId === contactId);
}

// Clear all data (for testing/reset)
export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}
