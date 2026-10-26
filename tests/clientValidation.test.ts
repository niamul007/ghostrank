import { describe, it, expect } from "vitest"
import { createClientSchema, updateClientSchema } from "../src/schemas/client.schema"

const validClient = {
  businessName: "Acme",
  city: "Dhaka",
  niche: "Shoe store",
  location: "Dhaka",
  website: "https://acme.example",
}

const errorsOf = (input: object) => {
  const r = createClientSchema.safeParse(input)
  return r.success ? null : r.error.flatten().fieldErrors
}

describe("client business details validation", () => {
  it("accepts a valid client", () => {
    expect(createClientSchema.safeParse(validClient).success).toBe(true)
  })

  it("accepts a create without location", () => {
    const { location: _l, ...rest } = validClient
    const r = createClientSchema.safeParse(rest)
    expect(r.success).toBe(true)
    expect(r.success && r.data.location).toBeUndefined()
  })

  it("treats a blank location as not provided", () => {
    const r = createClientSchema.safeParse({ ...validClient, location: "   " })
    expect(r.success).toBe(true)
    expect(r.success && r.data.location).toBeUndefined()
  })

  it("still rejects an invalid location", () => {
    expect(errorsOf({ ...validClient, location: "D" })?.location).toBeDefined()
    expect(errorsOf({ ...validClient, location: "x".repeat(201) })?.location).toBeDefined()
  })

  it("trims a given location", () => {
    const r = createClientSchema.parse({ ...validClient, location: "  Gulshan " })
    expect(r.location).toBe("Gulshan")
  })

  it("rejects a missing or blank city", () => {
    const { city: _city, ...rest } = validClient
    expect(errorsOf(rest)?.city).toBeDefined()
    expect(errorsOf({ ...validClient, city: "  " })?.city).toBeDefined()
  })

  it("rejects when no website, facebook or maps link is given", () => {
    const { website: _w, ...rest } = validClient
    expect(errorsOf(rest)?.website).toBeDefined()
    expect(errorsOf({ ...rest, website: "   " })?.website).toBeDefined()
  })

  it("accepts any single link", () => {
    const { website: _w, ...rest } = validClient
    expect(createClientSchema.safeParse({ ...rest, facebookUrl: "https://facebook.com/acme" }).success).toBe(true)
    expect(createClientSchema.safeParse({ ...rest, mapsUrl: "https://maps.google.com/?q=acme" }).success).toBe(true)
  })

  it("rejects bad URLs", () => {
    expect(errorsOf({ ...validClient, website: "not a url" })?.website).toBeDefined()
    expect(errorsOf({ ...validClient, website: "ftp://acme.example" })?.website).toBeDefined()
    expect(errorsOf({ ...validClient, website: "javascript:alert(1)" })?.website).toBeDefined()
    expect(errorsOf({ ...validClient, facebookUrl: "facebook.com/acme" })?.facebookUrl).toBeDefined()
  })

  it("rejects too many list items", () => {
    expect(errorsOf({ ...validClient, knownFor: ["a", "b", "c", "d"] })?.knownFor).toBeDefined()
    expect(errorsOf({ ...validClient, competitors: ["a", "b", "c", "d"] })?.competitors).toBeDefined()
    expect(errorsOf({ ...validClient, nameVariants: ["a", "b", "c", "d", "e", "f"] })?.nameVariants).toBeDefined()
    expect(createClientSchema.safeParse({ ...validClient, nameVariants: ["a", "b", "c", "d", "e"] }).success).toBe(true)
  })

  it("rejects list items longer than 80 characters", () => {
    expect(errorsOf({ ...validClient, knownFor: ["x".repeat(81)] })?.knownFor).toBeDefined()
    expect(createClientSchema.safeParse({ ...validClient, knownFor: ["x".repeat(80)] }).success).toBe(true)
  })

  it("trims items, drops empty ones and counts only what remains", () => {
    const r = createClientSchema.parse({
      ...validClient,
      knownFor: ["  tacos ", "", "   ", "burgers"],
      competitors: [" Rival A ", "Rival B", "Rival C", "  "],
      website: " https://acme.example ",
    })
    expect(r.knownFor).toEqual(["tacos", "burgers"])
    expect(r.competitors).toEqual(["Rival A", "Rival B", "Rival C"])
    expect(r.website).toBe("https://acme.example")
  })

  it("validates the new fields on update but keeps them optional", () => {
    expect(updateClientSchema.safeParse({}).success).toBe(true)
    expect(updateClientSchema.safeParse({ website: "nope" }).success).toBe(false)
    expect(updateClientSchema.safeParse({ city: " " }).success).toBe(false)
    expect(updateClientSchema.parse({ knownFor: [" a ", ""] })).toEqual({ knownFor: ["a"] })
  })

  it("treats a blank link on update as cleared (null) and leaves omitted fields out", () => {
    const r = updateClientSchema.parse({ website: "", facebookUrl: "  ", mapsUrl: "https://maps.example/x" })
    expect(r.website).toBeNull()
    expect(r.facebookUrl).toBeNull()
    expect(r.mapsUrl).toBe("https://maps.example/x")
    expect("website" in updateClientSchema.parse({ mapsUrl: "https://maps.example/x" })).toBe(false)
    expect(updateClientSchema.safeParse({ website: "nope" }).success).toBe(false)
  })
})
