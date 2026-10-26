import { describe, it, expect } from "vitest"
import { updateAgencySchema } from "../src/schemas/agency.schema"
import { toAgencyBranding } from "../src/controllers/agency.controller"

const parse = (input: object) => updateAgencySchema.safeParse(input)
const errorsOf = (input: object) => {
  const r = parse(input)
  return r.success ? null : r.error.flatten().fieldErrors
}

describe("agency branding validation", () => {
  it("accepts a valid name, colour and logo", () => {
    expect(parse({ name: "Acme", brandColor: "#1e3a5f", logoUrl: "https://acme.example/logo.png" }).success).toBe(true)
  })

  it("accepts an empty body (nothing to change)", () => {
    expect(parse({}).success).toBe(true)
  })

  it.each(["1e3a5f", "#12345", "#1e3a5g", "#fff", "blue", "#1e3a5f00"])("rejects bad hex %s", (bad) => {
    expect(errorsOf({ brandColor: bad })?.brandColor).toBeDefined()
  })

  it.each(["javascript:alert(1)", "ftp://x.example/a.png", "data:image/png;base64,AAAA", "not a url", "//x.example/a.png"])(
    "rejects non-http logo %s",
    (bad) => {
      expect(errorsOf({ logoUrl: bad })?.logoUrl).toBeDefined()
    }
  )

  it("rejects a logo URL over 500 characters and accepts exactly 500", () => {
    const prefix = "https://x.example/"
    expect(errorsOf({ logoUrl: prefix + "a".repeat(500 - prefix.length + 1) })?.logoUrl).toBeDefined()
    expect(parse({ logoUrl: prefix + "a".repeat(500 - prefix.length) }).success).toBe(true)
  })

  it("keeps empty strings so they can clear the colour and logo", () => {
    const r = parse({ brandColor: "", logoUrl: "" })
    expect(r.success).toBe(true)
    expect(r.success && r.data).toEqual({ brandColor: "", logoUrl: "" })
  })

  it("rejects an empty name", () => {
    expect(errorsOf({ name: "   " })?.name).toBeDefined()
  })
})

describe("agency response shape", () => {
  it("returns only id, name, logo and brandColors, never the password", () => {
    const row = {
      id: "a1",
      name: "Acme",
      logo: null,
      brandColors: ["#1e3a5f"],
      password: "$2b$10$hash",
      email: "a@acme.example",
      role: "AGENCY",
    }
    const out = toAgencyBranding(row)
    expect(Object.keys(out).sort()).toEqual(["brandColors", "id", "logo", "name"])
    expect(JSON.stringify(out)).not.toContain("password")
    expect(JSON.stringify(out)).not.toContain("$2b$")
  })
})
