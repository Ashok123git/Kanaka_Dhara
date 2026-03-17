/**
 * Orders API: CRUD /orders (scoped by wholesaler_id).
 */

import { apiJson } from './client'
import { orderFromApi, orderToApiBody } from '@/lib/apiMappers'
import type { Order } from '@/types'

type OrderApiRaw = Parameters<typeof orderFromApi>[0]

export async function getOrders(token: string, contactId?: string): Promise<Order[]> {
  const qs = contactId ? `?contact_id=${encodeURIComponent(contactId)}` : ''
  const data = await apiJson<{ data?: OrderApiRaw[] } | OrderApiRaw[]>(`/api/v1/orders${qs}`, { token })
  const list = Array.isArray(data) ? data : (data as { data?: OrderApiRaw[] }).data ?? []
  return list.map((raw) => orderFromApi(raw))
}

export async function getOrder(token: string, id: string): Promise<Order> {
  const raw = await apiJson<OrderApiRaw>(`/api/v1/orders/${id}`, { token })
  return orderFromApi(raw)
}

export type CreateOrderBody = {
  contactId: string
  orderNumber: string
  date: string
  totalValue: number
  paidAmount?: number
  returnedValue?: number
  discount?: number
  status: 'open' | 'closed'
}

export async function createOrder(token: string, body: CreateOrderBody): Promise<Order> {
  const raw = await apiJson<OrderApiRaw>('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify(orderToApiBody(body)),
    token,
  })
  return orderFromApi(raw)
}

export type UpdateOrderBody = Partial<{
  contactId: string
  orderNumber: string
  date: string
  totalValue: number
  paidAmount: number
  returnedValue: number
  discount: number
  status: 'open' | 'closed'
}>

export async function updateOrder(token: string, id: string, body: UpdateOrderBody): Promise<Order> {
  const payload: Record<string, unknown> = {}
  if (body.contactId != null) payload.contact_id = body.contactId
  if (body.orderNumber != null) payload.order_number = body.orderNumber
  if (body.date != null) payload.date = body.date
  if (body.totalValue != null) payload.total_value = body.totalValue
  if (body.paidAmount != null) payload.paid_amount = body.paidAmount
  if (body.returnedValue != null) payload.returned_value = body.returnedValue
  if (body.discount != null) payload.discount = body.discount
  if (body.status != null) payload.status = body.status
  const raw = await apiJson<OrderApiRaw>(`/api/v1/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    token,
  })
  return orderFromApi(raw)
}

/**
 * Mutable facade for Cypress stubbing (ESM exports are not reliably stub-able).
 * Example: cy.stub(ordersApi, 'createOrder').rejects(new Error('...'))
 */
export const ordersApi = {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
};
