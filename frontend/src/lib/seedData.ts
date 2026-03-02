import type { Wholesaler, Contact, Transaction, Order } from '@/types';
import { 
  getWholesaler, 
  saveWholesaler, 
  saveContacts, 
  saveTransactions, 
  saveOrders 
} from './storage';
import { generateId } from './formatters';

// Helper to create dates relative to today
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Wholesaler - Gayathri Handlooms
const gayathriHandlooms: Wholesaler = {
  id: generateId(),
  shopName: 'Gayathri Handlooms',
  ownerName: 'Venkateshwara Rao',
  mobile: '9848012345',
  address: '23, T. Nagar Main Road, Chennai - 600017',
  gstNumber: '33AABCU9603R1ZM',
  tradeCreditDays: 30,
  createdAt: daysAgo(365),
};

// Customer IDs for transaction linking
const customerIds = {
  lakshmiSilks: 'cust_lakshmi_001',
  annapurnaTextiles: 'cust_annapurna_002',
  padmavathiCollections: 'cust_padmavathi_003',
  saraswathiStores: 'cust_saraswathi_004',
  meenakshiSilks: 'cust_meenakshi_005',
  kamalaTextiles: 'cust_kamala_006',
  sridevisFashions: 'cust_sridevi_007',
  bhavaniHandlooms: 'cust_bhavani_008',
};

const supplierIds = {
  kanchiWeavers: 'supp_kanchi_001',
  pochampallyHandlooms: 'supp_pochampally_002',
  mangalagiriWeavers: 'supp_mangalagiri_003',
  dharmavaraSilks: 'supp_dharmavaram_004',
  gadwalWeavers: 'supp_gadwal_005',
};

// Customers (8)
const customers: Contact[] = [
  {
    id: customerIds.lakshmiSilks,
    type: 'customer',
    name: 'Lakshmi Silks',
    mobile: '9944123456',
    city: 'Coimbatore',
    address: 'RS Puram, Coimbatore - 641002',
    businessType: 'Retail Saree Shop',
    balance: 125000,
    lastActivity: daysAgo(2),
    createdAt: daysAgo(180),
  },
  {
    id: customerIds.annapurnaTextiles,
    type: 'customer',
    name: 'Annapurna Textiles',
    mobile: '9865234567',
    city: 'Madurai',
    address: 'Town Hall Road, Madurai - 625001',
    gstNumber: '33BBBPT1234K1ZN',
    businessType: 'Wholesale Dealer',
    balance: 85500,
    lastActivity: daysAgo(5),
    createdAt: daysAgo(150),
  },
  {
    id: customerIds.padmavathiCollections,
    type: 'customer',
    name: 'Padmavathi Collections',
    mobile: '9701345678',
    city: 'Hyderabad',
    address: 'Banjara Hills, Hyderabad - 500034',
    businessType: 'Boutique',
    balance: 0,
    lastActivity: daysAgo(15),
    createdAt: daysAgo(200),
  },
  {
    id: customerIds.saraswathiStores,
    type: 'customer',
    name: 'Saraswathi Stores',
    mobile: '9848456789',
    city: 'Vijayawada',
    address: 'MG Road, Vijayawada - 520001',
    businessType: 'Retail Shop',
    balance: 42000,
    lastActivity: daysAgo(8),
    createdAt: daysAgo(120),
  },
  {
    id: customerIds.meenakshiSilks,
    type: 'customer',
    name: 'Meenakshi Silks',
    mobile: '9440567890',
    city: 'Tirupati',
    address: 'Car Street, Tirupati - 517501',
    gstNumber: '37CCCMS5678L1ZP',
    businessType: 'Saree Showroom',
    balance: 215000,
    lastActivity: daysAgo(1),
    createdAt: daysAgo(90),
  },
  {
    id: customerIds.kamalaTextiles,
    type: 'customer',
    name: 'Kamala Textiles',
    mobile: '9966678901',
    city: 'Guntur',
    address: 'Brodipet, Guntur - 522002',
    businessType: 'Wholesale',
    balance: -12000, // Overpaid
    lastActivity: daysAgo(20),
    createdAt: daysAgo(250),
  },
  {
    id: customerIds.sridevisFashions,
    type: 'customer',
    name: 'Sridevi Fashions',
    mobile: '9885789012',
    city: 'Nellore',
    address: 'Trunk Road, Nellore - 524001',
    businessType: 'Boutique',
    balance: 67800,
    lastActivity: daysAgo(3),
    createdAt: daysAgo(100),
  },
  {
    id: customerIds.bhavaniHandlooms,
    type: 'customer',
    name: 'Bhavani Handlooms',
    mobile: '9247890123',
    city: 'Warangal',
    address: 'Hanamkonda, Warangal - 506001',
    businessType: 'Handloom Dealer',
    balance: 105000,
    lastActivity: daysAgo(7),
    createdAt: daysAgo(140),
  },
];

