/**
 * Domain types — keep in sync with API DTOs (snake_case from API can be mapped to camelCase here).
 */

export type ContactType = 'customer' | 'supplier'

export interface Wholesaler {
  id: string
  shopName: string
  ownerName: string
  mobile: string
  address: string
  gstNumber: string
  panNumber: string
  tradeCreditDays: number
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  wholesalerId: string
  type: ContactType
  name: string
  mobile: string
  city: string
  address: string
  gstNumber: string
  businessType: string
  notes: string
  balance: number
  lastActivity: string | null
  createdAt: string
  updatedAt: string
}

export type OrderStatus = 'open' | 'closed'

export interface Order {
  id: string
  contactId: string
  wholesalerId: string
  orderNumber: string
  date: string
  totalValue: number
  paidAmount: number
  returnedValue: number
  discount: number
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export type TransactionType =
  | 'sale'
  | 'purchase'
  | 'payment'
  | 'receipt'
  | 'credit_note'
  | 'debit_note'
  | 'opening_balance'
  | 'adjustment'

export interface Transaction {
  id: string
  contactId: string
  wholesalerId: string
  type: TransactionType
  date: string
  orderId: string | null
  amount: number
  notes: string
  paymentMode: string
  createdAt: string
  updatedAt: string
  /** URLs for display (from API) or data URLs (from local). */
  attachments?: string[]
}

export interface TransactionAttachment {
  id: string
  transactionId: string
  filePath: string
  createdAt: string
}

export interface AuthUser {
  id: string
  phone: string
  wholesalerId: string | null
}

export interface VerifyOtpResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: AuthUser
  has_wholesaler: boolean
}

/** Response from POST /api/v1/auth/refresh (backend rotates refresh token). */
export interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}
