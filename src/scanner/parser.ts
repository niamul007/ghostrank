// ──────────────────────────────────────────
// GhostRank — Response Parser
// ──────────────────────────────────────────
// Takes raw AI responses and extracts:
// 1. Was the business mentioned? (boolean, via fuzzy matching — see detector.ts)
// 2. What position in the list? (number or null)
// 3. What sentiment? (positive/neutral/negative)
//
// This is the trickiest part of the scanner because
// AI responses are unstructured text — no consistent format.
// We have to be smart about how we search.
//
// Mention detection itself lives in detector.ts (fuzzy word-alignment
// matching, context extraction, alternative-business extraction) — this
// file orchestrates that plus the position/sentiment logic that was
// already here.

import type { AIResponse, BuiltPrompt, ParsedScanResult, Platform, PromptCategory, SentimentLabel } from "../types"
import { sanitizeText } from "../utils/sanitizeText"
import { extractAlternatives, extractContext, findBestMatch } from "./detector"

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
 *
 * Unchanged from before: still line-level exact/significant-word
 * matching rather than the fuzzy detector, since it's only scanning for
 * which line has a leading number, not deciding whether the business was
 * mentioned at all (that's handled upstream by detector.ts's fuzzy match).
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
 * Determines if a mention was positive, neutral, or negative.
 *
 * Simple keyword-based approach. Not as sophisticated as a dedicated NLP
 * model, but good enough for v1 and — crucially — free. This only runs
 * once a mention is already confirmed by detector.ts's fuzzy match; it's
 * summarizing what's already known to exist in the text, not deciding
 * whether it exists.
 *
 * Why not use AI to analyze sentiment?
 * That would mean making ANOTHER API call for each result, doubling our
 * costs. Keyword matching is free and fast. We can upgrade to an AI-based
 * pass in v2 if this proves too coarse in practice.
 *
 * Takes the extracted context sentence directly (from detector.ts's
 * extractContext) rather than re-deriving it — one context-extraction
 * implementation, not two.
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

export function detectSentiment(context: string): SentimentLabel {
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

// ──────────────────────────────────────────
// Main parse functions (exported)
// ──────────────────────────────────────────

/**
 * Parses a single AI response into a structured result.
 *
 * Mention detection is entirely code-driven (detector.ts's fuzzy
 * word-alignment match) — never the AI's own self-report. Detection runs
 * against the AI's original rawText, not the sanitized text stored below:
 * detectPosition specifically looks for markdown-style list markers
 * ("1.", "2)", "#"), which sanitizeText strips, so sanitizing first would
 * silently zero out every position. Only the `response` field that
 * actually gets stored/returned is sanitized.
 */
export function parseResponse(
  response: AIResponse,
  businessName: string,
  category: PromptCategory
): ParsedScanResult {
  const match = findBestMatch(response.rawText, businessName)
  const mentioned = match !== null && match.strength !== "none"

  const context = mentioned && match ? extractContext(response.rawText, match) : null

  return {
    platform: response.platform,
    prompt: response.prompt,
    category,
    response: sanitizeText(response.rawText),
    mentioned,
    matchStrength: match?.strength ?? "none",
    matchScore: match?.score ?? 0,
    position: mentioned
      ? detectPosition(response.rawText, businessName)
      : null,
    sentiment: context ? detectSentiment(context) : null,
    // Best-effort — see extractAlternatives' doc comment on its
    // reliability. Computed regardless of `mentioned` since it's most
    // useful precisely when the client's business *didn't* show up: who
    // did the AI suggest instead?
    alternatives: extractAlternatives(response.rawText, businessName),
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
