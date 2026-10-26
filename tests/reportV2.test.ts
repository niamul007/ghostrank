import { describe, it, expect } from "vitest"
import {
  buildReportV2,
  scoreLabelFor,
  wilsonRange,
  type ReportV2Input,
  type ReportV2Run,
} from "../src/services/reportV2"

const client = {
  businessName: "Cafe Roma",
  niche: "coffee shop",
  location: "Dhaka, Bangladesh",
  city: "Dhaka",
  nameVariants: [],
  competitors: ["Blue Bean"],
}

function run(o: Partial<ReportV2Run> = {}): ReportV2Run {
  return {
    questionId: "q1",
    group: "find",
    questionText: "Best coffee shop in Dhaka?",
    scored: true,
    status: "SUCCESS",
    answer: "1. Cafe Roma\n2. Other Place",
    provider: "claude",
    model: "claude-test",
    ...o,
  }
}

function input(o: Partial<ReportV2Input> = {}): ReportV2Input {
  return {
    reportId: "rep1",
    generatedAt: new Date("2026-01-02T00:00:00Z"),
    scan: { createdAt: new Date("2026-01-01T00:00:00Z") },
    client,
    runs: [],
    ...o,
  }
}

describe("wilsonRange", () => {
  it("7/21 gives a sensible interval around 33%", () => {
    const r = wilsonRange(7, 21)
    expect(r.low).toBeGreaterThanOrEqual(15)
    expect(r.low).toBeLessThanOrEqual(19)
    expect(r.high).toBeGreaterThanOrEqual(53)
    expect(r.high).toBeLessThanOrEqual(57)
  })

  it("11/21 gives a sensible interval around 52%", () => {
    const r = wilsonRange(11, 21)
    expect(r.low).toBeGreaterThanOrEqual(31)
    expect(r.low).toBeLessThanOrEqual(33)
    expect(r.high).toBeGreaterThanOrEqual(71)
    expect(r.high).toBeLessThanOrEqual(73)
  })

  it("0/21 starts at 0 and stays below 20", () => {
    const r = wilsonRange(0, 21)
    expect(r.low).toBe(0)
    expect(r.high).toBeGreaterThan(0)
    expect(r.high).toBeLessThan(20)
  })

  it("21/21 ends at 100 and stays above 80", () => {
    const r = wilsonRange(21, 21)
    expect(r.high).toBe(100)
    expect(r.low).toBeGreaterThan(80)
    expect(r.low).toBeLessThan(100)
  })

  it("stays within 0-100 and is whole numbers", () => {
    for (let m = 0; m <= 21; m++) {
      const { low, high } = wilsonRange(m, 21)
      expect(low).toBeGreaterThanOrEqual(0)
      expect(high).toBeLessThanOrEqual(100)
      expect(low).toBeLessThanOrEqual(high)
      expect(Number.isInteger(low) && Number.isInteger(high)).toBe(true)
    }
  })

  it("returns 0-0 when nothing was counted", () => {
    expect(wilsonRange(0, 0)).toEqual({ low: 0, high: 0 })
  })
})

describe("scoreLabelFor", () => {
  it.each([
    [100, "Strong"],
    [70, "Strong"],
    [69, "Mixed"],
    [40, "Mixed"],
    [39, "Rarely named"],
    [1, "Rarely named"],
    [0, "Not named"],
  ])("%i is %s", (score, label) => {
    expect(scoreLabelFor(score)).toBe(label)
  })
})

const rep = (n: number, answer: string) =>
  Array.from({ length: n }, () => run({ questionId: "rep", group: "need", scored: false, questionText: "Is Cafe Roma good?", answer }))
const qRuns = (id: string, group: string, text: string, answers: string[]) =>
  answers.map((answer) => run({ questionId: id, group, questionText: text, answer }))

describe("buildReportV2 from runs", () => {
  const runs = [
    ...qRuns("q1", "find", "Best coffee in Dhaka?", [
      "1. Cafe Roma\n2. Other Place",
      "1. Cafe Roma\n2. Other Place",
      "1. Other Place\n2. Blue Bean",
      "1. Other Place",
    ]),
    ...qRuns("q2", "compare", "Cafe Roma vs Blue Bean?", [
      "1. Cafe Roma\n2. Blue Bean",
      "1. Blue Bean",
      "1. Other Place",
      "1. Other Place",
    ]),
    ...rep(2, "Cafe Roma is good"),
    ...rep(1, "Nothing known"),
  ]
  const report = buildReportV2(input({ runs }))

  it("fills identity, dates and labels", () => {
    expect(report.version).toBe(2)
    expect(report.id).toBe("rep1")
    expect(report.generatedAt).toBe("2026-01-02T00:00:00.000Z")
    expect(report.scanDate).toBe("2026-01-01T00:00:00.000Z")
    expect(report.business).toEqual({
      name: "Cafe Roma",
      niche: "coffee shop",
      location: "Dhaka, Bangladesh",
      city: "Dhaka",
    })
    expect(report.scoreLabel).toBe("Rarely named")
    expect(report.model).toEqual({ provider: "claude", model: "claude-test" })
  })

  it("recomputes the score as mentioned/counted rounded, with a matching Wilson range", () => {
    expect(report.basedOnRuns).toBe(8)
    expect(report.score).toBe(Math.round((3 / 8) * 100))
    expect(report.score).toBe(38)
    expect(report.scoreRange).toEqual(wilsonRange(3, 8))
  })

  it("computes group percents", () => {
    expect(report.byGroup).toEqual([
      { group: "find", mentioned: 2, counted: 4, percent: 50 },
      { group: "compare", mentioned: 1, counted: 4, percent: 25 },
      { group: "need", mentioned: 0, counted: 0, percent: 0 },
    ])
  })

  it("takes question text and group from the runs", () => {
    expect(report.questions).toEqual([
      { questionId: "q1", group: "find", text: "Best coffee in Dhaka?", mentioned: 2, counted: 4 },
      { questionId: "q2", group: "compare", text: "Cafe Roma vs Blue Bean?", mentioned: 1, counted: 4 },
    ])
    expect(report.reputationQuestion).toEqual({
      questionId: "rep",
      text: "Is Cafe Roma good?",
      mentioned: 2,
      counted: 3,
    })
  })

  it("counts other businesses and chosen competitors with percent of counted runs", () => {
    expect(report.named.others.find((o) => o.name === "Other Place")).toEqual({
      name: "Other Place",
      runs: 6,
      percent: 75,
    })
    expect(report.named.chosenCompetitors).toEqual([{ name: "Blue Bean", runs: 3, percent: 38 }])
  })

  it("caps others at 10", () => {
    const many = Array.from({ length: 12 }, (_, i) => `${i + 1}. Spot Number${String.fromCharCode(65 + i)}`).join("\n")
    const r = buildReportV2(input({ runs: [run({ answer: many })] }))
    expect(r.named.others).toHaveLength(10)
  })
})

