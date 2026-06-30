// ──────────────────────────────────────────
// GhostRank — Visibility Scorer
// ──────────────────────────────────────────
// Takes all parsed scan results and calculates a single
// visibility score (0-100) plus detailed breakdowns.
//
// The score answers one question:
// "How visible is this business when people ask AI for recommendations?"
//
// Score ranges:
// 0-20:  Ghost — basically invisible
// 21-40: Weak — occasional mentions, low positions
// 41-60: Moderate — showing up but not consistently
// 61-80: Strong — regularly mentioned, good positions
// 81-100: Dominant — top recommendation across platforms

import type { ParsedScanResult, Platform, VisibilityScore } from "../types"

/**
 * How much each factor contributes to the final score:
 *
 * Mention rate (40%): The most important factor.
 *   If you're not mentioned at all, nothing else matters.
 *   Mentioned in 10 out of 15 prompts = (10/15) × 40 = 26.7 points
 *
 * Position quality (30%): Being mentioned first vs eighth matters.
 *   Position 1 = full points. Position 5+ = almost none.
 *   Average across all mentions.
 *
 * Platform coverage (15%): Showing up on all 3 platforms is better
 *   than showing up on just 1. Rewards breadth.
 *
 * Sentiment bonus (15%): Positive mentions score higher.
 *   Getting recommended enthusiastically > just being listed.
 *
 * Why these weights?
 * Mention rate dominates because if AI doesn't mention you, you're
 * invisible — period. Position matters next because being #1 vs #8
 * is a huge difference in click-through. Platform coverage and
 * sentiment are secondary bonuses.
 */
const WEIGHTS = {
  mentionRate: 40,
  positionQuality: 30,
  platformCoverage: 15,
  sentimentBonus: 15,
}

/**
 * Calculates the mention rate score component.
 *
 * Simple ratio: mentions / total prompts × weight
 * 10 mentions out of 15 prompts = 0.667 × 40 = 26.7
 */
function calcMentionRate(results: ParsedScanResult[]): number {
  if (results.length === 0) return 0

  const mentioned = results.filter((r) => r.mentioned).length
  const rate = mentioned / results.length

  return rate * WEIGHTS.mentionRate
}

/**
 * Calculates the position quality score component.
 *
 * Position 1 = 1.0 (full score)
 * Position 2 = 0.8
 * Position 3 = 0.6
 * Position 4 = 0.4
 * Position 5+ = 0.2
 * Not in a list but mentioned = 0.3 (partial credit)
 *
 * Why does position matter so much?
 * When ChatGPT lists "top 5 dentists," most people only
 * look at #1 and #2. Being #5 is barely better than not
 * being mentioned at all.
 */
function calcPositionQuality(results: ParsedScanResult[]): number {
  const mentioned = results.filter((r) => r.mentioned)
  if (mentioned.length === 0) return 0

  const positionScores: Record<number, number> = {
    1: 1.0,
    2: 0.8,
    3: 0.6,
    4: 0.4,
  }

  let totalScore = 0

  for (const result of mentioned) {
    if (result.position === null) {
      // Mentioned but not in a numbered list — partial credit
      totalScore += 0.3
    } else {
      totalScore += positionScores[result.position] ?? 0.2
    }
  }

  const avgScore = totalScore / mentioned.length
  return avgScore * WEIGHTS.positionQuality
}

/**
 * Calculates the platform coverage score component.
 *
 * Visible on 3/3 platforms = full score
 * Visible on 2/3 = 66% of score
 * Visible on 1/3 = 33% of score
 *
 * Why does coverage matter?
 * Different people use different AI tools. A business visible
 * only on ChatGPT misses everyone using Perplexity or Gemini.
 */
function calcPlatformCoverage(results: ParsedScanResult[]): number {
  const platforms: Platform[] = ["chatgpt", "perplexity", "gemini"]

  let coveredCount = 0

  for (const platform of platforms) {
    const platformResults = results.filter((r) => r.platform === platform)
    const hasMention = platformResults.some((r) => r.mentioned)
    if (hasMention) coveredCount++
  }

  const coverage = coveredCount / platforms.length
  return coverage * WEIGHTS.platformCoverage
}

