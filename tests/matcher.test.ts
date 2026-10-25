import { describe, it, expect } from "vitest"
import { normalize, findMention, extractListedNames, classifyListed } from "../src/scanner/matcher"

const FIXTURE =
  "1. Bata Bangladesh — the oldest and most widespread brand, with shops nationwide\n" +
  "2. Apex Footwear — one of the biggest local makers"

describe("normalize", () => {
  it("lowercases, strips diacritics, maps & and drops apostrophes", () => {
    expect(normalize("Café  Rio")).toBe("cafe rio")
    expect(normalize("AT&T")).toBe("at and t")
    expect(normalize("Joe's Pizza")).toBe("joes pizza")
    expect(normalize("Joe’s-Pizza!")).toBe("joes pizza")
  })
})

describe("findMention", () => {
  it("ignores case and diacritics", () => {
    expect(findMention("Try cafe rio downtown", ["Café Rio"]).mentioned).toBe(true)
  })

  it("ignores punctuation differences", () => {
    expect(findMention("Joes Pizza is great", ["Joe's Pizza"]).mentioned).toBe(true)
    expect(findMention("Call AT and T", ["AT&T"]).mentioned).toBe(true)
  })

  it("respects word boundaries", () => {
    expect(findMention("Visit Batavia today", ["Bata"]).mentioned).toBe(false)
    expect(findMention("Visit Bata today", ["Bata"]).mentioned).toBe(true)
  })

  it("matches name variants and reports which one matched", () => {
    const r = findMention("Apex is solid", ["Apex Footwear Ltd", "Apex"])
    expect(r).toEqual({ mentioned: true, matchedName: "apex", position: null })
  })

  it("drops names under 2 chars", () => {
    expect(findMention("a b c", ["a"]).mentioned).toBe(false)
  })

  it("gives the position from a numbered list", () => {
    expect(findMention(FIXTURE, ["Apex Footwear"])).toEqual({
      mentioned: true,
      matchedName: "apex footwear",
      position: 2,
    })
  })

  it("gives null position for a mention in prose", () => {
    const r = findMention("I would suggest Apex Footwear for this.", ["Apex Footwear"])
    expect(r.mentioned).toBe(true)
    expect(r.position).toBeNull()
  })

  it("handles no mention and empty answer", () => {
    expect(findMention(FIXTURE, ["Nike"])).toEqual({ mentioned: false, matchedName: null, position: null })
    expect(findMention("", ["Nike"])).toEqual({ mentioned: false, matchedName: null, position: null })
  })

  it("handles bold markdown", () => {
    const r = findMention("1) **Bata Bangladesh**: big\n2) **Apex Footwear**: local", ["Apex Footwear"])
    expect(r.position).toBe(2)
  })
})

describe("extractListedNames", () => {
  it("extracts the head of each entry from the fixture", () => {
    expect(extractListedNames(FIXTURE)).toEqual([
      { position: 1, name: "Bata Bangladesh" },
      { position: 2, name: "Apex Footwear" },
    ])
  })

  it("stops at colon, parenthesis and hyphen, and skips non-list lines", () => {
    const text = "Here you go:\n1. **Alpha**: first\n2) Beta (est. 1990)\n3. Gamma - cheap"
    expect(extractListedNames(text).map((l) => l.name)).toEqual(["Alpha", "Beta", "Gamma"])
  })
})

describe("classifyListed", () => {
  it("labels client, chosen competitor and other", () => {
    const listed = extractListedNames(FIXTURE)
    const out = classifyListed(listed, ["Apex Footwear"], ["Bata"])
    expect(out.map((l) => l.kind)).toEqual(["chosen-competitor", "client"])
    expect(classifyListed(listed, ["Nike"], ["Adidas"]).map((l) => l.kind)).toEqual(["other", "other"])
  })
})
