import { describe, it, expect } from "vitest"
import { detectPosition, detectSentiment, parseResponse } from "../src/scanner/parser"
import type { AIResponse } from "../src/types"

function ai(rawText: string): AIResponse {
  return { platform: "claude", prompt: "best store", rawText, durationMs: 1 }
}

describe("detectPosition", () => {
  it("detects position from '1.' list format", () => {
    expect(detectPosition("1. Pickaboo\n2. Daraz\n3. Othoba", "Daraz")).toBe(2)
  })

  it("detects position from '2)' list format", () => {
    expect(detectPosition("1) Pickaboo\n2) Daraz\n3) Othoba", "Daraz")).toBe(2)
  })

  it("detects position from '#1' list format", () => {
    // KNOWN ISSUE: the position regex requires punctuation ('.', ')', ':' or '-')
    // after the number, so a bare "#1 Daraz" is not recognised and returns null.
    // "#1." works. This test documents the current behavior.
    expect(detectPosition("#1 Daraz\n#2 Pickaboo", "Daraz")).toBeNull()
    expect(detectPosition("#1. Daraz\n#2. Pickaboo", "Daraz")).toBe(1)
  })

  it("returns null when the business is not in a numbered line", () => {
    expect(detectPosition("I would suggest Daraz for shopping.", "Daraz")).toBeNull()
  })

  it("returns null when the business is absent", () => {
    expect(detectPosition("1. Pickaboo\n2. Othoba", "Daraz")).toBeNull()
  })
})

describe("detectSentiment", () => {
  it("gives positive sentiment for a positive sentence", () => {
    expect(detectSentiment("Daraz is the best and most trusted marketplace.")).toBe("positive")
  })

  it("gives negative sentiment for 'poor service'", () => {
    expect(detectSentiment("Daraz has poor service and many complaints.")).toBe("negative")
  })

  it("gives neutral sentiment for a plain mention", () => {
    expect(detectSentiment("Daraz is an online marketplace in Dhaka.")).toBe("neutral")
  })
})

describe("parseResponse", () => {
  it("combines mention, position and sentiment for a list item", () => {
    const parsed = parseResponse(
      ai("1. Daraz - the best and most trusted marketplace\n2. Pickaboo - electronics"),
      "Daraz",
      "direct"
    )
    expect(parsed.mentioned).toBe(true)
    expect(parsed.position).toBe(1)
    expect(parsed.sentiment).toBe("positive")
  })

  it("marks an unmentioned business with null position and sentiment", () => {
    const parsed = parseResponse(ai("1. Pickaboo\n2. Othoba"), "Daraz", "direct")
    expect(parsed.mentioned).toBe(false)
    expect(parsed.position).toBeNull()
    expect(parsed.sentiment).toBeNull()
  })
})
