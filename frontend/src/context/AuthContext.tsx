// ──────────────────────────────────────────
// GhostRank — Auth context
// ──────────────────────────────────────────
// Token lives in React state, mirrored to sessionStorage (token + email) so
// a refresh keeps the session. sessionStorage is cleared when the tab closes.
//
// The backend has no "get current user" endpoint (see the endpoint audit
// in the chat) — the JWT payload only carries agencyId + role, no name or
// email. So the "identity" shown in the top bar is whatever we captured
// client-side at register/login time, not something the server confirms
// on every load.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { login as loginRequest } from "../api/auth"
import {
  clearStoredAuth,
  loadStoredAuth,
  saveStoredAuth,
  setAuthToken,
  setUnauthorizedHandler,
} from "../api/client"
import { decodeJwt, isExpired } from "../lib/jwt"
import type { AgencyRole } from "../types"

interface Identity {
  email: string
  name?: string
}

interface AuthContextValue {
  token: string | null
  agencyId: string | null
  role: AgencyRole | null
  identity: Identity | null
  isAuthenticated: boolean
  isReady: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  /** Called right after a successful register, before redirecting to login. */
  rememberIdentity: (identity: Identity) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restored synchronously (lazy initializers) so the first render of a
  // protected route already sees the session — no login-page flash.
  const [token, setToken] = useState<string | null>(() => {
    const stored = loadStoredAuth().token
    setAuthToken(stored)
    return stored
  })
  const [identity, setIdentity] = useState<Identity | null>(() => {
    const { token: storedToken, email } = loadStoredAuth()
    return storedToken && email ? { email } : null
  })
  // Gate rendering for one tick so the 401 handler is registered before any
  // route can fire a request — avoids a race on first paint.
  const [isReady, setIsReady] = useState(false)

  const logout = useCallback(() => {
    setToken(null)
    setAuthToken(null)
    setIdentity(null)
    clearStoredAuth()
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    setIsReady(true)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const accessToken = await loginRequest({ email, password })
    setAuthToken(accessToken)
    setToken(accessToken)
    saveStoredAuth(accessToken, email)
    // Login doesn't return the agency — keep the email the user just typed
    // so the top bar has something to show.
    setIdentity((prev) => (prev && prev.email === email ? prev : { email }))
  }, [])

  const rememberIdentity = useCallback((next: Identity) => {
    setIdentity(next)
  }, [])

  const claims = useMemo(() => (token ? decodeJwt(token) : null), [token])
  const isAuthenticated = Boolean(token && claims && !isExpired(claims))

  const value: AuthContextValue = {
    token,
    agencyId: claims?.agencyId ?? null,
    role: claims?.role ?? null,
    identity,
    isAuthenticated,
    isReady,
    login,
    logout,
    rememberIdentity,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
