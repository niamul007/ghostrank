import { describe, it, expect } from "vitest"
import { resultingLinks, hasAnyLink } from "../src/utils/resultingLinks"

const all = {
  website: "https://a.example",
  facebookUrl: "https://facebook.com/a",
  mapsUrl: "https://maps.example/a",
}

describe("resultingLinks", () => {
  it("keeps stored values for omitted fields", () => {
    expect(resultingLinks(all, {})).toEqual(all)
  })

  it("clearing one of three keeps going", () => {
    const r = resultingLinks(all, { website: "" })
    expect(r.website).toBeNull()
    expect(hasAnyLink(r)).toBe(true)
  })

  it("treats null as cleared", () => {
    expect(resultingLinks(all, { mapsUrl: null }).mapsUrl).toBeNull()
  })

  it("clearing the last link leaves none", () => {
    const only = { website: "https://a.example", facebookUrl: null, mapsUrl: null }
    expect(hasAnyLink(resultingLinks(only, { website: "" }))).toBe(false)
  })

  it("clearing one while adding another in the same request works", () => {
    const only = { website: "https://a.example", facebookUrl: null, mapsUrl: null }
    const r = resultingLinks(only, { website: "", mapsUrl: "https://maps.example/b" })
    expect(r).toEqual({ website: null, facebookUrl: null, mapsUrl: "https://maps.example/b" })
    expect(hasAnyLink(r)).toBe(true)
  })

  it("an update that omits everything on a linkless client still has none", () => {
    expect(hasAnyLink(resultingLinks({}, {}))).toBe(false)
  })
})
