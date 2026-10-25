// ──────────────────────────────────────────
// GhostRank — Scan flow v2
// ──────────────────────────────────────────
// Builds the question set for a client, runs it through the question runner
// and records the outcome on the Scan row. Never throws.

import { ScanStatus, type Client, type Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { buildQuestions, QUESTION_SET_VERSION } from "./questionBuilder"
import { runQuestions, type SaveRun } from "./runner"
import { createClaudeProvider } from "./providers/claude"
import { createPrismaSaveRun } from "./runStore"
import { scoreScan, type ScanRun as ScoredRun } from "./scorer"
import { aggregateNamedBusinesses } from "./namedBusinesses"
import type { AIProvider } from "./providers/types"

export interface ScanUpdate {
  status: ScanStatus
  errorMsg?: string
  score?: number
  rawResults?: Prisma.InputJsonObject
}

export interface RunScanV2Deps {
  provider?: AIProvider
  saveRun?: SaveRun
  loadClient?: (clientId: string) => Promise<Client | null>
  updateScan?: (scanId: string, data: ScanUpdate) => Promise<void>
  loadRuns?: (scanId: string) => Promise<ScoredRun[]>
}

const TOP_OTHERS = 10
const GENERIC_ERROR = "Scan failed unexpectedly"
const NO_RESULTS_ERROR = "Scan did not complete, no results were recorded"

const defaultLoadClient = (clientId: string) =>
  prisma.client.findUnique({ where: { id: clientId } })

const defaultLoadRuns = (scanId: string) =>
  prisma.scanRun.findMany({
    where: { scanId },
    select: { questionId: true, group: true, scored: true, status: true, answer: true },
  })

const defaultUpdateScan = async (scanId: string, data: ScanUpdate): Promise<void> => {
  await prisma.scan.update({ where: { id: scanId }, data })
}

export async function runScanV2(
  scanId: string,
  clientId: string,
  deps: RunScanV2Deps = {}
): Promise<void> {
  const loadClient = deps.loadClient ?? defaultLoadClient
  const updateScan = deps.updateScan ?? defaultUpdateScan
  const loadRuns = deps.loadRuns ?? defaultLoadRuns

  try {
    const client = await loadClient(clientId)
    if (!client) throw new Error(`Client not found: ${clientId}`)

    const questions = buildQuestions({
      businessName: client.businessName,
      niche: client.niche,
      city: client.city,
      location: client.location,
      nameVariants: client.nameVariants,
      knownFor: client.knownFor,
      competitors: client.competitors,
    })

    await updateScan(scanId, { status: ScanStatus.RUNNING })

    const summary = await runQuestions({
      scanId,
      questions,
      provider: deps.provider ?? createClaudeProvider(),
      saveRun: deps.saveRun ?? createPrismaSaveRun(),
    })

    const ok = summary.succeeded >= 1 && summary.saveFailed === 0
    const base = { ...summary, questionSetVersion: QUESTION_SET_VERSION }

    let score: number | null = null
    let rawResults: Prisma.InputJsonObject = base
    try {
      const runs = await loadRuns(scanId)
      const businessNames = [client.businessName, ...client.nameVariants]
      const scoring = scoreScan({ runs, businessNames })
      const named = aggregateNamedBusinesses({
        runs,
        businessNames,
        competitorNames: client.competitors,
      })
      score = scoring.score
      rawResults = {
        ...base,
        scoring: {
          countedRuns: scoring.countedRuns,
          expectedRuns: scoring.expectedRuns,
          lowConfidence: scoring.lowConfidence,
          byGroup: scoring.byGroup,
          perQuestion: scoring.perQuestion,
          averagePosition: scoring.averagePosition,
          reputation: scoring.reputation,
        } as unknown as Prisma.InputJsonObject,
        named: {
          others: named.others.slice(0, TOP_OTHERS),
          chosenCompetitors: named.chosenCompetitors,
        } as unknown as Prisma.InputJsonObject,
      }
    } catch (scoringError) {
      console.error(`Scan ${scanId} (v2) scoring failed:`, scoringError)
    }

    await updateScan(scanId, {
      status: ok ? ScanStatus.COMPLETED : ScanStatus.FAILED,
      ...(ok ? {} : { errorMsg: NO_RESULTS_ERROR }),
      ...(score === null ? {} : { score }),
      rawResults,
    })
  } catch (error) {
    // Real error stays in the server log; the database gets a generic message
    console.error(`Scan ${scanId} (v2) failed:`, error)
    try {
      await updateScan(scanId, { status: ScanStatus.FAILED, errorMsg: GENERIC_ERROR })
    } catch (updateError) {
      console.error(`Could not mark scan ${scanId} as failed:`, updateError)
    }
  }
}
