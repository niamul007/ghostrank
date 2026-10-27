// ──────────────────────────────────────────
// GhostRank — Question runner
// ──────────────────────────────────────────
// Asks every question several times, a few at once, and saves each run as
// soon as it finishes.

import type { Question, QuestionGroup } from "./questionBuilder"
import { withRetry } from "./providers/retry"
import { ProviderError, type AIProvider } from "./providers/types"

export const DEFAULT_CONCURRENCY = 6
export const DEFAULT_RUNS_PER_QUESTION = 3

export interface RunRow {
  scanId: string
  questionId: string
  group: QuestionGroup
  questionText: string
  scored: boolean
  runNumber: number
  provider: string
  model: string
  status: "SUCCESS" | "FAILED"
  answer: string
  errorLabel: string | null
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
  sources?: { title: string; url: string }[] | null
}

export type SaveRun = (row: RunRow) => Promise<void>

export interface RunQuestionsOptions {
  scanId: string
  questions: Question[]
  provider: AIProvider
  runsPerQuestion?: number
  concurrency?: number
  saveRun: SaveRun
}

export interface RunSummary {
  total: number
  succeeded: number
  failed: number
  saveFailed: number
}

interface Job {
  question: Question
  runNumber: number
}

/** Runs `worker` over `items`, never more than `limit` at once. */
async function runLimited<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let next = 0
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next++]
      await worker(item)
    }
  }
  const lanes = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: lanes }, lane))
}

export async function runQuestions(options: RunQuestionsOptions): Promise<RunSummary> {
  const {
    scanId,
    questions,
    provider,
    runsPerQuestion = DEFAULT_RUNS_PER_QUESTION,
    concurrency = DEFAULT_CONCURRENCY,
    saveRun,
  } = options

  const jobs: Job[] = []
  for (const question of questions) {
    for (let runNumber = 1; runNumber <= runsPerQuestion; runNumber++) {
      jobs.push({ question, runNumber })
    }
  }

  let succeeded = 0
  let failed = 0
  let saveFailed = 0

  await runLimited(jobs, concurrency, async ({ question, runNumber }) => {
    const base = {
      scanId,
      questionId: question.id,
      group: question.group,
      questionText: question.text,
      scored: question.scored,
      runNumber,
      provider: provider.name,
      model: provider.model,
    }
    const startTime = Date.now()

    let row: RunRow
    try {
      const result = await withRetry(() => provider.ask(question.text))
      row = {
        ...base,
        status: "SUCCESS",
        answer: result.text,
        errorLabel: null,
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        durationMs: result.durationMs,
        sources: result.sources ?? [],
      }
      succeeded++
    } catch (error) {
      row = {
        ...base,
        status: "FAILED",
        answer: "",
        errorLabel: error instanceof ProviderError ? error.message : "Unknown error",
        inputTokens: null,
        outputTokens: null,
        durationMs: Date.now() - startTime,
        sources: null,
      }
      failed++
    }

    try {
      await saveRun(row)
    } catch (error) {
      // A storage failure must not stop the other jobs
      saveFailed++
      console.error(`Could not save run ${question.id}#${runNumber}:`, error)
    }
  })

  return { total: jobs.length, succeeded, failed, saveFailed }
}
