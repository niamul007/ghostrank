// ──────────────────────────────────────────
// GhostRank — Response Parser
// ──────────────────────────────────────────
// Takes raw AI responses and extracts:
// 1. Was the business mentioned? (boolean)
// 2. What position in the list? (number or null)
// 3. What sentiment? (positive/neutral/negative)
//
// This is the trickiest part of the scanner because
// AI responses are unstructured text — no consistent format.
// We have to be smart about how we search.

import type { AIResponse, ParsedScanResult, Platform, PromptCategory, SentimentLabel } from "../types"
import type { BuiltPrompt } from "./promptBuilder"

// ──────────────────────────────────────────
// Mention Detection
// ──────────────────────────────────────────

/**
 * Checks if the business name appears in the AI response.
 *
 * Why not just response.includes(businessName)?
 * Because AI models don't always use the exact name.
 * "Smile Dental Clinic" might appear as:
 * - "Smile Dental" (partial match)
 * - "smile dental clinic" (different case)
 * - "Smile Dental & Orthodontics" (extended name)
 *
 * Strategy:
 * 1. Case-insensitive full name match
 * 2. If no full match, try matching significant words
 *    (skip common words like "the", "and", "clinic")
 *
 * Why word boundary (\b)?
 * Without it, "Smile" would match "SmileMore" or "unsmile".
 * Word boundaries ensure we match whole words only.
 */
export function detectMention(
  responseText: string,
  businessName: string
): boolean {
  const text = responseText.toLowerCase()
  const name = businessName.toLowerCase().trim()

  // Try 1: exact full name match (case-insensitive)
  if (text.includes(name)) {
    return true
  }

  // Try 2: match significant words from the business name
  // "Smile Dental Clinic" → check if "smile" AND "dental" appear
  const skipWords = new Set([
    "the", "and", "of", "in", "at", "by", "for", "a", "an",
    "llc", "inc", "co", "ltd", "corp",
    "clinic", "studio", "agency", "shop", "store", "center",
    "centre", "group", "services", "solutions",
  ])

  const significantWords = name
    .split(/\s+/)
    .filter((word) => word.length > 2 && !skipWords.has(word))

  // Need at least 2 significant words to match, or 1 if name is short
  const threshold = significantWords.length >= 2 ? 2 : 1

  let matchCount = 0
  for (const word of significantWords) {
    // Use word boundary to avoid partial matches
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i")
    if (regex.test(responseText)) {
      matchCount++
    }
  }

  return matchCount >= threshold
}

/**
 * Escapes special regex characters in a string.
 * Without this, a business name like "A+ Dental" would crash
 * because "+" is a special regex character.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// ──────────────────────────────────────────
// Position Detection
// ──────────────────────────────────────────

/**
 * Finds the position of the business in a numbered list.
 *
 * AI responses often look like:
 * "1. BrightSmile Dental
 *  2. Smile Dental Clinic
 *  3. Miami Family Dentistry"
 *
 * We find the number before the business name mention.
 *
 * Returns null if:
 * - Business not mentioned
 * - Response isn't a numbered list
 * - Can't determine position
 */
