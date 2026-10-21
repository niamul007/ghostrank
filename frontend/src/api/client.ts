// ──────────────────────────────────────────
// GhostRank — Axios instance
// ──────────────────────────────────────────
// One shared client. Token attachment and 401 handling live here so every
// resource module (auth/clients/scans/reports) gets them for free instead
// of repeating interceptor logic.
//
// Why module-level token storage instead of importing AuthContext here?
// AuthContext needs to import the API functions that use this client —
// importing AuthContext back from here would be a circular import. Instead
// AuthContext calls setAuthToken()/setUnauthorizedHandler() to push state
// in, and this module stays ignorant of React entirely.

import axios, { AxiosError } from "axios"
import type { ApiErrorBody } from "../types"

export const api = axios.create({
  // Empty string + relative "/api/..." calls: in dev, Vite's proxy (see
  // vite.config.ts) forwards them to the backend on :4000. In prod, set
  // VITE_API_URL to the backend's absolute origin.
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: { "Content-Type": "application/json" },
})

const TOKEN_KEY = "ghostrank.token"
const EMAIL_KEY = "ghostrank.email"

/** sessionStorage can throw (blocked/unavailable) — every access is guarded. */
export function loadStoredAuth(): { token: string | null; email: string | null } {
  try {
    return {
      token: sessionStorage.getItem(TOKEN_KEY),
      email: sessionStorage.getItem(EMAIL_KEY),
    }
  } catch {
    return { token: null, email: null }
  }
}

export function saveStoredAuth(token: string, email: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(EMAIL_KEY, email)
  } catch {
    // storage unavailable — session just won't survive a refresh
  }
}

export function clearStoredAuth(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(EMAIL_KEY)
  } catch {
    // nothing to clear if storage is unavailable
  }
}

// Seeded from storage so the first request after a refresh sends the token.
let currentToken: string | null = loadStoredAuth().token

export function setAuthToken(token: string | null): void {
  currentToken = token
}

let unauthorizedHandler: (() => void) | null = null

/** Registered once by AuthContext — called on any 401 response. */
export function setUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler
}

api.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearStoredAuth()
      if (unauthorizedHandler) unauthorizedHandler()
    }
    return Promise.reject(error)
  }
)

/**
 * Turns any error thrown by an `api.*` call into one user-facing string.
 * The backend replies in two different shapes for failures (see
 * ApiErrorBody) — this normalizes both, plus network/timeout failures
 * that never reached the server.
 */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (err.code !== "ECONNABORTED" && (!err.response || status === 502 || status === 503 || status === 504)) {
      return "Can't reach the server. Please try again in a moment."
    }

    const body = err.response?.data as ApiErrorBody | undefined

    if (body && "errors" in body && body.errors) {
      const messages = Object.values(body.errors)
        .flat()
        .filter((m): m is string => Boolean(m))
      if (messages.length > 0) return messages.join(" ")
    }

    if (body && "message" in body && body.message) {
      return body.message
    }

    if (err.code === "ECONNABORTED") {
      return "The request timed out. Please try again."
    }

    return `Request failed (${status ?? "unknown"}).`
  }

  if (err instanceof Error) return err.message
  return "Something went wrong."
}
