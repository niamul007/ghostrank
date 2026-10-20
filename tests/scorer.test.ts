import { describe, it, expect } from "vitest"
import { computeScore } from "../src/scorer"
import type { ParsedScanResult } from "../src/types"

function result(overrides: Partial<ParsedScanResult> = {}): ParsedScanResult {
  return {
    platform: "claude",
    prompt: "best store in Dhaka",
    category: "direct",
    response: "",
    mentioned: true,
    matchStrength: "exact",
    matchScore: 1,
    position: 1,
    sentiment: "positive",
    alternatives: [],
    ...overrides,
  }
}

const notMentioned = () =>
  result({ mentioned: false, matchStrength: "none", matchScore: 0, position: null, sentiment: null })

describe("computeScore", () => {
  it("scores 0 when the business is never mentioned", () => {
    const score = computeScore([notMentioned(), notMentioned(), notMentioned()])
    expect(score.overall).toBe(0)
    expect(score.mentionCount).toBe(0)
  })

  it("scores 0 for an empty result list", () => {
    expect(computeScore([]).overall).toBe(0)
  })

  it("never exceeds 100 for a perfect set of results", () => {
    const score = computeScore([result(), result(), result()])
    expect(score.overall).toBeLessThanOrEqual(100)
    expect(score.overall).toBeGreaterThan(90)
  })

  it("stays between 0 and 100 across mixed inputs", () => {
    const sets: ParsedScanResult[][] = [
      [result({ sentiment: "negative", position: 9 })],
      [result(), notMentioned(), result({ position: null, sentiment: "neutral" })],
      [notMentioned()],
      Array.from({ length: 20 }, (_, i) => result({ position: i + 1 })),
    ]
    for (const set of sets) {
      const { overall } = computeScore(set)
      expect(overall).toBeGreaterThanOrEqual(0)
      expect(overall).toBeLessThanOrEqual(100)
    }
  })

  it("scores a business mentioned first higher than one mentioned fifth", () => {
    const first = computeScore([result({ position: 1 }), result({ position: 1 })])
    const fifth = computeScore([result({ position: 5 }), result({ position: 5 })])
    expect(first.overall).toBeGreaterThan(fifth.overall)
  })

  it("reports mention count, total prompts and average position", () => {
    const score = computeScore([result({ position: 2 }), result({ position: 4 }), notMentioned()])
    expect(score.mentionCount).toBe(2)
    expect(score.totalPrompts).toBe(3)
    expect(score.averagePosition).toBe(3)
  })

  it("counts sentiment only for mentioned results", () => {
    const score = computeScore([
      result({ sentiment: "positive" }),
      result({ sentiment: "negative" }),
      notMentioned(),
    ])
    expect(score.sentimentBreakdown).toEqual({ positive: 1, neutral: 0, negative: 1 })
  })

  it("scores negative mentions lower than positive ones", () => {
    const positive = computeScore([result({ sentiment: "positive" })])
    const negative = computeScore([result({ sentiment: "negative" })])
    expect(positive.overall).toBeGreaterThan(negative.overall)
  })
})

describe("scorer weights", () => {
  // WEIGHTS is not exported, so verify the sum through behavior: a perfect
  // result set on the active platform must land on exactly 100.
  it("component weights add up to 100 (perfect results score exactly 100)", () => {
    const score = computeScore([result({ position: 1, sentiment: "positive" })])
    expect(score.overall).toBe(100)
  })
})