/**
 * Calculates the sentiment bonus score component.
 *
 * Positive mentions add points.
 * Neutral mentions add nothing extra.
 * Negative mentions subtract points.
 *
 * This rewards businesses that AI speaks positively about,
 * not just mentions.
 */
function calcSentimentBonus(results: ParsedScanResult[]): number {
  const mentioned = results.filter((r) => r.mentioned)
  if (mentioned.length === 0) return 0

  let sentimentScore = 0

  for (const result of mentioned) {
    switch (result.sentiment) {
      case "positive":
        sentimentScore += 1.0
        break
      case "neutral":
        sentimentScore += 0.5
        break
      case "negative":
        sentimentScore -= 0.5
        break
    }
  }

  // Normalize to 0-1 range
  const maxPossible = mentioned.length
  const normalized = Math.max(0, sentimentScore / maxPossible)

  return normalized * WEIGHTS.sentimentBonus
}

/**
 * Calculates the per-platform score breakdown.
 *
 * Same logic as the overall score, but filtered to one platform.
 * Useful for the report: "You score 72 on ChatGPT but only 15 on Gemini"
 */
function calcPlatformScores(
  results: ParsedScanResult[]
): Record<Platform, number> {
  const platforms: Platform[] = ["chatgpt", "perplexity", "gemini"]
  const scores = {} as Record<Platform, number>

  for (const platform of platforms) {
    const platformResults = results.filter((r) => r.platform === platform)

    if (platformResults.length === 0) {
      scores[platform] = 0
      continue
    }

    const mentioned = platformResults.filter((r) => r.mentioned).length
    const rate = mentioned / platformResults.length

    // Simplified per-platform score: mention rate × 100
    scores[platform] = Math.round(rate * 100)
  }

  return scores
}

/**
 * Calculates the average position across all mentions.
 * Lower is better (1 = always first).
 * Returns null if no positions were detected.
 */
function calcAveragePosition(results: ParsedScanResult[]): number | null {
  const withPosition = results.filter(
    (r) => r.mentioned && r.position !== null
  )

  if (withPosition.length === 0) return null

  const sum = withPosition.reduce((acc, r) => acc + (r.position ?? 0), 0)
  return Math.round((sum / withPosition.length) * 10) / 10
}

/**
 * Counts sentiment across all mentions.
 */
function calcSentimentBreakdown(
  results: ParsedScanResult[]
): { positive: number; neutral: number; negative: number } {
  const mentioned = results.filter((r) => r.mentioned)

  return {
    positive: mentioned.filter((r) => r.sentiment === "positive").length,
    neutral: mentioned.filter((r) => r.sentiment === "neutral").length,
    negative: mentioned.filter((r) => r.sentiment === "negative").length,
  }
}

// ──────────────────────────────────────────
// Main scorer (exported)
// ──────────────────────────────────────────

/**
 * THE MAIN FUNCTION — computes the full visibility score.
 *
 * Takes all parsed scan results and returns:
 * - overall: 0-100 score
 * - byPlatform: score per platform
 * - mentionCount: how many times mentioned
 * - totalPrompts: how many prompts were sent
 * - sentimentBreakdown: positive/neutral/negative counts
 * - averagePosition: mean list position (lower = better)
 *
 * The overall score is the sum of four weighted components:
 * mentionRate (40) + positionQuality (30) +
 * platformCoverage (15) + sentimentBonus (15) = 100 max
 */
export function computeScore(results: ParsedScanResult[]): VisibilityScore {
  const mentionRate = calcMentionRate(results)
  const positionQuality = calcPositionQuality(results)
  const platformCoverage = calcPlatformCoverage(results)
  const sentimentBonus = calcSentimentBonus(results)

  // Sum all components and round to nearest integer
  const overall = Math.round(
    mentionRate + positionQuality + platformCoverage + sentimentBonus
  )

  return {
    overall: Math.min(100, Math.max(0, overall)),
    byPlatform: calcPlatformScores(results),
    mentionCount: results.filter((r) => r.mentioned).length,
    totalPrompts: results.length,
    sentimentBreakdown: calcSentimentBreakdown(results),
    averagePosition: calcAveragePosition(results),
  }
}