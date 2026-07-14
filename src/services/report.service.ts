// ──────────────────────────────────────────
// GhostRank — Report Service
// ──────────────────────────────────────────
// Generates and manages reports from completed scans.
// A report is the deliverable — what the agency sends
// to their client saying "here's your AI visibility."
//
// For MVP: we generate a JSON-structured report that
// can be rendered as a web page or PDF later.
// PDF generation will come in v2.

import { prisma } from "../lib/prisma"
import type { VisibilityScore, Platform } from "../types"

/**
 * The report structure that gets sent to the client.
 * This is what the agency's client actually sees.
 */
export interface ReportData {
  /** Report metadata */
  id: string
  generatedAt: string
  /** Business info */
  business: {
    name: string
    niche: string
    location: string
  }
  /** The headline number */
  score: number
  scoreLabel: string
  /** Per-platform breakdown */
  platforms: {
    platform: Platform
    score: number
    mentioned: number
    total: number
  }[]
  /** Which prompts found the business, which didn't */
  results: {
    prompt: string
    platform: string
    category: string
    mentioned: boolean
    position: number | null
    sentiment: string | null
  }[]
  /** Actionable recommendations based on the score */
  recommendations: string[]
}

/**
 * Converts a numeric score to a human-readable label.
 *
 * Why labels?
 * A client doesn't know if 35 is good or bad.
 * "Weak — your business is barely visible" is immediately clear.
 */
function getScoreLabel(score: number): string {
  if (score >= 81) return "Dominant — you're a top AI recommendation"
  if (score >= 61) return "Strong — regularly mentioned across platforms"
  if (score >= 41) return "Moderate — showing up but inconsistently"
  if (score >= 21) return "Weak — occasional mentions, needs work"
  return "Ghost — virtually invisible in AI search"
}

/**
 * Generates actionable recommendations based on scan results.
 *
 * These aren't generic tips — they're based on what the
 * scan actually found. If the business is missing from
 * one platform but visible on another, we say that specifically.
 */
function generateRecommendations(
  score: number,
  platformScores: Record<Platform, number>,
  mentionCount: number,
  totalPrompts: number
): string[] {
  const recommendations: string[] = []

  // Overall visibility
  if (score < 20) {
    recommendations.push(
      "Your business is virtually invisible in AI search. " +
      "Focus on building online authority through business directory listings, " +
      "Google Business Profile optimization, and consistent NAP (Name, Address, Phone) data."
    )
  }

  // Platform-specific gaps
  const platforms: Platform[] = ["chatgpt", "perplexity", "gemini"]
  for (const platform of platforms) {
    if (platformScores[platform] === 0) {
      const platformName =
        platform === "chatgpt" ? "ChatGPT" :
        platform === "perplexity" ? "Perplexity" :
        "Google Gemini"
      recommendations.push(
        `You have zero visibility on ${platformName}. ` +
        `This means anyone using ${platformName} to find a business like yours ` +
        `will never see your name.`
      )
    }
  }

  // Mention rate
  if (mentionCount > 0 && mentionCount < totalPrompts * 0.5) {
    recommendations.push(
      "You're mentioned in some searches but not consistently. " +
      "Adding structured data (schema markup) to your website " +
      "and getting listed on more industry directories can improve consistency."
    )
  }

  // Content recommendations
  if (score < 60) {
    recommendations.push(
      "Create content that directly answers questions your customers ask. " +
      "AI models pull from helpful, question-answering content. " +
      "Blog posts like 'How to choose a " + "provider in your area' " +
      "help AI models associate your business with relevant queries."
    )
  }

  // Positive signals
  if (score >= 40) {
    recommendations.push(
      "You have a foundation to build on. Focus on earning positive " +
      "reviews and mentions on authoritative sites to strengthen " +
      "your AI visibility further."
    )
  }

  return recommendations
}

/**
 * Generates a full report from a completed scan.
 *
 * Flow:
 * 1. Fetch the scan with all results and client info
 * 2. Build the report data structure
 * 3. Save the report record to the database
 * 4. Return the structured report
 */
export async function generateReport(scanId: string): Promise<ReportData> {
  // Fetch scan with results and client
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      scanResults: true,
      client: true,
    },
  })

  if (!scan) throw new Error(`Scan not found: ${scanId}`)
  if (scan.status !== "COMPLETED") {
    throw new Error(`Scan is not completed. Current status: ${scan.status}`)
  }

  // Parse the raw results (visibility score)
  const rawScore = scan.rawResults as unknown as VisibilityScore
  const score = scan.score ?? 0

  // Build platform breakdown
  const platforms: Platform[] = ["chatgpt", "perplexity", "gemini"]
  const platformBreakdown = platforms.map((platform) => {
    const platformResults = scan.scanResults.filter(
      (r) => r.platform === platform
    )
    return {
      platform,
      score: rawScore?.byPlatform?.[platform] ?? 0,
      mentioned: platformResults.filter((r) => r.mentioned).length,
      total: platformResults.length,
    }
  })

  // Build results list
  const results = scan.scanResults.map((r) => ({
    prompt: r.prompt,
    platform: r.platform,
    category: r.category,
    mentioned: r.mentioned,
    position: r.position,
    sentiment: r.sentiment,
  }))

  // Generate recommendations
  const recommendations = generateRecommendations(
    score,
    rawScore?.byPlatform ?? { chatgpt: 0, perplexity: 0, gemini: 0 },
    rawScore?.mentionCount ?? 0,
    rawScore?.totalPrompts ?? 0
  )

  // Save report record to database
  const report = await prisma.report.create({
    data: {
      scanId,
      clientId: scan.clientId,
    },
  })

  // Build the final report
  const reportData: ReportData = {
    id: report.id,
    generatedAt: new Date().toISOString(),
    business: {
      name: scan.client.businessName,
      niche: scan.client.niche,
      location: scan.client.location,
    },
    score,
    scoreLabel: getScoreLabel(score),
    platforms: platformBreakdown,
    results,
    recommendations,
  }

  return reportData
}

/**
 * Gets an existing report by ID.
 */
export async function getReportById(reportId: string) {
  return prisma.report.findUnique({
    where: { id: reportId },
    include: {
      scan: {
        include: {
          scanResults: true,
          client: true,
        },
      },
    },
  })
}

/**
 * Gets all reports for a client.
 */
export async function getReportsByClient(clientId: string) {
  return prisma.report.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: {
      scan: {
        select: {
          score: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })
}