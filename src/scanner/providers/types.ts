// ──────────────────────────────────────────
// GhostRank — Provider types
// ──────────────────────────────────────────
// The contract every AI provider implements for the new runner.

export interface ProviderAnswer {
  text: string
  inputTokens?: number
  outputTokens?: number
  durationMs: number
  sources?: { title: string; url: string }[]
}

export interface AIProvider {
  name: string
  model: string
  ask(questionText: string): Promise<ProviderAnswer>
}

/**
 * A provider call failed. `message` is a short safe label (see
 * describeFailure in aiQuerier.ts), never raw provider text. `retryable`
 * says whether trying again could help (429, 5xx, network/timeout).
 */
export class ProviderError extends Error {
  readonly retryable: boolean

  constructor(label: string, retryable: boolean) {
    super(label)
    this.name = "ProviderError"
    this.retryable = retryable
  }
}
