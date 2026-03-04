/**
 * Map API snake_case payloads to frontend camelCase types and vice versa.
 */

import { getBaseUrl } from '@/api/client'
import type { Contact, Order, Transaction, TransactionType } from '@/types'

type ContactApi = {
  id: string
  wholesaler_id: string
  type: string
  name: string
  mobile: string | null
  city: string | null
  address: string | null
  gst_number: string | null
  business_type: string | null
  notes: string | null
  balance: number
  last_activity: string | null
  created_at: string
  updated_at: string
}

type TransactionAttachmentApi = {
  id?: string
  file_path?: string | null
  url?: string
}

type TransactionApi = {
  id: string
  contact_id: string
  wholesaler_id: string
  type: string
  date: string
  order_id: string | null
  amount: number
  notes: string | null
  payment_mode: string | null
  created_at: string
  updated_at: string
  attachments?: TransactionAttachmentApi[]
}

type OrderApi = {
  id: string
  contact_id: string
  wholesaler_id: string
  order_number: string
  date: string
  total_value: number
  paid_amount: number
  returned_value: number
  discount: number
  status: string
  created_at: string
  updated_at: string
}

export function contactFromApi(raw: ContactApi): Contact {
  return {
    id: raw.id,
    wholesalerId: raw.wholesaler_id,
    type: raw.type as 'customer' | 'supplier',
    name: raw.name,
    mobile: raw.mobile ?? '',
    city: raw.city ?? '',
    address: raw.address ?? '',
    gstNumber: raw.gst_number ?? '',
    businessType: raw.business_type ?? '',
    notes: raw.notes ?? '',
    balance: Number(raw.balance),
    lastActivity: raw.last_activity,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

export function contactToApiBody(body: {
  type: string
  name: string
  mobile?: string
  city?: string
  address?: string
  gstNumber?: string
  businessType?: string
  notes?: string
}): Record<string, unknown> {
  return {
    type: body.type,
    name: body.name,
    mobile: body.mobile ?? null,
    city: body.city ?? null,
    address: body.address ?? null,
    gst_number: body.gstNumber ?? null,
    business_type: body.businessType ?? null,
    notes: body.notes ?? null,
  }
}

function attachmentToUrl(a: TransactionAttachmentApi): string {
  if (a.url) return a.url.startsWith('http') ? a.url : `${getBaseUrl()}${a.url.startsWith('/') ? '' : '/'}${a.url}`
  const path = a.file_path ?? ''
  if (!path) return ''
  return `${getBaseUrl()}/api/v1/uploads/${path}`
}

export function transactionFromApi(raw: TransactionApi): Transaction {
  const attachments: string[] | undefined =
    raw.attachments && raw.attachments.length > 0
      ? raw.attachments.map(attachmentToUrl).filter(Boolean)
      : undefined
  return {
    id: raw.id,
    contactId: raw.contact_id,
    wholesalerId: raw.wholesaler_id,
    type: raw.type as TransactionType,
    date: typeof raw.date === 'string' ? raw.date : String(raw.date),
    orderId: raw.order_id ?? null,
    amount: Number(raw.amount) || 0,
    notes: raw.notes ?? '',
    paymentMode: raw.payment_mode ?? '',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    attachments,
  }
}

export function orderFromApi(raw: OrderApi): Order {
  return {
    id: raw.id,
    contactId: raw.contact_id,
    wholesalerId: raw.wholesaler_id,
    orderNumber: raw.order_number,
    date: raw.date,
    totalValue: Number(raw.total_value) || 0,
    paidAmount: Number(raw.paid_amount) || 0,
    returnedValue: Number(raw.returned_value) || 0,
    discount: Number(raw.discount) || 0,
    status: raw.status as 'open' | 'closed',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

export function orderToApiBody(body: {
  contactId: string
  orderNumber: string
  date: string
  totalValue: number
  paidAmount?: number
  returnedValue?: number
  discount?: number
  status: string
}): Record<string, unknown> {
  return {
    contact_id: body.contactId,
    order_number: body.orderNumber,
    date: body.date,
    total_value: body.totalValue,
    paid_amount: body.paidAmount ?? 0,
    returned_value: body.returnedValue ?? 0,
    discount: body.discount ?? 0,
    status: body.status,
  }
}
