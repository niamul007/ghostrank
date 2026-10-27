import { describe, it, expect, vi } from "vitest"
import { runQuestions, type RunRow } from "../src/scanner/runner"
import { buildQuestions } from "../src/scanner/questionBuilder"
import { ProviderError, type AIProvider } from "../src/scanner/providers/types"

const questions = buildQuestions({
  businessName: "Acme Plumbing",
  city: "Leeds",
  niche: "plumber",
})

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function fakeProvider(
  ask: (text: string) => Promise<string> = async (text) => `answer: ${text}`
): AIProvider {
  return {
    name: "fake",
    model: "fake-1",
    async ask(text) {
      return { text: await ask(text), inputTokens: 3, outputTokens: 4, durationMs: 5 }
    },
  }
}

function fakeSave() {
  const rows: RunRow[] = []
  return {
    rows,
    saveRun: async (row: RunRow) => {
      rows.push(row)
    },
  }
}

describe("runQuestions", () => {
  it("saves 24 rows for 8 questions", async () => {
    const { rows, saveRun } = fakeSave()
    const summary = await runQuestions({ scanId: "s1", questions, provider: fakeProvider(), saveRun })
    expect(questions).toHaveLength(8)
    expect(rows).toHaveLength(24)
    expect(summary).toEqual({ total: 24, succeeded: 24, failed: 0, saveFailed: 0 })
  })

  it("never runs more jobs at once than the limit", async () => {
    let inFlight = 0
    let peak = 0
    const provider = fakeProvider(async (text) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await delay(5)
      inFlight--
      return text
    })
    const { saveRun } = fakeSave()
    await runQuestions({ scanId: "s1", questions, provider, concurrency: 4, saveRun })
    expect(peak).toBe(4)
  })

  it("saves a failing job as FAILED and finishes the rest", async () => {
    const provider = fakeProvider(async (text) => {
      if (text === questions[0].text) throw new ProviderError("Bad key", false)
      return `answer: ${text}`
    })
    const { rows, saveRun } = fakeSave()
    const summary = await runQuestions({ scanId: "s1", questions, provider, saveRun })

    const failedRows = rows.filter((r) => r.status === "FAILED")
    expect(failedRows).toHaveLength(3)
    for (const row of failedRows) {
      expect(row.questionId).toBe(questions[0].id)
      expect(row.answer).toBe("")
      expect(row.errorLabel).toBe("Bad key")
    }
    expect(rows.filter((r) => r.status === "SUCCESS")).toHaveLength(21)
    expect(summary).toEqual({ total: 24, succeeded: 21, failed: 3, saveFailed: 0 })
  })

  it("keeps going when saving one row throws, and counts it in saveFailed", async () => {
    const { rows, saveRun } = fakeSave()
    const target = { questionId: questions[0].id, runNumber: 2 }
    const failingSave = async (row: RunRow) => {
      if (row.questionId === target.questionId && row.runNumber === target.runNumber) {
        throw new Error("db down")
      }
      await saveRun(row)
    }
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const summary = await runQuestions({
      scanId: "s1",
      questions,
      provider: fakeProvider(),
      saveRun: failingSave,
    })

    expect(rows).toHaveLength(23)
    expect(summary).toEqual({ total: 24, succeeded: 24, failed: 0, saveFailed: 1 })
    expect(errorSpy).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })

  it("puts provider, model, questionId and runNumber 1 to 3 on every row", async () => {
    const { rows, saveRun } = fakeSave()
    await runQuestions({ scanId: "scan-9", questions, provider: fakeProvider(), saveRun })

    for (const row of rows) {
      expect(row.scanId).toBe("scan-9")
      expect(row.provider).toBe("fake")
      expect(row.model).toBe("fake-1")
      expect(row.errorLabel).toBeNull()
    }
    for (const question of questions) {
      const runs = rows.filter((r) => r.questionId === question.id).map((r) => r.runNumber)
      expect(runs.sort((a, b) => a - b)).toEqual([1, 2, 3])
    }
  })

  it("saves the provider's sources on a successful run", async () => {
    const sources = [{ title: "Acme", url: "https://acme.example" }]
    const provider: AIProvider = {
      name: "fake",
      model: "fake-1",
      async ask() {
        return { text: "ok", durationMs: 1, sources }
      },
    }
    const { rows, saveRun } = fakeSave()
    await runQuestions({ scanId: "s1", questions: questions.slice(0, 1), provider, saveRun })
    expect(rows).toHaveLength(3)
    for (const row of rows) expect(row.sources).toEqual(sources)
  })

  it("saves sources as [] when the provider returns none", async () => {
    const { rows, saveRun } = fakeSave()
    await runQuestions({ scanId: "s1", questions: questions.slice(0, 1), provider: fakeProvider(), saveRun })
    for (const row of rows) expect(row.sources).toEqual([])
  })

  it("saves sources as null on a failed run", async () => {
    const provider = fakeProvider(async () => {
      throw new ProviderError("Bad key", false)
    })
    const { rows, saveRun } = fakeSave()
    await runQuestions({ scanId: "s1", questions: questions.slice(0, 1), provider, saveRun })
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.status).toBe("FAILED")
      expect(row.sources).toBeNull()
    }
  })

  it("keeps each answer with its own run when jobs finish out of order", async () => {
    // Earlier questions answer slower, so they finish last
    const provider = fakeProvider(async (text) => {
      await delay((questions.length - questions.findIndex((q) => q.text === text)) * 4)
      return `answer: ${text}`
    })
    const { rows, saveRun } = fakeSave()
    await runQuestions({ scanId: "s1", questions, provider, concurrency: 24, saveRun })

    expect(rows[0].questionId).not.toBe(questions[0].id)
    for (const row of rows) {
      expect(row.answer).toBe(`answer: ${row.questionText}`)
    }
  })
})
