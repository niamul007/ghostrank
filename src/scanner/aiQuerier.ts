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
import { aiConfig } from "../config/ai.config"
import type { AIResponse, BuiltPrompt, Platform } from "../types/index.ts"

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

  switch (platform) {
    case "chatgpt":
      rawText = await queryChatGPT(prompt.text)
      break
    case "perplexity":
      rawText = await queryPerplexity(prompt.text)
      break
    case "gemini":
      rawText = await queryGemini(prompt.text)
      break
    default:
      throw new Error(`Unknown platform: ${platform}`)
  }

  const durationMs = Date.now() - startTime

  return {
    platform,
    prompt: prompt.text,
    rawText,
    durationMs,
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
export async function queryAllPlatforms(
  prompts: BuiltPrompt[]
): Promise<AIResponse[]> {
  const results = await Promise.allSettled(
    prompts.map((prompt) => queryPlatform(prompt.platform, prompt))
  )

  const responses: AIResponse[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      responses.push(result.value)
    } else {
      // Log the failure but don't crash the whole scan
      console.error(`Platform query failed:`, result.reason)
    }
  }

  return responses
}