export function detectPosition(
  responseText: string,
  businessName: string
): number | null {
  const lines = responseText.split("\n")
  const name = businessName.toLowerCase()

  for (const line of lines) {
    const lower = line.toLowerCase()

    // Check if this line contains the business name
    if (!lower.includes(name) && !hasSignificantWordMatch(lower, name)) {
      continue
    }

    // Try to extract a number from the start of the line
    // Matches patterns like: "1.", "1)", "1:", "#1", "**1.**"
    const numberMatch = line.match(/^\s*[#*]*\s*(\d+)\s*[.):\-]/)
    if (numberMatch) {
      return parseInt(numberMatch[1], 10)
    }
  }

  return null
}

/**
 * Helper: checks if significant words from businessName appear in a line.
 * Used by detectPosition to catch partial name matches in list items.
 */
function hasSignificantWordMatch(line: string, businessName: string): boolean {
  const words = businessName
    .split(/\s+/)
    .filter((w) => w.length > 3)

  if (words.length === 0) return false

  let matches = 0
  for (const word of words) {
    if (line.includes(word)) matches++
  }

  return matches >= Math.min(2, words.length)
}

// ──────────────────────────────────────────
// Sentiment Detection
// ──────────────────────────────────────────

/**
 * Determines if the mention is positive, neutral, or negative.
 *
 * Simple keyword-based approach. Not as sophisticated as a
 * dedicated NLP model, but good enough for v1.
 *
 * Why not use AI to analyze sentiment?
 * That would mean making ANOTHER API call for each result,
 * doubling our costs. Keyword matching is free and fast.
 * We can upgrade to AI-based sentiment in v2 if needed.
 */

const POSITIVE_SIGNALS = [
  "highly recommended", "excellent", "top-rated", "best",
  "outstanding", "great reputation", "well-known", "trusted",
  "popular", "renowned", "award", "five star", "5 star",
  "highly regarded", "premier", "leading", "favorite",
  "go-to", "standout", "exceptional", "impressive",
]

const NEGATIVE_SIGNALS = [
  "avoid", "poor", "complaints", "negative reviews",
  "controversial", "issues", "problems", "warning",
  "not recommended", "be cautious", "mixed reviews",
  "below average", "disappointing", "overpriced",
]

export function detectSentiment(
  responseText: string,
  businessName: string
): SentimentLabel | null {
  // Find the section of text around the business mention
  const context = extractMentionContext(responseText, businessName)
  if (!context) return null

  const lower = context.toLowerCase()

  let positiveCount = 0
  let negativeCount = 0

  for (const signal of POSITIVE_SIGNALS) {
    if (lower.includes(signal)) positiveCount++
  }

  for (const signal of NEGATIVE_SIGNALS) {
    if (lower.includes(signal)) negativeCount++
  }

  if (positiveCount > negativeCount) return "positive"
  if (negativeCount > positiveCount) return "negative"
  return "neutral"
}

/**
 * Extracts ~200 characters around the business mention.
 *
 * Why not analyze the whole response?
 * The response might mention 10 businesses. We only care about
 * the words NEAR our client's name. "Excellent" on line 1
 * about a competitor doesn't mean our client is excellent.
 */
function extractMentionContext(
  responseText: string,
  businessName: string
): string | null {
  const lower = responseText.toLowerCase()
  const nameLower = businessName.toLowerCase()

  const index = lower.indexOf(nameLower)
  if (index === -1) return null

  // Grab 100 chars before and 100 chars after the mention
  const start = Math.max(0, index - 100)
  const end = Math.min(responseText.length, index + nameLower.length + 100)

  return responseText.slice(start, end)
}

// ──────────────────────────────────────────
// Main parse functions (exported)
// ──────────────────────────────────────────

/**
 * Parses a single AI response into a structured result.
 *
 * Takes the raw response and extracts:
 * - mentioned: was the business found?
 * - position: where in the list?
 * - sentiment: positive/neutral/negative?
 */
export function parseResponse(
  response: AIResponse,
  businessName: string,
  category: PromptCategory
): ParsedScanResult {
  const mentioned = detectMention(response.rawText, businessName)

  return {
    platform: response.platform,
    prompt: response.prompt,
    category,
    response: response.rawText,
    mentioned,
    position: mentioned
      ? detectPosition(response.rawText, businessName)
      : null,
    sentiment: mentioned
      ? detectSentiment(response.rawText, businessName)
      : null,
  }
}

/**
 * Parses all AI responses for a scan.
 *
 * Takes the full list of responses + the original prompts
 * (to know the category of each) and returns parsed results.
 */
export function parseAll(
  responses: AIResponse[],
  prompts: BuiltPrompt[],
  businessName: string
): ParsedScanResult[] {
  return responses.map((response) => {
    // Find the matching prompt to get its category
    const matchingPrompt = prompts.find(
      (p) => p.text === response.prompt && p.platform === response.platform
    )
    const category = matchingPrompt?.category ?? "direct"

    return parseResponse(response, businessName, category)
  })
}