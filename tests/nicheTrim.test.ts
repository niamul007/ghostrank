import { describe, it, expect } from "vitest"
import { createClientSchema, updateClientSchema } from "../src/schemas/client.schema"
import { buildPrompts } from "../src/scanner/promptBuilder"

describe("input trimming", () => {
  it("trims niche, business name and location on create", () => {
    const r = createClientSchema.parse({
      businessName: "  Acme Shoes ",
      niche: "Shoe store ",
      location: " Dhaka ",
      city: " Dhaka ",
      website: "https://acme.example",
    })
    expect(r).toMatchObject({ businessName: "Acme Shoes", niche: "Shoe store", location: "Dhaka", city: "Dhaka" })
  })

  it("trims fields on update", () => {
    expect(updateClientSchema.parse({ niche: "Shoe store " })).toEqual({ niche: "Shoe store" })
  })

  it("rejects whitespace-only niche", () => {
    expect(createClientSchema.safeParse({
      businessName: "Acme", city: "Dhaka", niche: "   ", location: "Dhaka", website: "https://acme.example",
    }).success).toBe(false)
  })
})

describe("buildPrompts", () => {
  it("does not produce double spaces from a niche with trailing space", () => {
    const prompts = buildPrompts({
      scanId: "s", clientId: "c", businessName: "Acme", niche: "Shoe store ", location: "Dhaka",
    })
    expect(prompts.length).toBeGreaterThan(0)
    for (const p of prompts) expect(p.text).not.toMatch(/ {2}/)
  })
})
