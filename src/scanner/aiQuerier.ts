// ──────────────────────────────────────────
// GhostRank — AI Querier
// ──────────────────────────────────────────
// Sends prompts to ChatGPT, Perplexity, and Gemini
// and captures their raw responses.
//
// Why three platforms?
// Each AI has different training data and search behavior.
// A business might be visible on Perplexity (which searches the web)
// but invisible on ChatGPT (which relies more on training data).
// Checking all three gives the full picture.

import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"
import Anthropic from "@anthropic-ai/sdk"
import { aiConfig } from "../config/ai.config"
import type { AIResponse, BuiltPrompt, ClaudeUsage, Platform } from "../types/index.ts"

// ──────────────────────────────────────────
// SDK Clients — initialized once, reused for all calls
// ──────────────────────────────────────────

/**
 * OpenAI client — used for ChatGPT calls.
 * We create it once here instead of creating a new one
 * for every API call. This is more efficient.
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
// Platform-specific query functions
// ──────────────────────────────────────────

/**
 * Sends a prompt to ChatGPT and returns the raw response.
 *
 * The system message is important — it tells ChatGPT to act like
 * a helpful local recommendation engine. Without it, ChatGPT might
 * refuse to recommend specific businesses or add too many disclaimers.
 */
async function queryChatGPT(promptText: string): Promise<string> {
  const client = getOpenAIClient()

  const response = await client.chat.completions.create({
    model: aiConfig.chatgpt.model,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful local business recommendation assistant. " +
          "When asked about businesses in a specific area, provide specific " +
          "business names and brief descriptions based on your knowledge. " +
          "Be direct and specific in your recommendations.",
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
 */
async function queryPerplexity(promptText: string): Promise<string> {
  const client = getPerplexityClient()

  const response = await client.chat.completions.create({
    model: aiConfig.perplexity.model,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful local business recommendation assistant. " +
          "Provide specific business names and descriptions. " +
          "Be direct and specific.",
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
 */
async function queryGemini(promptText: string): Promise<string> {
  const client = getGeminiClient()
  const model = client.getGenerativeModel({ model: aiConfig.gemini.model })

  const result = await model.generateContent(promptText)
  const response = result.response

  return response.text()
}

/**
 * The Claude system prompt — identical on every call this process makes.
 * Pulled out to a constant so the exact same string (and thus the exact
 * same cache key) is sent every time; a rebuilt string with different
 * whitespace would silently miss the cache.
 */
const CLAUDE_SYSTEM_PROMPT =
  "You are a helpful local business recommendation assistant. " +
  "When asked about businesses in a specific area, provide specific " +
  "business names and brief descriptions based on your knowledge. " +
  "Be direct and specific in your recommendations."

/**
 * Sends a prompt to Claude (Anthropic) and returns the raw response
 * plus token usage (so callers can see cache hits/misses).
 *
 * Same system prompt intent as the other platforms: act like a helpful
 * local recommendation engine and be direct about specific businesses.
 *
 * Prompt caching: a scan fires several prompts at Claude back-to-back,
 * all sharing this exact system prompt. Marking it `cache_control:
 * ephemeral` means the 2nd-5th calls in a scan can read it from cache
 * (~0.1x cost) instead of paying full input price every time — the 1st
 * call in each 5-minute window pays a one-time ~1.25x write instead.
 * Note: Anthropic enforces a minimum cacheable prefix (4096 tokens for
 * claude-opus-4-8) — this system prompt is well under that, so on the
 * current model cache_creation_input_tokens will read 0 (no charge, no
 * error, just no-op). The marker is harmless and starts paying off the
 * moment the system prompt grows or the model changes to one with a
 * lower minimum (e.g. Sonnet models cache from 1024 tokens).
 */
async function queryClaude(
  promptText: string
): Promise<{ text: string; usage: ClaudeUsage }> {
  const client = getClaudeClient()

  const response = await client.messages.create({
    model: aiConfig.claude.model,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: CLAUDE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: promptText }],
  })

  const textBlock = response.content.find((block) => block.type === "text")

  return {
    text: textBlock?.type === "text" ? textBlock.text : "",
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  }
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
 * Sends all prompts to their target platforms concurrently.
 *
 * Why Promise.allSettled instead of Promise.all?
 *
 * Promise.all: if ONE call fails, EVERYTHING fails. If Gemini is down,
 * you lose all 15 results — even the 10 successful ChatGPT/Perplexity ones.
 *
 * Promise.allSettled: each call succeeds or fails independently.
 * If Gemini is down, you still get ChatGPT and Perplexity results.
 * The scan is partial but still useful.
 *
 * This is a critical pattern for any app calling external APIs.
 * Never let one flaky service take down your whole operation.
 */
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
 * Instead of firing all 15 calls at once (which hits rate limits),
 * we send them one by one with a small delay between each.
 * Slower but reliable.
 */
export async function queryAllPlatforms(
  prompts: BuiltPrompt[]
): Promise<AIResponse[]> {
  const responses: AIResponse[] = []

  for (const prompt of prompts) {
    try {
      const response = await queryPlatform(prompt.platform, prompt)
      responses.push(response)
    } catch (error) {
      console.error(`Platform query failed:`, error)
    }

    // Wait 2 seconds between calls to avoid rate limits
    await delay(2000)
  }

  logCacheSummary(responses)

  return responses
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