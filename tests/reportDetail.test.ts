import { describe, it, expect } from "vitest"
import {
  classifyIssue,
  findCompetitors,
  getFix,
  makeExcerpt,
  ANSWER_EXCERPT_MAX,
} from "../src/services/reportDetail"

describe("classifyIssue", () => {
  it("flags unmentioned results", () => {
    expect(classifyIssue({ mentioned: false, position: null, sentiment: null })).toBe("not_mentioned")
  })
  it("flags position 4 or lower as low_position", () => {
    expect(classifyIssue({ mentioned: true, position: 4, sentiment: "neutral" })).toBe("low_position")
    expect(classifyIssue({ mentioned: true, position: 7, sentiment: "positive" })).toBe("low_position")
  })
  it("treats positions 1-3 as ok", () => {
    expect(classifyIssue({ mentioned: true, position: 3, sentiment: "positive" })).toBe("ok")
    expect(classifyIssue({ mentioned: true, position: null, sentiment: null })).toBe("ok")
  })
  it("flags negative sentiment, ahead of low position", () => {
    expect(classifyIssue({ mentioned: true, position: 1, sentiment: "negative" })).toBe("negative")
    expect(classifyIssue({ mentioned: true, position: 5, sentiment: "negative" })).toBe("negative")
  })
})

describe("makeExcerpt", () => {
  it("trims and keeps short text intact", () => {
    expect(makeExcerpt("  hello  ")).toBe("hello")
  })
  it("keeps text of exactly 600 characters", () => {
    const text = "a".repeat(ANSWER_EXCERPT_MAX)
    expect(makeExcerpt(text)).toBe(text)
  })
  it("cuts longer text to at most 600 characters with ...", () => {
    const out = makeExcerpt("a".repeat(601))
    expect(out.length).toBeLessThanOrEqual(ANSWER_EXCERPT_MAX)
    expect(out.endsWith("...")).toBe(true)
  })
})

describe("getFix", () => {
  const categories = ["direct", "comparison", "discovery", "specific"]
  it("returns null for ok", () => {
    expect(getFix("direct", "ok")).toBeNull()
  })
  it("gives a distinct suggestion per category for not_mentioned and low_position", () => {
    for (const issue of ["not_mentioned", "low_position"] as const) {
      const fixes = categories.map((c) => getFix(c, issue))
      fixes.forEach((f) => expect(typeof f).toBe("string"))
      expect(new Set(fixes).size).toBe(4)
    }
  })
  it("uses one reputation suggestion for negative in every category", () => {
    const fixes = categories.map((c) => getFix(c, "negative"))
    expect(new Set(fixes).size).toBe(1)
    expect(fixes[0]).toMatch(/review/i)
    expect(fixes[0]).not.toBe(getFix("direct", "not_mentioned"))
  })
  it("falls back for an unknown category", () => {
    expect(typeof getFix("mystery", "not_mentioned")).toBe("string")
  })
})

describe("findCompetitors", () => {
  it("returns other business names, excluding the client", () => {
    const text = "You could try Bright Smile Dental or Miami Family Dentistry. Also Acme Dental Care is good."
    const out = findCompetitors(text, "Acme Dental Care")
    expect(out).toContain("Bright Smile Dental")
    expect(out).not.toContain("Acme Dental Care")
  })
  it("caps at 5 and returns [] when none", () => {
    const many = "Alpha One, Beta Two, Gamma Three, Delta Four, Epsilon Five, Zeta Six."
    expect(findCompetitors(many, "Nobody Inc").length).toBeLessThanOrEqual(5)
    expect(findCompetitors("no names here at all.", "Nobody Inc")).toEqual([])
  })
})
