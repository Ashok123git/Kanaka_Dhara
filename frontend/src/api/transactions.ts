/**
 * Transactions API: CRUD + POST /transactions/{id}/attachments
 */

import { apiFetch, apiJson } from './client'
import { transactionFromApi } from '@/lib/apiMappers'
import type { Transaction } from '@/types'

type TransactionApiRaw = Parameters<typeof transactionFromApi>[0]

export async function getTransactions(token: string, contactId?: string): Promise<Transaction[]> {
  const qs = contactId ? `?contact_id=${encodeURIComponent(contactId)}` : ''
  const data = await apiJson<{ data?: TransactionApiRaw[] } | TransactionApiRaw[]>(`/api/v1/transactions${qs}`, { token })
  const list = Array.isArray(data) ? data : (data as { data?: TransactionApiRaw[] }).data ?? []
  return list.map((raw) => transactionFromApi(raw))
}

export async function getTransaction(token: string, id: string): Promise<Transaction> {
  const raw = await apiJson<TransactionApiRaw>(`/api/v1/transactions/${id}`, { token })
  return transactionFromApi(raw)
}

/** Request body for creating a transaction (snake_case for backend). */
export type CreateTransactionBody = {
  contact_id: string
  type: string
  date: string
  order_id?: string | null
  amount: number
  notes?: string | null
  payment_mode?: string | null
}

export async function createTransaction(
  token: string,
  body: CreateTransactionBody,
): Promise<Record<string, unknown>> {
  return apiJson<Record<string, unknown>>('/api/v1/transactions', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  })
}

export async function uploadTransactionAttachment(
  token: string,
  transactionId: string,
  file: File,
): Promise<{ id: string; transactionId: string; filePath: string; createdAt: string }> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(`/api/v1/transactions/${transactionId}/attachments`, {
    method: 'POST',
    body: form,
    token,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload attachment failed')
  }
  return res.json()
}
