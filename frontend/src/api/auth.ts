import { api } from "./client"
import type { ApiSuccess, Agency, LoginPayload, RegisterPayload } from "../types"

export async function register(payload: RegisterPayload): Promise<Agency> {
  const res = await api.post<ApiSuccess<{ agency: Agency }>>("/api/auth/register", payload)
  return res.data.data.agency
}

// There's no logout endpoint on the backend (stateless JWT, no session to
// invalidate server-side) — login() is the only call this module needs.
// Logging out is purely a client-side token clear, handled in AuthContext.
export async function login(payload: LoginPayload): Promise<string> {
  const res = await api.post<ApiSuccess<{ accessToken: string }>>("/api/auth/login", payload)
  return res.data.data.accessToken
}
