// ──────────────────────────────────────────
// Report presentation helpers
// ──────────────────────────────────────────
// Display-only helpers (labels, score-band tones). The report content
// itself (scoreLabel, recommendations, platform breakdown) comes from the
// backend's ReportData — see src/services/report.service.ts.

import type { Platform } from "../types"

export function getScoreLabel(score: number): string {
  if (score >= 81) return "Dominant — you're a top AI recommendation"
  if (score >= 61) return "Strong — regularly mentioned across platforms"
  if (score >= 41) return "Moderate — showing up but inconsistently"
  if (score >= 21) return "Weak — occasional mentions, needs work"
  return "Ghost — virtually invisible in AI search"
}

/** Score-band color token, used consistently on gauges, pills, and meters. */
export function getScoreTone(score: number): "good" | "accent" | "warn" | "bad" {
  if (score >= 61) return "good"
  if (score >= 41) return "accent"
  if (score >= 21) return "warn"
  return "bad"
}

const PLATFORM_LABEL: Record<Platform, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Google Gemini",
  claude: "Claude",
}

export { PLATFORM_LABEL }
