export type Platform = "chatgpt" | "perplexity" | "gemini"

export type SentimentLabel = "positive" | "neutral" | "negative"

export interface AIResponse {
  platform: Platform
  prompt: string
  rawText: string
  durationMs: number
}

export interface ParsedScanResult {
  platform: string
  prompt: string
  response: string
  mentioned: boolean
  position: number | null
  sentiment: SentimentLabel | null
}

export interface VisibilityScore {
  overall: number
  byPlatform: Record<Platform, number>
  mentionCount: number
  totalPrompts: number
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
}

export interface ScanJobPayload {
  clientId: string
  businessName: string
  niche: string
  location: string
}
