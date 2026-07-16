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

let currentToken: string | null = null

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
    if (error.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler()
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

    if (!err.response) {
      return "Couldn't reach the server. Is the backend running?"
    }

    return `Request failed (${err.response.status}).`
  }

  if (err instanceof Error) return err.message
  return "Something went wrong."
}
