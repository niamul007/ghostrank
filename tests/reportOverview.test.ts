import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/prisma", () => ({ default: {}, prisma: {} }))

import { buildReportData } from "../src/services/report.service"
import {
  buildScoreBreakdown,
  countByPromptType,
  rankTopFixes,
  topCompetitors,
} from "../src/services/reportDetail"
import { WEIGHTS, computeScore } from "../src/scorer"
import type { ParsedScanResult } from "../src/types"

function row(o: Record<string, unknown> = {}) {
  return {
    platform: "claude",
    prompt: "best store in Dhaka",
    category: "direct",
    response: "",
    mentioned: true,
    position: 1,
    sentiment: "positive",
    ...o,
  }
}

function scanFrom(rows: ReturnType<typeof row>[]) {
  const parsed = rows.map((r) => ({
    ...r,
    matchStrength: r.mentioned ? "exact" : "none",
    matchScore: r.mentioned ? 1 : 0,
    alternatives: [],
  })) as unknown as ParsedScanResult[]
  const raw = computeScore(parsed)
  return {
    score: raw.overall,
    rawResults: raw,
    scanResults: rows,
    client: { businessName: "Acme" },
  } as never
}

describe("buildScoreBreakdown", () => {
  it("uses the real scoring weights as max points", () => {
    const b = buildScoreBreakdown(
      { mentionRate: 0, positionQuality: 0, platformCoverage: 0, sentimentBonus: 0 },
      WEIGHTS
    )
    expect(b.mentionRate.max).toBe(WEIGHTS.mentionRate)
    expect(b.position.max).toBe(WEIGHTS.positionQuality)
    expect(b.coverage.max).toBe(WEIGHTS.platformCoverage)
    expect(b.sentiment.max).toBe(WEIGHTS.sentimentBonus)
  })

  it("rounds parts so they sum to the rounded total", () => {
    const b = buildScoreBreakdown(
      { mentionRate: 13.4, positionQuality: 10.4, platformCoverage: 5.4, sentimentBonus: 7.4 },
      WEIGHTS
    )
    const sum = b.mentionRate.earned + b.position.earned + b.coverage.earned + b.sentiment.earned
    expect(sum).toBe(Math.round(13.4 + 10.4 + 5.4 + 7.4))
  })
})

describe("countByPromptType", () => {
  it("counts totals and mentions per type, ignoring unknown types", () => {
    const s = countByPromptType([
      { category: "direct", mentioned: true },
      { category: "direct", mentioned: false },
      { category: "discovery", mentioned: false },
      { category: "weird", mentioned: true },
    ])
    expect(s.direct).toEqual({ total: 2, mentioned: 1 })
    expect(s.discovery).toEqual({ total: 1, mentioned: 0 })
    expect(s.comparison).toEqual({ total: 0, mentioned: 0 })
    expect(s.specific).toEqual({ total: 0, mentioned: 0 })
  })
})

describe("topCompetitors", () => {
  it("sorts by count, merges case, and keeps top 5", () => {
    const out = topCompetitors([
      ["Beta", "Gamma", "Delta", "Eps", "Zeta", "Eta"],
      ["beta", "Gamma"],
      ["Beta"],
    ])
    expect(out).toHaveLength(5)
    expect(out[0]).toEqual({ name: "Beta", mentions: 3 })
    expect(out[1]).toEqual({ name: "Gamma", mentions: 2 })
  })

  it("returns an empty list for no competitors", () => {
    expect(topCompetitors([[], []])).toEqual([])
  })

  it("merges names that differ only by a legal suffix", () => {
    const out = topCompetitors([
      ["United Hospital"],
      ["United Hospital Limited"],
      ["Square Hospitals"],
      ["square hospitals LTD."],
      ["Acme (Pvt.) Ltd"],
      ["Acme Inc."],
    ])
    expect(out).toHaveLength(3)
    expect(out.map((c) => c.mentions)).toEqual([2, 2, 2])
    expect(out.map((c) => c.name)).toEqual(["Acme Inc.", "Square Hospitals", "United Hospital"])
  })

  it("counts a merged name once per result", () => {
    const out = topCompetitors([["United Hospital", "United Hospital Limited", "united hospital"], ["Other"]])
    expect(out.find((c) => c.name === "United Hospital")?.mentions).toBe(1)
  })

  it("shows the most frequent variant, shortest on a tie", () => {
    const frequent = topCompetitors([
      ["Square Hospitals Ltd"],
      ["Square Hospitals Ltd"],
      ["Square Hospitals"],
    ])
    expect(frequent).toEqual([{ name: "Square Hospitals Ltd", mentions: 3 }])
    const tie = topCompetitors([["United Hospital Limited"], ["United Hospital"]])
    expect(tie).toEqual([{ name: "United Hospital", mentions: 2 }])
  })

  it("keeps unrelated names separate", () => {
    const out = topCompetitors([["Square Hospital", "Square Hospitals", "Dhaka Square Hospitals", "Co"]])
    expect(out).toHaveLength(4)
  })
})

describe("rankTopFixes", () => {
  it("orders by biggest gap, drops zero gaps, caps at 3, ties keep order", () => {
    const out = rankTopFixes([
      { recommendation: "a", missedPrompts: 2 },
      { recommendation: "b", missedPrompts: 5 },
      { recommendation: "c", missedPrompts: 0 },
      { recommendation: "d", missedPrompts: 2 },
      { recommendation: "e", missedPrompts: 1 },
    ])
    expect(out.map((x) => x.recommendation)).toEqual(["b", "a", "d"])
  })
})

describe("buildReportData new fields", () => {
  it("handles a scan with zero mentions", () => {
    const rows = [
      row({ mentioned: false, position: null, sentiment: null, response: "Try Beta Store or Gamma Mart." }),
      row({ mentioned: false, position: null, sentiment: null, category: "discovery", response: "Beta Store is great." }),
    ]
    const data = buildReportData(scanFrom(rows), "r1", new Date())
    expect(data.score).toBe(0)
    expect(data.breakdown.mentionRate.earned).toBe(0)
    const sum = Object.values(data.breakdown).reduce((a, p) => a + p.earned, 0)
    expect(sum).toBe(data.score)
    expect(data.byPromptType.direct).toEqual({ total: 1, mentioned: 0 })
    expect(data.byPromptType.discovery).toEqual({ total: 1, mentioned: 0 })
    expect(data.topFixes.length).toBeGreaterThan(0)
    expect(data.topFixes.length).toBeLessThanOrEqual(3)
    expect(data.topFixes[0].missedPrompts).toBe(2)
    for (const f of data.topFixes) expect(data.recommendations).toContain(f.recommendation)
  })

  it("handles an empty scan", () => {
    const data = buildReportData(scanFrom([]), "r2", new Date())
    expect(data.breakdown.mentionRate.earned).toBe(0)
    expect(data.byPromptType.direct).toEqual({ total: 0, mentioned: 0 })
    expect(data.competitors).toEqual([])
    expect(data.topFixes).toEqual([])
  })

  it("breakdown sums to the stored score for a mixed scan", () => {
    const rows = [
      row(),
      row({ category: "comparison", position: 3, sentiment: "neutral" }),
      row({ category: "specific", mentioned: false, position: null, sentiment: null }),
    ]
    const data = buildReportData(scanFrom(rows), "r3", new Date())
    const sum = Object.values(data.breakdown).reduce((a, p) => a + p.earned, 0)
    expect(sum).toBe(data.score)
    expect(data.byPromptType.direct.mentioned).toBe(1)
    expect(data.byPromptType.specific).toEqual({ total: 1, mentioned: 0 })
  })
})