// Suppliers (5)
const suppliers: Contact[] = [
  {
    id: supplierIds.kanchiWeavers,
    type: 'supplier',
    name: 'Kanchi Weavers Coop',
    mobile: '9944111222',
    city: 'Kanchipuram',
    address: 'Pillayar Koil Street, Kanchipuram - 631501',
    gstNumber: '33AAAKW1111M1ZA',
    businessType: 'Silk Weaving',
    balance: -250000, // We owe them
    lastActivity: daysAgo(3),
    createdAt: daysAgo(300),
  },
  {
    id: supplierIds.pochampallyHandlooms,
    type: 'supplier',
    name: 'Pochampally Handlooms',
    mobile: '9848222333',
    city: 'Pochampally',
    address: 'Weavers Colony, Pochampally - 508284',
    businessType: 'Ikat Fabrics',
    balance: -180000,
    lastActivity: daysAgo(10),
    createdAt: daysAgo(280),
  },
  {
    id: supplierIds.mangalagiriWeavers,
    type: 'supplier',
    name: 'Mangalagiri Weavers',
    mobile: '9966333444',
    city: 'Mangalagiri',
    address: 'Handloom Park, Mangalagiri - 522503',
    businessType: 'Cotton Textiles',
    balance: 0, // Settled
    lastActivity: daysAgo(30),
    createdAt: daysAgo(200),
  },
  {
    id: supplierIds.dharmavaraSilks,
    type: 'supplier',
    name: 'Dharmavaram Silks Pvt',
    mobile: '9440444555',
    city: 'Dharmavaram',
    address: 'Silk Market, Dharmavaram - 515671',
    gstNumber: '37DDDDS4444N1ZB',
    businessType: 'Pattu Sarees',
    balance: -95000,
    lastActivity: daysAgo(12),
    createdAt: daysAgo(220),
  },
  {
    id: supplierIds.gadwalWeavers,
    type: 'supplier',
    name: 'Gadwal Weavers Union',
    mobile: '9885555666',
    city: 'Gadwal',
    address: 'Weavers Street, Gadwal - 509125',
    businessType: 'Traditional Sarees',
    balance: -45000,
    lastActivity: daysAgo(18),
    createdAt: daysAgo(160),
  },
];

// Order IDs for transaction linking
const orderIds = {
  lakshmi_order1: 'ord_lakshmi_001',
  lakshmi_order2: 'ord_lakshmi_002',
  meenakshi_order1: 'ord_meenakshi_001',
  annapurna_order1: 'ord_annapurna_001',
};

// Sample Orders
const sampleOrders: Order[] = [
  {
    id: orderIds.lakshmi_order1,
    contactId: customerIds.lakshmiSilks,
    orderNumber: 'ORD-2026-001',
    date: daysAgo(45),
    totalValue: 175000,
    paidAmount: 50000,
    returnedValue: 0,
    discount: 0,
    status: 'open',
    createdAt: daysAgo(45),
  },
  {
    id: orderIds.lakshmi_order2,
    contactId: customerIds.lakshmiSilks,
    orderNumber: 'ORD-2026-015',
    date: daysAgo(10),
    totalValue: 85000,
    paidAmount: 85000,
    returnedValue: 0,
    discount: 0,
    status: 'closed',
    createdAt: daysAgo(10),
  },
  {
    id: orderIds.meenakshi_order1,
    contactId: customerIds.meenakshiSilks,
    orderNumber: 'ORD-2026-020',
    date: daysAgo(15),
    totalValue: 250000,
    paidAmount: 35000,
    returnedValue: 0,
    discount: 0,
    status: 'open',
    createdAt: daysAgo(15),
  },
  {
    id: orderIds.annapurna_order1,
    contactId: customerIds.annapurnaTextiles,
    orderNumber: 'ORD-2026-012',
    date: daysAgo(25),
    totalValue: 120000,
    paidAmount: 34500,
    returnedValue: 0,
    discount: 0,
    status: 'open',
    createdAt: daysAgo(25),
  },
];

