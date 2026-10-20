// ──────────────────────────────────────────
// GhostRank — Rate Limiters
// ──────────────────────────────────────────

import rateLimit from "express-rate-limit"

// Max login attempts per IP per window
const LOGIN_MAX = 10
// Login window length in minutes
const LOGIN_WINDOW_MINUTES = 15
// Max registrations per IP per window
const REGISTER_MAX = 5
// Register window length in minutes
const REGISTER_WINDOW_MINUTES = 60
// Max scans started per agency per window
const SCAN_MAX = 10
// Scan window length in minutes
const SCAN_WINDOW_MINUTES = 60

// NOTE: a deployment behind a proxy would need app.set("trust proxy") configured, or all clients share the proxy's IP.

function limiter(max: number, windowMinutes: number, message: string, keyGenerator?: (req: any) => string) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    message: { status: "error", message },
  })
}

export const loginLimiter = limiter(
  LOGIN_MAX,
  LOGIN_WINDOW_MINUTES,
  "Too many login attempts, please try again later"
)

export const registerLimiter = limiter(
  REGISTER_MAX,
  REGISTER_WINDOW_MINUTES,
  "Too many registration attempts, please try again later"
)

// Must run after authenticate so req.user is set
export const scanLimiter = limiter(
  SCAN_MAX,
  SCAN_WINDOW_MINUTES,
  "Scan limit reached, please try again later",
  (req) => req.user!.agencyId
)
