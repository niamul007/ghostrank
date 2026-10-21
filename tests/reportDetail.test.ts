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
  it("cuts at a word boundary, never mid-word", () => {
    const out = makeExcerpt("word ".repeat(200))
    expect(out.length).toBeLessThanOrEqual(ANSWER_EXCERPT_MAX)
    expect(out.endsWith("word...")).toBe(true)
    expect(out.slice(0, -3).split(" ").every((w) => w === "word")).toBe(true)
  })
  it("backs up to the previous space when the cut lands inside a word", () => {
    const out = makeExcerpt("a".repeat(590) + " longerwordthatcrossesthelimit and more")
    expect(out).toBe("a".repeat(590) + "...")
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
  it("reads names from list items", () => {
    const text = [
      "Top options:",
      "1. **Square Hospital** — large multi-specialty hospital",
      "2) United Hospital Limited: well known",
      "- Labaid Specialized Hospital (Dhanmondi)",
      "* _Popular Diagnostic Centre_ - diagnostics",
    ].join("\n")
    expect(findCompetitors(text, "Acme Clinic")).toEqual([
      "Square Hospital",
      "United Hospital Limited",
      "Labaid Specialized Hospital",
      "Popular Diagnostic Centre",
    ])
  })
  it("reads a name leading a paragraph", () => {
    const text = "Evercare Hospital Dhaka (Bashundhara) — formerly Apollo Hospitals Dhaka, a leading provider."
    expect(findCompetitors(text, "Acme Clinic")).toEqual(["Evercare Hospital Dhaka"])
  })
  it("ignores names in the middle of sentences", () => {
    const text = "You could try Bright Smile Dental or Miami Family Dentistry."
    expect(findCompetitors(text, "Nobody Inc")).toEqual([])
  })
  it("drops the client's own name, case-insensitively", () => {
    const text = "1. acme dental care\n2. Acme Dental Care Downtown\n3. Bright Smile Dental"
    expect(findCompetitors(text, "Acme Dental Care")).toEqual(["Bright Smile Dental"])
  })
  it("drops generic topic lines", () => {
    const text = "- Cardiovascular Diseases\n- Emergency Care\n- Dental Services\n- Metro Heart Centre"
    expect(findCompetitors(text, "Nobody Inc")).toEqual(["Metro Heart Centre"])
  })
  it("drops heading lines ending with a colon", () => {
    const text = "Best Hospitals:\nTop options:\n- Metro Heart Centre"
    expect(findCompetitors(text, "Nobody Inc")).toEqual(["Metro Heart Centre"])
  })
  it("keeps a 3-word name that starts with a heading word", () => {
    expect(findCompetitors("- Popular Diagnostic Centre", "Nobody Inc")).toEqual(["Popular Diagnostic Centre"])
  })
  it("drops the client's exact name but not names that merely contain it", () => {
    const text = "1. Square Center\n2. Town Square Hospital\n3. Squares Hospital"
    expect(findCompetitors("1. Square\n" + text, "Square")).toEqual([
      "Town Square Hospital",
      "Squares Hospital",
    ])
  })
  it("keeps names ending in Health", () => {
    expect(findCompetitors("- Apollo Health", "Acme Clinic")).toEqual(["Apollo Health"])
  })
  it("drops sentences and lines with too few or too many words", () => {
    const text = "- Visit your local doctor.\n- Alpha\n- One Two Three Four Five Six Seven\n- lowercase start here"
    expect(findCompetitors(text, "Nobody Inc")).toEqual([])
  })
  it("drops sentence fragments but keeps names with mid-name connectors", () => {
    const text = [
      "- For very advanced treatment, such",
      "- Bangabandhu Sheikh Mujib Medical University",
      "- Bank of Dhaka",
    ].join("\n")
    expect(findCompetitors(text, "Nobody Inc")).toEqual([
      "Bangabandhu Sheikh Mujib Medical University",
      "Bank of Dhaka",
    ])
  })
  it("de-duplicates case-insensitively", () => {
    const text = "1. Bright Smile Dental\n2. BRIGHT SMILE DENTAL — again\n3. Miami Family Dentistry"
    expect(findCompetitors(text, "Nobody Inc")).toEqual(["Bright Smile Dental", "Miami Family Dentistry"])
  })
  it("caps at 5 names in order, and returns [] when none", () => {
    const many = ["Alpha One", "Beta Two", "Gamma Three", "Delta Four", "Epsilon Five", "Zeta Six"]
      .map((n, i) => `${i + 1}. ${n}`)
      .join("\n")
    expect(findCompetitors(many, "Nobody Inc")).toEqual([
      "Alpha One", "Beta Two", "Gamma Three", "Delta Four", "Epsilon Five",
    ])
    expect(findCompetitors("no names here at all.", "Nobody Inc")).toEqual([])
  })
})