// Sample Transactions
const sampleTransactions: Transaction[] = [
  // Lakshmi Silks transactions
  {
    id: generateId(),
    contactId: customerIds.lakshmiSilks,
    type: 'order_received',
    date: daysAgo(45),
    orderId: orderIds.lakshmi_order1,
    amount: 175000,
    notes: 'Kanchipuram Silk Sarees - 25 pieces',
    createdAt: daysAgo(45),
  },
  {
    id: generateId(),
    contactId: customerIds.lakshmiSilks,
    type: 'goods_sent',
    date: daysAgo(42),
    orderId: orderIds.lakshmi_order1,
    amount: 175000,
    notes: 'Dispatched via Delhivery',
    createdAt: daysAgo(42),
  },
  {
    id: generateId(),
    contactId: customerIds.lakshmiSilks,
    type: 'payment_received',
    date: daysAgo(35),
    orderId: orderIds.lakshmi_order1,
    amount: 50000,
    notes: 'Partial payment',
    paymentMode: 'upi',
    createdAt: daysAgo(35),
  },
  {
    id: generateId(),
    contactId: customerIds.lakshmiSilks,
    type: 'order_received',
    date: daysAgo(10),
    orderId: orderIds.lakshmi_order2,
    amount: 85000,
    notes: 'Pochampally Ikat Sarees - 15 pieces',
    createdAt: daysAgo(10),
  },
  {
    id: generateId(),
    contactId: customerIds.lakshmiSilks,
    type: 'goods_sent',
    date: daysAgo(8),
    orderId: orderIds.lakshmi_order2,
    amount: 85000,
    notes: 'Sent with own vehicle',
    createdAt: daysAgo(8),
  },
  {
    id: generateId(),
    contactId: customerIds.lakshmiSilks,
    type: 'payment_received',
    date: daysAgo(2),
    orderId: orderIds.lakshmi_order2,
    amount: 85000,
    notes: 'Full payment received',
    paymentMode: 'bank',
    createdAt: daysAgo(2),
  },
  {
    id: generateId(),
    contactId: customerIds.lakshmiSilks,
    type: 'order_closed',
    date: daysAgo(2),
    orderId: orderIds.lakshmi_order2,
    amount: 0,
    notes: 'Order completed',
    createdAt: daysAgo(2),
  },

  // Meenakshi Silks transactions
  {
    id: generateId(),
    contactId: customerIds.meenakshiSilks,
    type: 'order_received',
    date: daysAgo(15),
    orderId: orderIds.meenakshi_order1,
    amount: 250000,
    notes: 'Wedding collection - Pattu & Gadwal Sarees - 40 pieces',
    createdAt: daysAgo(15),
  },
  {
    id: generateId(),
    contactId: customerIds.meenakshiSilks,
    type: 'goods_sent',
    date: daysAgo(12),
    orderId: orderIds.meenakshi_order1,
    amount: 250000,
    notes: 'Dispatched in 2 parcels',
    createdAt: daysAgo(12),
  },
  {
    id: generateId(),
    contactId: customerIds.meenakshiSilks,
    type: 'payment_received',
    date: daysAgo(1),
    orderId: orderIds.meenakshi_order1,
    amount: 35000,
    notes: 'Advance payment',
    paymentMode: 'cash',
    createdAt: daysAgo(1),
  },

  // Annapurna Textiles transactions
  {
    id: generateId(),
    contactId: customerIds.annapurnaTextiles,
    type: 'order_received',
    date: daysAgo(25),
    orderId: orderIds.annapurna_order1,
    amount: 120000,
    notes: 'Cotton handloom sarees - 30 pieces',
    createdAt: daysAgo(25),
  },
  {
    id: generateId(),
    contactId: customerIds.annapurnaTextiles,
    type: 'goods_sent',
    date: daysAgo(22),
    orderId: orderIds.annapurna_order1,
    amount: 120000,
    notes: 'Shipped via DTDC',
    createdAt: daysAgo(22),
  },
  {
    id: generateId(),
    contactId: customerIds.annapurnaTextiles,
    type: 'payment_received',
    date: daysAgo(5),
    orderId: orderIds.annapurna_order1,
    amount: 34500,
    notes: 'Cheque received',
    paymentMode: 'cheque',
    createdAt: daysAgo(5),
  },
];

/**
 * Seeds the app with test data if no data exists
 */
export function seedTestData(): void {
  // Check if data already exists
  if (getWholesaler()) return;

  // Seed wholesaler
  saveWholesaler(gayathriHandlooms);

  // Seed all contacts
  saveContacts([...customers, ...suppliers]);

  // Seed transactions
  saveTransactions(sampleTransactions);

  // Seed orders
  saveOrders(sampleOrders);

  console.log('✅ Test data seeded successfully - Gayathri Handlooms');
}
