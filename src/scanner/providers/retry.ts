// ──────────────────────────────────────────
// GhostRank — Retry helper
// ──────────────────────────────────────────

import { ProviderError } from "./types"

// Waits before retry 1 and retry 2 (so at most 2 retries).
export const RETRY_DELAYS_MS = [1000, 3000]

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs fn, retrying up to 2 times — only when it throws a retryable
 * ProviderError. Anything else (bad key, 4xx, unknown errors) is rethrown
 * immediately. `sleep` is injectable so tests don't wait.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = realSleep
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const retryable = error instanceof ProviderError && error.retryable
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw error
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
}
