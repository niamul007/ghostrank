import { describe, it, expect } from "vitest"
import { scoreScan, ScanRun } from "../src/scanner/scorer"

const YES = "1. Bata Bangladesh — big\n2. Apex Footwear — local"
const NO = "1. Bata Bangladesh — big\n2. Other Shoes — small"
const names = ["Apex Footwear"]

const run = (questionId: string, group: string, answer: string | null, extra: Partial<ScanRun> = {}): ScanRun => ({
  questionId,
  group,
  scored: true,
  status: "SUCCESS",
  answer,
  ...extra,
})

describe("scoreScan", () => {
  it("gives 100 when every run mentions the business", () => {
    const r = scoreScan({ runs: [run("q1", "find", YES), run("q1", "find", YES)], businessNames: names })
    expect(r.score).toBe(100)
    expect(r.averagePosition).toBe(2)
    expect(r.lowConfidence).toBe(false)
  })

  it("gives 0 when none mention it", () => {
    const r = scoreScan({ runs: [run("q1", "find", NO), run("q1", "find", NO)], businessNames: names })
    expect(r.score).toBe(0)
    expect(r.averagePosition).toBeNull()
  })

  it("skips failed runs instead of counting them as misses", () => {
    const r = scoreScan({
      runs: [run("q1", "find", YES), run("q1", "find", null, { status: "FAILED" })],
      businessNames: names,
    })
    expect(r.score).toBe(100)
    expect(r.countedRuns).toBe(1)
    expect(r.expectedRuns).toBe(2)
  })

  it("flags low confidence under 70% coverage", () => {
    const runs = [
      run("q1", "find", YES),
      run("q1", "find", null, { status: "FAILED" }),
      run("q1", "find", null, { status: "FAILED" }),
    ]
    expect(scoreScan({ runs, businessNames: names }).lowConfidence).toBe(true)
    const ok = [
      run("q1", "find", YES),
      run("q1", "find", YES),
      run("q1", "find", YES),
      run("q1", "find", null, { status: "FAILED" }),
    ]
    expect(scoreScan({ runs: ok, businessNames: names }).lowConfidence).toBe(false)
  })

  it("excludes the reputation question from the score", () => {
    const r = scoreScan({
      runs: [run("q1", "find", NO), run("rep", "reputation", YES, { scored: false })],
      businessNames: names,
    })
    expect(r.score).toBe(0)
    expect(r.countedRuns).toBe(1)
    expect(r.reputation).toEqual({ mentioned: 1, counted: 1 })
  })

  it("counts per group and per question", () => {
    const r = scoreScan({
      runs: [
        run("q1", "find", YES),
        run("q1", "find", NO),
        run("q2", "compare", YES),
        run("q3", "need", NO),
      ],
      businessNames: names,
    })
    expect(r.byGroup).toEqual({
      find: { mentioned: 1, counted: 2 },
      compare: { mentioned: 1, counted: 1 },
      need: { mentioned: 0, counted: 1 },
    })
    expect(r.perQuestion).toEqual([
      { questionId: "q1", mentioned: 1, counted: 2 },
      { questionId: "q2", mentioned: 1, counted: 1 },
      { questionId: "q3", mentioned: 0, counted: 1 },
    ])
    expect(r.score).toBe(50)
  })

  it("returns a null score when nothing is countable", () => {
    const r = scoreScan({ runs: [run("q1", "find", null, { status: "FAILED" })], businessNames: names })
    expect(r.score).toBeNull()
    expect(r.countedRuns).toBe(0)
    expect(r.lowConfidence).toBe(true)
    expect(scoreScan({ runs: [], businessNames: names }).score).toBeNull()
  })
})
