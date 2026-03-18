/**
 * Auth state & guards: user/session, setToken, clearToken, refresh token.
 */

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { refreshToken } from '@/api/auth'
import { setAuthRefreshCallbacks, setClearTokenFn } from '@/api/client'
import { clearAllData } from '@/lib/storage'
import type { AuthUser } from '@/types'

const AUTH_TOKEN_KEY = 'kanaka_dhara_token'
const REFRESH_TOKEN_KEY = 'kanaka_dhara_refresh_token'
/** Refresh access token this many ms before it expires. */
const PROACTIVE_REFRESH_BEFORE_MS = 5 * 60 * 1000

/** Decode JWT payload without verification (client-side scheduling only). Returns exp in seconds or null. */
function getAccessTokenExp(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}

export interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  hasWholesaler: boolean | null
}

export interface AuthContextValue extends AuthState {
  isAuthenticated: boolean
  setAuth: (token: string, user: AuthUser, hasWholesaler: boolean, refreshToken?: string) => void
  setTokensFromRefresh: (accessToken: string, refreshToken: string) => void
  clearToken: () => void
}

const initialState: AuthState = {
  token: typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null,
  refreshToken: typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,
  user: null,
  hasWholesaler: null,
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  const clearToken = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    sessionStorage.clear()
    clearAllData()
    setState((prev) => ({ ...prev, token: null, refreshToken: null, user: null, hasWholesaler: null }))
  }, [])

  const setAuth = useCallback((token: string, user: AuthUser, hasWholesaler: boolean, refreshToken?: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    if (refreshToken !== undefined) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
    setState((prev) => ({
      ...prev,
      token,
      refreshToken: refreshToken ?? prev.refreshToken,
      user,
      hasWholesaler,
    }))
  }, [])

  const setTokensFromRefresh = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    setState((prev) => ({ ...prev, token: accessToken, refreshToken }))
  }, [])

  useEffect(() => {
    setClearTokenFn(clearToken)
  }, [clearToken])

  const callRefreshApi = useCallback(
    (refreshTokenValue: string) => refreshToken(refreshTokenValue),
    [],
  )

  useEffect(() => {
    setAuthRefreshCallbacks({
      getRefreshToken: () => (typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null),
      setTokensFromRefresh,
      callRefreshApi,
    })
  }, [setTokensFromRefresh, callRefreshApi])

  // Proactive refresh: refresh access token shortly before it expires
  useEffect(() => {
    const token = state.token
    const rt = state.refreshToken
    if (!token || !rt) return
    const exp = getAccessTokenExp(token)
    if (exp == null) return
    const expiresAtMs = exp * 1000
    const refreshAtMs = expiresAtMs - PROACTIVE_REFRESH_BEFORE_MS
    const delay = refreshAtMs - Date.now()
    if (delay <= 0) return
    const timeoutId = setTimeout(async () => {
      const currentRt = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null
      if (!currentRt) return
      try {
        const data = await refreshToken(currentRt)
        setTokensFromRefresh(data.access_token, data.refresh_token)
      } catch {
        clearToken()
        window.location.href = '/login'
      }
    }, delay)
    return () => clearTimeout(timeoutId)
  }, [state.token, state.refreshToken, setTokensFromRefresh, clearToken])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: !!state.token,
      setAuth,
      setTokensFromRefresh,
      clearToken,
    }),
    [state, setAuth, setTokensFromRefresh, clearToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
