// ──────────────────────────────────────────
// GhostRank — Shared Types
// ──────────────────────────────────────────

/**
 * The three AI platforms we scan against.
 * "chatgpt" = OpenAI, "perplexity" = Perplexity, "gemini" = Google Gemini
 */
export type Platform = "chatgpt" | "perplexity" | "gemini"

/**
 * Sentiment of how the AI mentioned the business.
 * "positive" = recommended/praised, "neutral" = just listed, "negative" = warned against
 */
export type SentimentLabel = "positive" | "neutral" | "negative"

/**
 * Category of prompt — each tests a different way customers search.
 * "direct"     → "best dentist in Miami"
 * "comparison" → "compare top dentists in Miami"
 * "discovery"  → "I need a dentist in Miami, who should I go to?"
 * "specific"   → "best dentist for teeth whitening in Miami"
 */
export type PromptCategory = "direct" | "comparison" | "discovery" | "specific"

// ──────────────────────────────────────────
// Scanner types
// ──────────────────────────────────────────

/**
 * A structured prompt ready to send to an AI platform.
 * Built by promptBuilder.ts from the client's business info.
 */
export interface BuiltPrompt {
  /** The actual text to send to the AI */
  text: string
  /** Which platform this prompt is for */
  platform: Platform
  /** What type of search this simulates */
  category: PromptCategory
}

/**
 * Raw response from an AI platform before parsing.
 * Returned by aiQuerier.ts.
 */
export interface AIResponse {
  platform: Platform
  prompt: string
  rawText: string
  /** How long the API call took — useful for monitoring */
  durationMs: number
}

/**
 * Parsed result after checking if the business was mentioned.
 * Returned by parser.ts.
 */
export interface ParsedScanResult {
  platform: Platform
  prompt: string
  category: PromptCategory
  response: string
  /** Was the business name found in the AI's response? */
  mentioned: boolean
  /** If mentioned, what position in the list? (1 = first, null = not in a list) */
  position: number | null
  /** Was the mention positive, neutral, or negative? */
  sentiment: SentimentLabel | null
}

// ──────────────────────────────────────────
// Scorer types
// ──────────────────────────────────────────

/**
 * The visibility score calculated from all scan results.
 * This is what the agency sees in their report.
 */
export interface VisibilityScore {
  /** Overall score 0-100 */
  overall: number
  /** Score broken down by platform */
  byPlatform: Record<Platform, number>
  /** How many prompts returned a mention */
  mentionCount: number
  /** Total prompts sent across all platforms */
  totalPrompts: number
  /** Breakdown of sentiment across all mentions */
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  /** Average position when mentioned (lower = better) */
  averagePosition: number | null
}

// ──────────────────────────────────────────
// Job types
// ──────────────────────────────────────────

/**
 * Payload for triggering a scan job.
 * This is what gets passed to the scanner when an agency clicks "Run Scan".
 */
export interface ScanJobPayload {
  scanId: string
  clientId: string
  businessName: string
  niche: string
  location: string
}