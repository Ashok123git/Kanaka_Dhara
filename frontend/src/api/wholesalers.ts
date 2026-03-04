/**
 * Wholesaler API: GET/PUT /wholesalers/me
 */

import { apiJson } from './client'
import type { Wholesaler } from '@/types'

export interface UpsertWholesalerResponse {
  wholesaler: Wholesaler
  /** Present when profile was just created; use to update auth without re-login */
  access_token?: string
  token_type?: string
  has_wholesaler?: boolean
}

export async function getMyWholesaler(token: string): Promise<Wholesaler> {
  return apiJson<Wholesaler>('/api/v1/wholesalers/me', { token })
}

export async function updateMyWholesaler(
  token: string,
  body: Partial<Omit<Wholesaler, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<UpsertWholesalerResponse> {
  return apiJson<UpsertWholesalerResponse>('/api/v1/wholesalers/me', {
    method: 'PUT',
    body: JSON.stringify(body),
    token,
  })
}
