// ──────────────────────────────────────────
// GhostRank — Report builder for v2 scans
// ──────────────────────────────────────────
// Pure: takes an already loaded scan, client and ScanRun rows and returns the
// report. No database access. Scoring and named businesses are always computed
// from the runs and the client's current names; Scan.rawResults is a snapshot
// that goes stale when a client is edited or the matcher changes, so it is ignored.

import { scoreScan, type Tally } from "../scanner/scorer"
import { aggregateNamedBusinesses } from "../scanner/namedBusinesses"

const WILSON_Z = 1.96
const TOP_OTHERS = 10
const MAX_REPUTATION_ANSWERS = 3
const REPUTATION_ANSWER_CHARS = 400
const GROUPS = ["find", "compare", "need"] as const

// Cuts at a word boundary so a shown answer never ends mid-word.
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const window = text.slice(0, max + 1)
  let cut = -1
  for (let i = window.length - 1; i > 0; i--) {
    if (/\s/.test(window[i])) {
      cut = i
      break
    }
  }
  const head = cut > 0 ? window.slice(0, cut) : text.slice(0, max)
  return head.replace(/[\s.,;:!?\-–—]+$/, "") + "…"
}

export type ScoreLabelV2 = "Strong" | "Mixed" | "Rarely named" | "Not named"

export interface ReportDataV2 {
  version: 2
  id: string
  generatedAt: string
  business: { name: string; niche: string; location: string; city: string | null }
  scanDate: string
  score: number
  scoreLabel: ScoreLabelV2
  scoreRange: { low: number; high: number }
  basedOnRuns: number
  lowConfidence: boolean
  averagePosition: number | null
  byGroup: { group: (typeof GROUPS)[number]; mentioned: number; counted: number; percent: number }[]
  questions: { questionId: string; group: string; text: string; mentioned: number; counted: number }[]
  reputationQuestion: { questionId: string; text: string; mentioned: number; counted: number } | null
  named: {
    others: { name: string; runs: number; percent: number }[]
    chosenCompetitors: { name: string; runs: number; percent: number }[]
  }
  reputation: { answers: string[] }
  model: { provider: string; model: string }
}

export interface ReportV2Run {
  questionId: string
  group: string
  questionText: string
  scored: boolean
  status: string
  answer: string | null
  provider: string
  model: string
}

export interface ReportV2Input {
  /** Report row id and creation time — the report's own identity */
  reportId: string
  generatedAt: Date
  scan: { createdAt: Date }
  client: {
    businessName: string
    niche: string
    location: string
    city: string | null
    nameVariants: string[]
    competitors: string[]
  }
  runs: ReportV2Run[]
}

export function scoreLabelFor(score: number): ScoreLabelV2 {
  if (score >= 70) return "Strong"
  if (score >= 40) return "Mixed"
  if (score >= 1) return "Rarely named"
  return "Not named"
}

/** 95% Wilson interval for mentioned/counted, in whole percent, within 0-100. */
export function wilsonRange(mentioned: number, counted: number): { low: number; high: number } {
  if (counted <= 0) return { low: 0, high: 0 }
  const n = counted
  const p = mentioned / n
  const z2 = WILSON_Z * WILSON_Z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const half = (WILSON_Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 100)))
  return { low: clamp(centre - half), high: clamp(centre + half) }
}

const percentOf = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0

export function buildReportV2({ reportId, generatedAt, scan, client, runs }: ReportV2Input): ReportDataV2 {
  const businessNames = [client.businessName, ...client.nameVariants]

  const scoring = scoreScan({ runs, businessNames })
  const named = aggregateNamedBusinesses({ runs, businessNames, competitorNames: client.competitors })

  const counted = scoring.countedRuns
  const mentioned = scoring.perQuestion.reduce((sum, q) => sum + q.mentioned, 0)
  const score = scoring.score ?? 0

  const textOf = new Map<string, string>()
  for (const run of runs) {
    if (!textOf.has(run.questionId)) textOf.set(run.questionId, run.questionText)
  }
  const groupOf = new Map<string, string>()
  for (const run of runs) {
    if (run.scored && !groupOf.has(run.questionId)) groupOf.set(run.questionId, run.group)
  }

  const reputationRun = runs.find((r) => !r.scored)
  const reputationTally: Tally = scoring.reputation

  const answers = runs
    .filter((r) => !r.scored && r.status === "SUCCESS" && r.answer && r.answer.trim() !== "")
    .slice(0, MAX_REPUTATION_ANSWERS)
    .map((r) => cutAtWord((r.answer as string).trim(), REPUTATION_ANSWER_CHARS))

  const modelRun = runs.find((r) => r.status === "SUCCESS") ?? runs[0]
  const withPercent = (item: { name: string; runs: number }) => ({
    name: item.name,
    runs: item.runs,
    percent: percentOf(item.runs, counted),
  })

  return {
    version: 2,
    id: reportId,
    generatedAt: generatedAt.toISOString(),
    business: {
      name: client.businessName,
      niche: client.niche,
      location: client.location,
      city: client.city,
    },
    scanDate: scan.createdAt.toISOString(),
    score,
    scoreLabel: scoreLabelFor(score),
    scoreRange: wilsonRange(mentioned, counted),
    basedOnRuns: counted,
    lowConfidence: scoring.lowConfidence,
    averagePosition:
      scoring.averagePosition === null || scoring.averagePosition === undefined
        ? null
        : Math.round(scoring.averagePosition * 10) / 10,
    byGroup: GROUPS.map((group) => {
      const t = scoring.byGroup[group] ?? { mentioned: 0, counted: 0 }
      return { group, mentioned: t.mentioned, counted: t.counted, percent: percentOf(t.mentioned, t.counted) }
    }),
    questions: scoring.perQuestion.map((q) => ({
      questionId: q.questionId,
      group: groupOf.get(q.questionId) ?? "",
      text: textOf.get(q.questionId) ?? "",
      mentioned: q.mentioned,
      counted: q.counted,
    })),
    reputationQuestion: reputationRun
      ? {
          questionId: reputationRun.questionId,
          text: reputationRun.questionText,
          mentioned: reputationTally.mentioned,
          counted: reputationTally.counted,
        }
      : null,
    named: {
      others: named.others.slice(0, TOP_OTHERS).map(withPercent),
      chosenCompetitors: named.chosenCompetitors.map(withPercent),
    },
    reputation: { answers },
    model: { provider: modelRun?.provider ?? "", model: modelRun?.model ?? "" },
  }
}
