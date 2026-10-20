import { describe, it, expect } from "vitest"
import { findBestMatch, extractContext } from "../src/scanner/detector"

describe("findBestMatch", () => {
  it("finds an exact match", () => {
    const match = findBestMatch("For online shopping I would suggest Daraz in Bangladesh.", "Daraz")
    expect(match).not.toBeNull()
    expect(match!.strength).toBe("exact")
    expect(match!.matchedText).toBe("Daraz")
  })

  it("is case-insensitive for an exact match", () => {
    const match = findBestMatch("try DARAZ first", "Daraz")
    expect(match!.strength).toBe("exact")
  })

  it("treats a typo ('Darazz' for 'Daraz') as a fuzzy match", () => {
    const match = findBestMatch("For online shopping I would suggest Darazz in Bangladesh.", "Daraz")
    expect(match).not.toBeNull()
    expect(match!.strength).toBe("fuzzy")
  })

  it("returns no match for unrelated text", () => {
    const match = findBestMatch("The weather in Dhaka is humid during the summer months.", "Daraz")
    expect(match === null || match.strength === "none").toBe(true)
  })

  it("returns null for empty response text", () => {
    expect(findBestMatch("", "Daraz")).toBeNull()
  })
})

describe("extractContext", () => {
  it("returns the whole line for a numbered list item", () => {
    const text = "1. Daraz - the best and most trusted online marketplace in Bangladesh, with fast delivery."
    const match = findBestMatch(text, "Daraz")!
    expect(extractContext(text, match)).toBe(text)
  })

  it("returns the whole line even when the item contains several sentences", () => {
    const text = "Here are options:\n1. Daraz - the best and most trusted. Great delivery.\n2. Pickaboo - electronics."
    const match = findBestMatch(text, "Daraz")!
    expect(extractContext(text, match)).toBe("1. Daraz - the best and most trusted. Great delivery.")
  })

  it("returns the Daraz line for a two-item list with Pickaboo and Daraz", () => {
    const text = "1. Pickaboo - good for electronics\n2. Daraz - the best and most trusted marketplace"
    const match = findBestMatch(text, "Daraz")!
    expect(extractContext(text, match)).toBe("2. Daraz - the best and most trusted marketplace")
  })

  it("returns only the containing sentence for plain prose", () => {
    const text = "Dhaka has many shops. Daraz is a popular marketplace. Others exist too."
    const match = findBestMatch(text, "Daraz")!
    expect(extractContext(text, match)).toBe("Daraz is a popular marketplace.")
  })
})
