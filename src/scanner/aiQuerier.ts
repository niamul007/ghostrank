// ──────────────────────────────────────────
// GhostRank — AI Querier
// ──────────────────────────────────────────
// Sends prompts to the active AI platforms (Claude for now) and
// captures their raw responses. ChatGPT, Perplexity and Gemini have
// query functions here but are paused (see queryPlatform below).
//
// Why multiple platforms?
// Each AI has different training data and search behavior.
// A business might be visible on Perplexity (which searches the web)
// but invisible on ChatGPT (which relies more on training data).
// Checking several gives the full picture.

import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Anthropic from "@anthropic-ai/sdk"
import { AI_SYSTEM_PROMPT, aiConfig } from "../config/ai.config"
import type { AIResponse, BuiltPrompt, ClaudeUsage, Platform } from "../types"

// Output cap for Claude answers. Adaptive thinking is on by default for
// this model and its tokens count against the cap, so leave headroom
// beyond the 5-line list.
export const CLAUDE_MAX_TOKENS = 4000

// How many times a paused (pause_turn) web search turn is sent back to Claude.
const MAX_PAUSE_CONTINUATIONS = 2

/** A web page Claude searched or cited. */
export interface ClaudeSource {
  title: string
  url: string
}

// Pause before retrying a Claude call that came back with no usable text.
const EMPTY_ANSWER_RETRY_DELAY_MS = 1000

/**
 * Claude replied, but with no usable text (e.g. only a thinking block).
 * The message holds only the stop_reason and block types, so it is safe
 * to store on a QueryFailure.
 */
export class EmptyAnswerError extends Error {
  constructor(stopReason: string | null, blockTypes: string[]) {
    super(`stop_reason=${stopReason ?? "null"}, blocks=[${blockTypes.join(",")}]`)
    this.name = "EmptyAnswerError"
  }
}

// ──────────────────────────────────────────
// SDK Clients — a new client is created on each call
// ──────────────────────────────────────────

/**
 * OpenAI client — used for ChatGPT calls.
 * Each call to this function builds a fresh client.
 */
function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: aiConfig.chatgpt.apiKey,
    timeout: aiConfig.chatgpt.timeoutMs,
  })
}

/**
 * Perplexity client — uses the OpenAI SDK!
 * Perplexity's API is compatible with OpenAI's format,
 * so we just point the OpenAI SDK at Perplexity's URL.
 * This is a common pattern — many AI providers copy OpenAI's API format.
 */
function getPerplexityClient(): OpenAI {
  return new OpenAI({
    apiKey: aiConfig.perplexity.apiKey,
    baseURL: aiConfig.perplexity.baseUrl,
    timeout: aiConfig.perplexity.timeoutMs,
  })
}

/**
 * Gemini client — uses Google's own SDK.
 * Google has a different API format, so we need their specific SDK.
 */
function getGeminiClient(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(aiConfig.gemini.apiKey)
}

/**
 * Claude client — uses Anthropic's official SDK.
 * This is the only platform currently wired into queryPlatform() below;
 * ChatGPT/Perplexity/Gemini are paused until we're testing multiple platforms.
 */
function getClaudeClient(): Anthropic {
  return new Anthropic({
    apiKey: aiConfig.claude.apiKey,
    timeout: aiConfig.claude.timeoutMs,
  })
}

// ──────────────────────────────────────────
// Result types
// ──────────────────────────────────────────

/** One prompt whose AI call failed. `error` is a short safe label, not raw provider text. */
export interface QueryFailure {
  prompt: string
  platform: Platform
  error: string
}

/** What queryAllPlatforms returns: the responses plus a record of what was attempted. */
export interface QueryAllResult {
  responses: AIResponse[]
  attempted: number
  failures: QueryFailure[]
}

// ──────────────────────────────────────────
// Platform-specific query functions
// ──────────────────────────────────────────

/**
 * Sends a prompt to ChatGPT and returns the raw response.
 *
 * Uses the shared AI_SYSTEM_PROMPT (see ai.config.ts) — natural, free-form
 * answers with no markdown syntax. Detection (was it actually mentioned?)
 * happens afterward in src/scanner/detector.ts, not by asking the model
 * to grade itself.
 */
async function queryChatGPT(promptText: string): Promise<string> {
  const client = getOpenAIClient()

  const response = await client.chat.completions.create({
    model: aiConfig.chatgpt.model,
    messages: [
      {
        role: "system",
        content: AI_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: promptText,
      },
    ],
    temperature: 0.7,
  })

  return response.choices[0]?.message?.content ?? ""
}

