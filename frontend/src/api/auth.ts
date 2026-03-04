/**
 * Auth API: sendOtp, verifyOtp, refresh, logout (client-side clear).
 */

import { apiFetch, getBaseUrl } from './client'
import type { RefreshTokenResponse, VerifyOtpResponse } from '@/types'

export interface SendOtpBody {
  phone: string
}

export interface VerifyOtpBody {
  phone: string
  code: string
}

/** Standardized OTP error from backend (error_code + message; never raw provider text). */
export interface OtpErrorPayload {
  error_code: string
  message: string
}

function parseOtpErrorResponse(text: string): { message: string; error_code?: string } | null {
  try {
    const json = JSON.parse(text) as { detail?: string | string[] | OtpErrorPayload }
    const detail = json.detail
    if (!detail) return null
    // Standardized shape: { error_code, message }
    if (typeof detail === 'object' && 'message' in detail && typeof (detail as OtpErrorPayload).message === 'string') {
      return {
        message: (detail as OtpErrorPayload).message,
        error_code: (detail as OtpErrorPayload).error_code,
      }
    }
    if (typeof detail === 'string') return { message: detail }
    if (Array.isArray(detail) && detail.length > 0) return { message: String(detail[0]) }
  } catch {
    // not JSON
  }
  return null
}

/** Returns user-facing message only (never logs or exposes raw provider errors). */
function getErrorMessage(_res: Response, text: string, fallback: string): string {
  const parsed = parseOtpErrorResponse(text)
  if (parsed?.message) return parsed.message
  return text || fallback
}

/** Response from send-otp; dev_otp only present when backend uses console provider (dev). */
export interface SendOtpResponse {
  message: string
  /** Present only in development when OTP is not sent via SMS; use for testing. */
  dev_otp?: string
}

const SEND_OTP_URL = '/api/v1/auth/send-otp'

export async function sendOtp(body: SendOtpBody): Promise<SendOtpResponse> {
  const url = `${getBaseUrl()}${SEND_OTP_URL}`
  const payload = JSON.stringify(body)
  console.log('[sendOtp] request', { url, method: 'POST', body: { phone: body.phone } })
  try {
    const res = await apiFetch(SEND_OTP_URL, {
      method: 'POST',
      body: payload,
      timeoutMs: 20_000,
    })
    const text = await res.text()
    console.log('[sendOtp] response', { status: res.status, ok: res.ok, bodyLength: text.length })
    if (!res.ok) {
      const parsed = parseOtpErrorResponse(text)
      const errMsg = parsed?.message ?? getErrorMessage(res, text, 'Send OTP failed')
      // Log only status and safe error_code for debugging; never log raw provider response
      console.error('[sendOtp] error response', { status: res.status, error_code: parsed?.error_code, message: errMsg })
      throw new Error(errMsg)
    }
    const data = JSON.parse(text || '{}') as SendOtpResponse
    console.log('[sendOtp] success', { message: data.message, hasDevOtp: !!data.dev_otp })
    return data
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        console.error('[sendOtp] request timed out', { url })
        throw new Error('Request timed out. Make sure the backend is running at ' + getBaseUrl())
      }
      if (err.message === 'Failed to fetch' || err instanceof TypeError) {
        console.error('[sendOtp] network error', { url, message: err.message })
        throw new Error('Could not reach server. Check that the backend is running and CORS is allowed.')
      }
      // Re-throw API error (backend detail already in err.message)
      console.error('[sendOtp] API error', { message: err.message })
      throw err
    }
    console.error('[sendOtp] unknown error', err)
    throw err
  }
}

export async function verifyOtp(body: VerifyOtpBody): Promise<VerifyOtpResponse> {
  try {
    const res = await apiFetch('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(getErrorMessage(res, text, 'Verify OTP failed'))
    }
    return JSON.parse(text) as VerifyOtpResponse
  } catch (err) {
    if (err instanceof TypeError || (err instanceof Error && err.message === 'Failed to fetch')) {
      throw new Error('Could not reach server. Check your connection.')
    }
    throw err
  }
}

/**
 * Exchange refresh token for new access + refresh tokens.
 * Uses raw fetch so 401 from this endpoint does not trigger the global 401 handler.
 */
export async function refreshToken(refreshTokenValue: string): Promise<RefreshTokenResponse> {
  const url = `${getBaseUrl()}/api/v1/auth/refresh`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || 'Refresh failed')
  }
  return JSON.parse(text || '{}') as RefreshTokenResponse
}
