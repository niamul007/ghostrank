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

import type { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { ACTIVE_PLATFORMS } from "../config/ai.config"
import type { VisibilityScore, Platform } from "../types"
import type { ParsedScanResult } from "../types"
import { WEIGHTS, computeScoreParts } from "../scorer"
import { AppError } from "../utils/AppError"
import {
  classifyIssue,
  buildScoreBreakdown,
  countByPromptType,
  findCompetitors,
  getFix,
  makeExcerpt,
  rankTopFixes,
  topCompetitors,
  type PromptTypeStats,
  type ResultIssue,
  type ScoreBreakdown,
} from "./reportDetail"
import { buildReportV2, type ReportDataV2 } from "./reportV2"

/** What the report endpoints return: discriminated on `version`. */
export type Report = ReportData | ReportDataV2

/**
 * The report structure that gets sent to the client.
 * This is what the agency's client actually sees.
 */
export interface ReportData {
  /** Old reports are version 1; v2 reports come from buildReportV2 */
  version: 1
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
    /** Saved response text, trimmed and cut to 600 characters */
    answerExcerpt: string
    /** Up to 5 other business names found in the response */
    competitors: string[]
    issue: ResultIssue
    /** Suggested fix by (category, issue); null when issue is "ok" */
    fix: string | null
  }[]
  /** Actionable recommendations based on the score */
  recommendations: string[]
  /** Score parts in whole points; the four "earned" values add up to `score` */
  breakdown: ScoreBreakdown
  /** Prompts sent and prompts that mentioned the business, per prompt type */
  byPromptType: PromptTypeStats
  /** Top 5 competitor names across all prompts, most mentioned first */
  competitors: { name: string; mentions: number }[]
  /**
   * Up to 3 recommendations, ranked by how many prompts missed the business
   * that each one addresses (most first; ties keep recommendation order)
   */
  topFixes: { recommendation: string; missedPrompts: number }[]
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
  totalPrompts: number,
  results: { platform: string; mentioned: boolean }[] = []
): { text: string; missedPrompts: number }[] {
  const recommendations: { text: string; missedPrompts: number }[] = []
  // Prompts that missed the business, overall and per platform (from saved results)
  const missedTotal = results.filter((r) => !r.mentioned).length
  const missedOn = (platform: Platform) =>
    results.filter((r) => r.platform === platform && !r.mentioned).length

  // Overall visibility
  if (score < 20) {
    recommendations.push({
      text:
      "Your business is virtually invisible in AI search. " +
      "Focus on building online authority through business directory listings, " +
      "Google Business Profile optimization, and consistent NAP (Name, Address, Phone) data.",
      missedPrompts: missedTotal,
    })
  }

  // Platform-specific gaps
  // ChatGPT/Perplexity/Gemini are paused for now (see aiQuerier.ts) —
  // ACTIVE_PLATFORMS in ai.config.ts lists what is currently scanned.
  const platforms = ACTIVE_PLATFORMS
  for (const platform of platforms) {
    if (platformScores[platform] === 0) {
      const platformName =
        platform === "chatgpt" ? "ChatGPT" :
        platform === "perplexity" ? "Perplexity" :
        platform === "gemini" ? "Google Gemini" :
        "Claude"
      recommendations.push({
        text:
        `You have zero visibility on ${platformName}. ` +
        `This means anyone using ${platformName} to find a business like yours ` +
        `will never see your name.`,
        missedPrompts: missedOn(platform),
      })
    }
  }

  // Mention rate
  if (mentionCount > 0 && mentionCount < totalPrompts * 0.5) {
    recommendations.push({
      text:
      "You're mentioned in some searches but not consistently. " +
      "Adding structured data (schema markup) to your website " +
      "and getting listed on more industry directories can improve consistency.",
      missedPrompts: missedTotal,
    })
  }

  // Content recommendations
  if (score < 60) {
    recommendations.push({
      text:
      "Create content that directly answers questions your customers ask. " +
      "AI models pull from helpful, question-answering content. " +
      "Blog posts like 'How to choose a " + "provider in your area' " +
      "help AI models associate your business with relevant queries.",
      missedPrompts: missedTotal,
    })
  }

  // Positive signals
  if (score >= 40) {
    recommendations.push({
      text:
      "You have a foundation to build on. Focus on earning positive " +
      "reviews and mentions on authoritative sites to strengthen " +
      "your AI visibility further.",
      // A general next step, not tied to any missed prompts
      missedPrompts: 0,
    })
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
export async function generateReport(
  scanId: string,
  agencyId: string
): Promise<Report> {
  // Fetch scan with results, v2 runs and client, scoped to this agency
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, client: { agencyId } },
    include: {
      scanResults: true,
      runs: RUNS_ORDER,
      client: true,
    },
  })

  if (!scan) throw new AppError("Scan not found", 404)
  if (scan.status !== "COMPLETED") {
    throw new AppError("Scan did not complete, so no report can be generated", 409)
  }

  // Idempotent: reuse the existing report for this scan if there is one
  const existing = await prisma.report.findFirst({
    where: { scanId, client: { agencyId } },
  })
  if (existing) {
    return buildReportForScan(scan, existing.id, existing.createdAt)
  }

  // Save report record to database
  const report = await prisma.report.create({
    data: {
      scanId,
      clientId: scan.clientId,
    },
  })

  return buildReportForScan(scan, report.id, report.createdAt)
}

