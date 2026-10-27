// ──────────────────────────────────────────
// GhostRank — Claude provider
// ──────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk"
import { aiConfig } from "../../config/ai.config"
import {
  EmptyAnswerError,
  describeFailure,
  queryClaudeOnce,
} from "../aiQuerier"
import { ProviderError, type AIProvider, type ProviderAnswer } from "./types"

// Pause before retrying a call that came back with no usable text.
const BLANK_ANSWER_RETRY_DELAY_MS = 1000

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** 429, 5xx, and errors with no HTTP status (network / timeout). */
function isRetryable(error: unknown): boolean {
  if (error instanceof EmptyAnswerError) return false
  const status = (error as { status?: unknown } | null)?.status
  if (typeof status === "number") return status === 429 || status >= 500
  return (
    error instanceof Anthropic.APIConnectionError ||
    error instanceof Anthropic.APIConnectionTimeoutError
  )
}

export interface ClaudeProviderDeps {
  client?: Anthropic
  sleep?: (ms: number) => Promise<void>
}

export function createClaudeProvider(deps: ClaudeProviderDeps = {}): AIProvider {
  const sleep = deps.sleep ?? realSleep

  // Built on the first ask, so import and server startup never need an API key
  let ownClient: Anthropic | undefined
  const getClient = (): Anthropic => {
    if (deps.client) return deps.client
    // Retries are handled by withRetry, so they are visible and counted
    ownClient ??= new Anthropic({
      apiKey: aiConfig.claude.apiKey,
      timeout: aiConfig.claude.timeoutMs,
      maxRetries: 0,
    })
    return ownClient
  }

  return {
    name: "claude",
    model: aiConfig.claude.model,

    async ask(questionText: string): Promise<ProviderAnswer> {
      const startTime = Date.now()

      try {
        let result
        try {
          result = await queryClaudeOnce(questionText, getClient())
        } catch (error) {
          if (!(error instanceof EmptyAnswerError)) throw error
          console.warn(`Claude returned no text (${error.message}), retrying once`)
          await sleep(BLANK_ANSWER_RETRY_DELAY_MS)
          result = await queryClaudeOnce(questionText, getClient())
        }

        return {
          text: result.text,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          durationMs: Date.now() - startTime,
          sources: result.sources,
        }
      } catch (error) {
        // Full provider error stays in the server log only
        console.error("Claude provider call failed:", error)
        throw new ProviderError(describeFailure(error), isRetryable(error))
      }
    },
  }
}
