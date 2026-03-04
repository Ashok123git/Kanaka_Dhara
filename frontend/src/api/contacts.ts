/**
 * Contacts API: CRUD /contacts (scoped by wholesaler_id via JWT).
 */

import { apiJson } from './client'
import { contactFromApi, contactToApiBody } from '@/lib/apiMappers'
import type { Contact } from '@/types'

export async function getContacts(token: string): Promise<Contact[]> {
  const data = await apiJson<{ data?: unknown[] } | unknown[]>('/api/v1/contacts', { token })
  const list = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? []
  return list.map((raw) => contactFromApi(raw as Parameters<typeof contactFromApi>[0]))
}

export async function getContact(token: string, id: string): Promise<Contact> {
  const raw = await apiJson<Parameters<typeof contactFromApi>[0]>(`/api/v1/contacts/${id}`, { token })
  return contactFromApi(raw)
}

export type CreateContactBody = {
  type: 'customer' | 'supplier'
  name: string
  mobile?: string
  city?: string
  address?: string
  gstNumber?: string
  businessType?: string
  notes?: string
}

export async function createContact(token: string, body: CreateContactBody): Promise<Contact> {
  const raw = await apiJson<Parameters<typeof contactFromApi>[0]>('/api/v1/contacts', {
    method: 'POST',
    body: JSON.stringify(contactToApiBody(body)),
    token,
  })
  return contactFromApi(raw)
}

export type UpdateContactBody = Partial<{
  type: 'customer' | 'supplier'
  name: string
  mobile: string
  city: string
  address: string
  gstNumber: string
  businessType: string
  notes: string
}>

export async function updateContact(token: string, id: string, body: UpdateContactBody): Promise<Contact> {
  const payload: Record<string, unknown> = {}
  if (body.type != null) payload.type = body.type
  if (body.name != null) payload.name = body.name
  if (body.mobile != null) payload.mobile = body.mobile
  if (body.city != null) payload.city = body.city
  if (body.address != null) payload.address = body.address
  if (body.gstNumber != null) payload.gst_number = body.gstNumber
  if (body.businessType != null) payload.business_type = body.businessType
  if (body.notes != null) payload.notes = body.notes
  const raw = await apiJson<Parameters<typeof contactFromApi>[0]>(`/api/v1/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    token,
  })
  return contactFromApi(raw)
}