/**
 * Sends a prompt to Perplexity.
 *
 * Perplexity is special — it searches the web BEFORE answering.
 * So its recommendations are based on current web data, not just
 * training data. This makes it the most "real-time" platform we test.
 *
 * Notice: same OpenAI SDK, different baseURL. That's the power of
 * API compatibility — learn one SDK, use it for multiple services.
 *
 * Uses the shared AI_SYSTEM_PROMPT (see ai.config.ts) — same fixed
 * response format as every other provider.
 */
async function queryPerplexity(promptText: string): Promise<string> {
  const client = getPerplexityClient()

  const response = await client.chat.completions.create({
    model: aiConfig.perplexity.model,
    messages: [
      {
        role: "system",
        content: AI_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: promptText,
      },
    ],
  })

  return response.choices[0]?.message?.content ?? ""
}

/**
 * Sends a prompt to Google Gemini.
 *
 * Gemini's SDK is different from OpenAI's — Google uses their own format.
 * Instead of chat.completions.create(), it's model.generateContent().
 * Different syntax, same concept: send text in, get text out.
 *
 * `systemInstruction` is Gemini's equivalent of a system message — set to
 * the shared AI_SYSTEM_PROMPT (see ai.config.ts) for the same fixed
 * response format as every other provider.
 */
async function queryGemini(promptText: string): Promise<string> {
  const client = getGeminiClient()
  const model = client.getGenerativeModel({
    model: aiConfig.gemini.model,
    systemInstruction: AI_SYSTEM_PROMPT,
  })

  const result = await model.generateContent(promptText)
  const response = result.response

  return response.text()
}

/**
 * Sends a prompt to Claude (Anthropic) and returns the raw response
 * plus token usage (so callers can see cache hits/misses).
 *
 * Uses the shared AI_SYSTEM_PROMPT (see ai.config.ts) — natural, free-form
 * answers with no markdown syntax. Detection (was it actually mentioned?)
 * happens afterward in src/scanner/detector.ts, not by asking the model
 * to grade itself.
 *
 * Prompt caching: a scan fires several prompts at Claude back-to-back,
 * all sharing this exact system prompt. Marking it `cache_control:
 * ephemeral` means the 2nd-5th calls in a scan can read it from cache
 * (~0.1x cost) instead of paying full input price every time — the 1st
 * call in each 5-minute window pays a one-time ~1.25x write instead.
 * Note: Anthropic enforces a minimum cacheable prefix that varies by model
 * (e.g. 1024 tokens for Sonnet models, 4096 for some others). This system
 * prompt (~190 tokens) is under any of those minimums, so
 * cache_creation_input_tokens will likely read 0 (no charge, no error, just
 * no-op). The marker is harmless and starts paying off once the system
 * prompt grows past the model's minimum.
 */
async function queryClaude(
  promptText: string
): Promise<{ text: string; usage: ClaudeUsage; sources: ClaudeSource[] }> {
  try {
    return await queryClaudeOnce(promptText)
  } catch (error) {
    if (!(error instanceof EmptyAnswerError)) throw error
    console.warn(`Claude returned no text (${error.message}), retrying once`)
    await delay(EMPTY_ANSWER_RETRY_DELAY_MS)
    return await queryClaudeOnce(promptText)
  }
}

/**
 * One Claude call, with web search. Throws EmptyAnswerError if there is no
 * non-blank text. A "pause_turn" stop is sent back (up to
 * MAX_PAUSE_CONTINUATIONS times) so Claude can continue; usage is summed
 * over every round.
 */
export async function queryClaudeOnce(
  promptText: string,
  client: Anthropic = getClaudeClient()
): Promise<{ text: string; usage: ClaudeUsage; sources: ClaudeSource[] }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: promptText },
  ]
  const usage: ClaudeUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  }
  const textParts: string[] = []
  const blockTypes: string[] = []
  const sourcesByUrl = new Map<string, ClaudeSource>()
  const addSource = (title: string | null | undefined, url: string) => {
    if (!sourcesByUrl.has(url)) sourcesByUrl.set(url, { title: title ?? "", url })
  }
  let stopReason: string | null = null

  for (let round = 0; ; round++) {
    const response = await client.messages.create({
      model: aiConfig.claude.model,
      max_tokens: CLAUDE_MAX_TOKENS,
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: AI_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 3 }],
      messages,
    })

    usage.inputTokens += response.usage.input_tokens
    usage.outputTokens += response.usage.output_tokens
    usage.cacheCreationInputTokens += response.usage.cache_creation_input_tokens ?? 0
    usage.cacheReadInputTokens += response.usage.cache_read_input_tokens ?? 0
    stopReason = response.stop_reason

    if (response.stop_reason === "max_tokens") {
      console.warn("Claude answer hit max_tokens (possible truncation)")
    }

    for (const block of response.content) {
      blockTypes.push(block.type)
      if (block.type === "text") {
        textParts.push(block.text)
        for (const citation of block.citations ?? []) {
          if (citation.type === "web_search_result_location") {
            addSource(citation.title, citation.url)
          }
        }
      } else if (block.type === "web_search_tool_result") {
        // Text before a search result is Claude thinking aloud; keep only
        // what comes after the last result.
        textParts.length = 0
        if (Array.isArray(block.content)) {
          for (const result of block.content) addSource(result.title, result.url)
        }
      }
    }

    if (response.stop_reason !== "pause_turn" || round >= MAX_PAUSE_CONTINUATIONS) {
      break
    }
    messages.push({
      role: "assistant",
      content: response.content as Anthropic.ContentBlockParam[],
    })
  }

  const text = textParts.join("")
  if (text.trim() === "") {
    throw new EmptyAnswerError(stopReason, blockTypes)
  }

  return { text, usage, sources: [...sourcesByUrl.values()] }
}