const RUNS_ORDER = { orderBy: [{ questionId: "asc" }, { runNumber: "asc" }] } satisfies Prisma.Scan$runsArgs

/** A scan loaded with its results, v2 runs and client. */
type LoadedScan = Prisma.ScanGetPayload<{
  include: { scanResults: true; runs: true; client: true }
}>

/**
 * Picks the builder for a loaded scan: scans with ScanRun rows are v2,
 * everything else takes the old path unchanged.
 */
function buildReportForScan(scan: LoadedScan, reportId: string, createdAt: Date): Report {
  if (scan.runs.length > 0) {
    return buildReportV2({
      reportId,
      generatedAt: createdAt,
      scan,
      client: scan.client,
      runs: scan.runs.map((r) => ({
        questionId: r.questionId,
        group: r.group,
        questionText: r.questionText,
        scored: r.scored,
        status: r.status,
        answer: r.answer,
        provider: r.provider,
        model: r.model,
      })),
    })
  }
  return buildReportData(scan, reportId, createdAt)
}

/** A scan loaded with its results and client, as needed to build an old report. */
type ScanWithResults = Prisma.ScanGetPayload<{
  include: { scanResults: true; client: true }
}>

/**
 * Builds the ReportData structure from an already loaded scan.
 * Shared by generateReport and getReportById so both return the same shape.
 */
export function buildReportData(
  scan: ScanWithResults,
  reportId: string,
  createdAt: Date
): ReportData {
  // Parse the raw results (visibility score)
  const rawScore = scan.rawResults as unknown as VisibilityScore
  const score = scan.score ?? 0

  // Build platform breakdown
  // ChatGPT/Perplexity/Gemini are paused for now (see aiQuerier.ts) —
  // ACTIVE_PLATFORMS in ai.config.ts lists what is currently scanned.
  const platforms = ACTIVE_PLATFORMS
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
  const results = scan.scanResults.map((r) => {
    const issue = classifyIssue(r)
    return {
      prompt: r.prompt,
      platform: r.platform,
      category: r.category,
      mentioned: r.mentioned,
      position: r.position,
      sentiment: r.sentiment,
      answerExcerpt: makeExcerpt(r.response),
      competitors: findCompetitors(r.response, scan.client.businessName),
      issue,
      fix: getFix(r.category, issue),
    }
  })

  // Generate recommendations
  const recommendationItems = generateRecommendations(
    score,
    rawScore?.byPlatform ?? { chatgpt: 0, perplexity: 0, gemini: 0, claude: 0 },
    rawScore?.mentionCount ?? 0,
    rawScore?.totalPrompts ?? 0,
    scan.scanResults
  )
  const recommendations = recommendationItems.map((r) => r.text)

  // Build the final report
  const reportData: ReportData = {
    version: 1,
    id: reportId,
    generatedAt: createdAt.toISOString(),
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
    breakdown: buildScoreBreakdown(
      computeScoreParts(scan.scanResults as unknown as ParsedScanResult[]),
      WEIGHTS
    ),
    byPromptType: countByPromptType(scan.scanResults),
    competitors: topCompetitors(results.map((r) => r.competitors)),
    topFixes: rankTopFixes(
      recommendationItems.map((r) => ({
        recommendation: r.text,
        missedPrompts: r.missedPrompts,
      }))
    ),
  }

  return reportData
}

/**
 * Gets an existing report by ID, in the same shape generateReport returns.
 * Returns null if the report doesn't exist or belongs to another agency.
 */
export async function getReportById(
  reportId: string,
  agencyId: string
): Promise<Report | null> {
  const report = await prisma.report.findFirst({
    where: { id: reportId, client: { agencyId } },
    include: {
      scan: {
        include: {
          scanResults: true,
          runs: RUNS_ORDER,
          client: true,
        },
      },
    },
  })
  if (!report) return null

  // v2 reports are rebuilt on every read; the JSON is not stored
  return buildReportForScan(report.scan, report.id, report.createdAt)
}

/**
 * Gets all reports for a client.
 */
export async function getReportsByClient(clientId: string, agencyId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId },
  })

  if (!client) {
    throw new AppError("Client not found", 404)
  }

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