import { describe, it, expect } from "vitest"
import { sanitizeText } from "../src/utils/sanitizeText"

describe("sanitizeText", () => {
  it("strips bold and italic markers", () => {
    expect(sanitizeText("**Daraz** is *very* popular")).toBe("Daraz is very popular")
  })

  it("strips header markers", () => {
    expect(sanitizeText("## Top picks\nDaraz")).toBe("Top picks\nDaraz")
  })

  it("strips bullet and numbered list markers at line start", () => {
    expect(sanitizeText("- Daraz\n* Pickaboo\n1. Othoba")).toBe("Daraz\nPickaboo\nOthoba")
  })

  it("removes emoji", () => {
    expect(sanitizeText("Great shop 🎉 ⚠️ here")).toBe("Great shop here")
  })

  it("collapses repeated blank lines and trims", () => {
    expect(sanitizeText("  a\n\n\n\nb  ")).toBe("a\n\nb")
  })

  it("leaves math-style asterisks with spaces alone", () => {
    expect(sanitizeText("3 * 4 * 5")).toBe("3 * 4 * 5")
  })

  it("returns an empty string unchanged", () => {
    expect(sanitizeText("")).toBe("")
  })
})
