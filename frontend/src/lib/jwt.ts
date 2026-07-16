import type { JwtClaims } from "../types"

/**
 * Decodes a JWT's payload without verifying the signature — the backend
 * already verified it to issue the response; the frontend only needs the
 * claims to know who's logged in and when the token expires. Never trust
 * this for anything security-sensitive.
 */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    // base64url -> base64
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(normalized)
    return JSON.parse(json) as JwtClaims
  } catch {
    return null
  }
}

export function isExpired(claims: JwtClaims): boolean {
  return claims.exp * 1000 <= Date.now()
}
