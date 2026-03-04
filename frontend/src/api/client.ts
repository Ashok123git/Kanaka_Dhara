/**
 * Base API client: BASE_URL, auth header injection, 401 → try refresh then retry or clear + redirect.
 */

import type { RefreshTokenResponse } from '@/types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export type ClearTokenFn = () => void

let clearToken: ClearTokenFn = () => {}

export function setClearTokenFn(fn: ClearTokenFn) {
  clearToken = fn
}

export interface AuthRefreshCallbacks {
  getRefreshToken: () => string | null
  setTokensFromRefresh: (accessToken: string, refreshToken: string) => void
  /** Call refresh API (raw); return null on failure. Must not use apiFetch to avoid 401 loop. */
  callRefreshApi: (refreshTokenValue: string) => Promise<RefreshTokenResponse | null>
}

let getRefreshToken: () => string | null = () => null
let setTokensFromRefresh: (accessToken: string, refreshToken: string) => void = () => {}
let callRefreshApi: (refreshTokenValue: string) => Promise<RefreshTokenResponse | null> = async () => null

export function setAuthRefreshCallbacks(cbs: AuthRefreshCallbacks) {
  getRefreshToken = cbs.getRefreshToken
  setTokensFromRefresh = cbs.setTokensFromRefresh
  callRefreshApi = cbs.callRefreshApi
}

export function getBaseUrl(): string {
  return BASE_URL.replace(/\/$/, '')
}

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000
const REFRESH_PATH = '/api/v1/auth/refresh'

/** Single in-flight refresh; shared so concurrent 401s do not trigger multiple refreshes. */
let refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise
  const rt = getRefreshToken()
  if (!rt) {
    clearToken()
    window.location.href = '/login'
    return null
  }
  refreshPromise = (async () => {
    try {
      const data = await callRefreshApi(rt)
      if (!data) return null
      setTokensFromRefresh(data.access_token, data.refresh_token)
      return data.access_token
    } catch {
      clearToken()
      window.location.href = '/login'
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null; timeoutMs?: number } = {},
): Promise<Response> {
  const { token, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...init } = options
  const url = path.startsWith('http') ? path : `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`
  const headers = new Headers(init.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(url, { ...init, headers, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }

  if (res.status === 401) {
    if (path.includes(REFRESH_PATH)) {
      clearToken()
      window.location.href = '/login'
      return res
    }
    const newToken = await doRefresh()
    if (newToken) {
      return apiFetch(path, { ...init, token: newToken, timeoutMs })
    }
    return res
  }

  return res
}

export async function apiJson<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const res = await apiFetch(path, options)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
