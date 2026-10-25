import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Client } from "@prisma/client"
import { runScanV2, type ScanUpdate } from "../src/scanner/runScanV2"
import * as questionBuilder from "../src/scanner/questionBuilder"
import type { RunRow } from "../src/scanner/runner"
import { ProviderError, type AIProvider } from "../src/scanner/providers/types"

const client = {
  id: "c1",
  agencyId: "a1",
  businessName: "Acme Plumbing",
  niche: "plumber",
  location: "Leeds, UK",
  city: "Leeds",
  nameVariants: ["Acme"],
  knownFor: ["emergency repairs"],
  competitors: ["Rival Pipes"],
} as Client

const goodProvider: AIProvider = {
  name: "fake",
  model: "fake-1",
  async ask(text) {
    return { text: `answer: ${text}`, durationMs: 1 }
  },
}

const badProvider: AIProvider = {
  name: "fake",
  model: "fake-1",
  async ask() {
    throw new ProviderError("Provider unavailable", false)
  },
}

function setup() {
  const rows: RunRow[] = []
  const updates: ScanUpdate[] = []
  return {
    rows,
    updates,
    saveRun: async (row: RunRow) => {
      rows.push(row)
    },
    loadClient: async () => client,
    loadRuns: async () => rows,
    updateScan: async (_id: string, data: ScanUpdate) => {
      updates.push(data)
    },
  }
}

const last = (updates: ScanUpdate[]) => updates[updates.length - 1]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("runScanV2", () => {
  it("completes with 24 rows and stores score, scoring and named results", async () => {
    const s = setup()
    const ownProvider: AIProvider = {
      name: "fake",
      model: "fake-1",
      async ask() {
        return { text: "1. Acme Plumbing\n2. Rival Pipes\n3. Other Co", durationMs: 1 }
      },
    }
    await runScanV2("s1", "c1", { ...s, provider: ownProvider, loadRuns: async () => s.rows })

    expect(s.rows).toHaveLength(24)
    expect(s.updates[0]).toEqual({ status: "RUNNING" })
    const final = last(s.updates)
    expect(final.status).toBe("COMPLETED")
    expect(final.score).toBe(100)
    expect(final.rawResults).toMatchObject({
      total: 24,
      succeeded: 24,
      failed: 0,
      saveFailed: 0,
      questionSetVersion: questionBuilder.QUESTION_SET_VERSION,
      scoring: { lowConfidence: false, averagePosition: 1 },
      named: {
        others: [{ name: "Other Co", runs: expect.any(Number) }],
        chosenCompetitors: [{ name: "Rival Pipes", runs: expect.any(Number) }],
      },
    })
    expect((final.rawResults as { scoring: { countedRuns: number } }).scoring.countedRuns).toBeGreaterThan(0)
  })

  it("still completes without the scoring part when loadRuns throws", async () => {
    const s = setup()
    const loadRuns = async () => {
      throw new Error("db down")
    }
    await expect(
      runScanV2("s1", "c1", { ...s, loadRuns, provider: goodProvider })
    ).resolves.toBeUndefined()

    const final = last(s.updates)
    expect(final.status).toBe("COMPLETED")
    expect(final).not.toHaveProperty("score")
    expect(final.rawResults).toEqual({
      total: 24,
      succeeded: 24,
      failed: 0,
      saveFailed: 0,
      questionSetVersion: questionBuilder.QUESTION_SET_VERSION,
    })
  })

  it("fails when every provider call fails", async () => {
    const s = setup()
    await runScanV2("s1", "c1", { ...s, provider: badProvider })

    const final = last(s.updates)
    expect(final.status).toBe("FAILED")
    expect(final.errorMsg).toBeTruthy()
    expect(final.errorMsg).not.toContain("Provider unavailable")
    expect(final.rawResults).toMatchObject({ succeeded: 0, failed: 24 })
  })

  it("fails when one run could not be saved", async () => {
    const s = setup()
    let calls = 0
    const saveRun = async (row: RunRow) => {
      if (++calls === 5) throw new Error("db down")
      s.rows.push(row)
    }
    await runScanV2("s1", "c1", { ...s, saveRun, provider: goodProvider })

    const final = last(s.updates)
    expect(final.status).toBe("FAILED")
    expect(final.rawResults).toMatchObject({ succeeded: 24, saveFailed: 1 })
  })

  it("marks the scan FAILED with a generic message when something throws, and does not throw", async () => {
    const s = setup()
    const loadClient = async (): Promise<Client> => {
      throw new Error("secret connection string")
    }
    await expect(
      runScanV2("s1", "c1", { ...s, loadClient, provider: goodProvider })
    ).resolves.toBeUndefined()

    const final = last(s.updates)
    expect(final.status).toBe("FAILED")
    expect(final.errorMsg).not.toContain("secret")
  })

  it("does not throw even when the failure update also fails", async () => {
    const s = setup()
    const updateScan = async () => {
      throw new Error("db down")
    }
    await expect(
      runScanV2("s1", "c1", { ...s, updateScan, provider: goodProvider })
    ).resolves.toBeUndefined()
  })

  it("passes every client field to buildQuestions", async () => {
    const spy = vi.spyOn(questionBuilder, "buildQuestions")
    const s = setup()
    await runScanV2("s1", "c1", { ...s, provider: goodProvider })

    expect(spy).toHaveBeenCalledWith({
      businessName: "Acme Plumbing",
      niche: "plumber",
      city: "Leeds",
      location: "Leeds, UK",
      nameVariants: ["Acme"],
      knownFor: ["emergency repairs"],
      competitors: ["Rival Pipes"],
    })
  })
})