describe("stale stored data is ignored", () => {
  // The matcher ignores names shorter than 2 characters, so the "A,B" case uses real-looking names.
  it("shows Alpha Cafe and Beta Cafe as two chosen competitors from the current client, not a stale 'Alpha Cafe,Beta Cafe'", () => {
    const stale = {
      scoring: { countedRuns: 99, perQuestion: [], byGroup: {} },
      named: { others: [], chosenCompetitors: [{ name: "Alpha Cafe,Beta Cafe", runs: 0 }] },
    }
    const scan = { createdAt: new Date(), score: 99, rawResults: stale }
    const report = buildReportV2(
      input({
        scan,
        client: { ...client, competitors: ["Alpha Cafe", "Beta Cafe"] },
        runs: [
          run({ answer: "1. Cafe Roma\n2. Alpha Cafe\n3. Beta Cafe" }),
          run({ answer: "1. Alpha Cafe\n2. Other Place" }),
          run({ answer: "1. Other Place" }),
        ],
      }),
    )
    expect(report.named.chosenCompetitors).toEqual([
      { name: "Alpha Cafe", runs: 2, percent: 67 },
      { name: "Beta Cafe", runs: 1, percent: 33 },
    ])
    expect(report.basedOnRuns).toBe(3)
    expect(report.score).toBe(33)
  })
})

describe("reputation answers", () => {
  it("cuts each answer to 400 characters, keeps at most 3, and skips failed runs", () => {
    const long = "x".repeat(900)
    const report = buildReportV2(
      input({
        scan: { createdAt: new Date() },
        runs: [
          run({ questionId: "rep", scored: false, status: "FAILED", answer: "should be skipped" }),
          run({ questionId: "rep", scored: false, answer: long }),
          run({ questionId: "rep", scored: false, answer: "short answer" }),
          run({ questionId: "rep", scored: false, answer: "third" }),
          run({ questionId: "rep", scored: false, answer: "fourth, dropped" }),
          run({ questionId: "q1", scored: true, answer: "scored answers never appear" }),
        ],
      }),
    )
    expect(report.reputation.answers).toHaveLength(3)
    expect(report.reputation.answers[0]).toHaveLength(400)
    expect(report.reputation.answers.slice(1)).toEqual(["short answer", "third"])
  })
})

describe("edge cases", () => {
  const runs = [
    run({ answer: "1. Cafe Roma\n2. Blue Bean\n3. Other Place" }),
    run({ answer: "1. Cafe Roma\n2. Other Place" }),
    run({ answer: "1. Other Place\n2. Another Spot" }),
  ]

  it("computes the score, ranges and named businesses from the runs", () => {
    const report = buildReportV2(
      input({ runs }),
    )
    expect(report.basedOnRuns).toBe(3)
    expect(report.score).toBe(67)
    expect(report.scoreLabel).toBe("Mixed")
    expect(report.scoreRange).toEqual(wilsonRange(2, 3))
    expect(report.questions).toEqual([
      { questionId: "q1", group: "find", text: "Best coffee shop in Dhaka?", mentioned: 2, counted: 3 },
    ])
    expect(report.named.others.find((o) => o.name === "Other Place")).toEqual({
      name: "Other Place",
      runs: 3,
      percent: 100,
    })
    expect(report.named.chosenCompetitors).toEqual([{ name: "Blue Bean", runs: 1, percent: 33 }])
  })

  it("handles a scan with no counted runs", () => {
    const report = buildReportV2(input({ runs: [run({ status: "FAILED", answer: null })] }))
    expect(report.score).toBe(0)
    expect(report.scoreLabel).toBe("Not named")
    expect(report.scoreRange).toEqual({ low: 0, high: 0 })
    expect(report.named.chosenCompetitors).toEqual([{ name: "Blue Bean", runs: 0, percent: 0 }])
  })
})
