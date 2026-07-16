// ──────────────────────────────────────────
// Report presentation helpers
// ──────────────────────────────────────────
// GET /api/reports/:id only returns the raw persisted Report row — the
// backend computes scoreLabel + recommendations at generation time
// (src/services/report.service.ts) but never saves them. So a report
// revisited later (page refresh, coming from the list) arrives without
// them, while a freshly-created one has them from the API directly.
//
// getScoreLabel/buildRecommendations below are a deliberate port of that
// same backend logic, used ONLY to reconstruct an equivalent view from
// the raw Scan data when we don't have the richer ReportData already —
// this is frontend display logic, not a backend change.

import type { Platform, ReportData, ReportRecord, VisibilityScore } from "../types"

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

function buildRecommendations(
  score: number,
  platformScores: Record<Platform, number>,
  mentionCount: number,
  totalPrompts: number
): string[] {
  const recommendations: string[] = []

  if (score < 20) {
    recommendations.push(
      "Your business is virtually invisible in AI search. " +
        "Focus on building online authority through business directory listings, " +
        "Google Business Profile optimization, and consistent NAP (Name, Address, Phone) data."
    )
  }

  const platforms: Platform[] = ["claude"]
  for (const platform of platforms) {
    if (platformScores[platform] === 0) {
      recommendations.push(
        `You have zero visibility on ${PLATFORM_LABEL[platform]}. ` +
          `This means anyone using ${PLATFORM_LABEL[platform]} to find a business like yours ` +
          `will never see your name.`
      )
    }
  }

  if (mentionCount > 0 && mentionCount < totalPrompts * 0.5) {
    recommendations.push(
      "You're mentioned in some searches but not consistently. " +
        "Adding structured data (schema markup) to your website " +
        "and getting listed on more industry directories can improve consistency."
    )
  }

  if (score < 60) {
    recommendations.push(
      "Create content that directly answers questions your customers ask. " +
        "AI models pull from helpful, question-answering content. " +
        "Blog posts like 'How to choose a provider in your area' " +
        "help AI models associate your business with relevant queries."
    )
  }

  if (score >= 40) {
    recommendations.push(
      "You have a foundation to build on. Focus on earning positive " +
        "reviews and mentions on authoritative sites to strengthen " +
        "your AI visibility further."
    )
  }

  return recommendations
}

/** Normalizes either report shape into ReportData-like fields for display. */
export function toReportView(record: ReportRecord): ReportData {
  const { scan } = record
  const rawScore = scan.rawResults as VisibilityScore | null
  const score = scan.score ?? 0
  const platforms: Platform[] = ["claude"]

  const platformBreakdown = platforms.map((platform) => {
    const platformResults = scan.scanResults.filter((r) => r.platform === platform)
    return {
      platform,
      score: rawScore?.byPlatform?.[platform] ?? 0,
      mentioned: platformResults.filter((r) => r.mentioned).length,
      total: platformResults.length,
    }
  })

  return {
    id: record.id,
    generatedAt: record.createdAt,
    business: {
      name: scan.client.businessName,
      niche: scan.client.niche,
      location: scan.client.location,
    },
    score,
    scoreLabel: getScoreLabel(score),
    platforms: platformBreakdown,
    results: scan.scanResults.map((r) => ({
      prompt: r.prompt,
      platform: r.platform,
      category: r.category,
      mentioned: r.mentioned,
      position: r.position,
      sentiment: r.sentiment,
    })),
    recommendations: buildRecommendations(
      score,
      rawScore?.byPlatform ?? { chatgpt: 0, perplexity: 0, gemini: 0, claude: 0 },
      rawScore?.mentionCount ?? 0,
      rawScore?.totalPrompts ?? 0
    ),
  }
}