// ──────────────────────────────────────────
// Main query functions (exported)
// ──────────────────────────────────────────

/**
 * Routes a prompt to the correct platform and returns the response.
 *
 * This is the ROUTER — it looks at which platform the prompt is for
 * and calls the right function. Like a switchboard operator.
 *
 * It also measures how long each call takes (durationMs).
 * This is useful for monitoring — if Gemini suddenly takes 20 seconds
 * while ChatGPT takes 2, something might be wrong.
 */
export async function queryPlatform(
  platform: Platform,
  prompt: BuiltPrompt
): Promise<AIResponse> {
  const startTime = Date.now()

  let rawText: string
  let usage: ClaudeUsage | undefined

  switch (platform) {
    case "claude": {
      const result = await queryClaude(prompt.text)
      rawText = result.text
      usage = result.usage
      break
    }
    // Paused for now — testing against Claude only (we only have an
    // Anthropic key at the moment). Uncomment to re-enable.
    // case "chatgpt":
    //   rawText = await queryChatGPT(prompt.text)
    //   break
    // case "perplexity":
    //   rawText = await queryPerplexity(prompt.text)
    //   break
    // case "gemini":
    //   rawText = await queryGemini(prompt.text)
    //   break
    default:
      throw new Error(`Unknown platform: ${platform}`)
  }

  const durationMs = Date.now() - startTime

  return {
    platform,
    prompt: prompt.text,
    rawText,
    durationMs,
    usage,
  }
}

/**
 * Small delay helper — waits for the given milliseconds.
 * Used to avoid hitting API rate limits.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sends all prompts to their target platforms with rate limiting.
 *
 * Instead of firing all calls at once (which hits rate limits),
 * we send them one by one with a 2 second delay between each.
 * Slower but reliable. Each call succeeds or fails independently (try/catch
 * per prompt), so one failed call doesn't lose the other results.
 */
export async function queryAllPlatforms(
  prompts: BuiltPrompt[]
): Promise<QueryAllResult> {
  const responses: AIResponse[] = []
  const failures: QueryFailure[] = []

  for (const prompt of prompts) {
    try {
      const response = await queryPlatform(prompt.platform, prompt)
      responses.push(response)
    } catch (error) {
      // Full provider error stays in the server log only
      console.error(`Platform query failed:`, error)
      failures.push({
        prompt: prompt.text,
        platform: prompt.platform,
        error: describeFailure(error),
      })
    }

    // Wait 2 seconds between calls to avoid rate limits
    await delay(2000)
  }

  logCacheSummary(responses)

  return { responses, attempted: prompts.length, failures }
}

/**
 * Builds a short, safe failure label (error type + HTTP status if any).
 * Never includes the provider's raw message — that text can echo
 * request details, so it is only logged, never stored.
 */
export function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error"
  if (error instanceof EmptyAnswerError) return `${error.name} (${error.message})`

  const status = (error as { status?: unknown }).status
  return typeof status === "number"
    ? `${error.name} (HTTP ${status})`
    : error.name
}

/**
 * Prints a one-line cache summary after a scan so prompt-cache activity
 * is visible without digging into individual response objects.
 */
function logCacheSummary(responses: AIResponse[]): void {
  const claudeUsages = responses
    .map((r) => r.usage)
    .filter((u): u is ClaudeUsage => u !== undefined)

  if (claudeUsages.length === 0) return

  const totals = claudeUsages.reduce(
    (acc, u) => ({
      input: acc.input + u.inputTokens,
      output: acc.output + u.outputTokens,
      cacheWrite: acc.cacheWrite + u.cacheCreationInputTokens,
      cacheRead: acc.cacheRead + u.cacheReadInputTokens,
    }),
    { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
  )

  console.log(
    `[claude cache] ${claudeUsages.length} call(s) — ` +
      `input=${totals.input} output=${totals.output} ` +
      `cache_write=${totals.cacheWrite} cache_read=${totals.cacheRead}`
  )
}