import { describe, it, expect } from "vitest"
import { aggregateNamedBusinesses, type NamedRun } from "../src/scanner/namedBusinesses"

const run = (answer: string, over: Partial<NamedRun> = {}): NamedRun => ({
  scored: true,
  status: "SUCCESS",
  answer,
  ...over,
})

const agg = (runs: NamedRun[], competitorNames: string[] = []) =>
  aggregateNamedBusinesses({ runs, businessNames: ["Acme Shoes"], competitorNames })

describe("aggregateNamedBusinesses", () => {
  it("merges word-prefix variants, shows the most frequent spelling, counts once per run", () => {
    const result = agg([
      run("1. Lotto Bangladesh\n2. Walkar"),
      run("1. Lotto\n2. Lotto Bangladesh"),
      run("1. Lotto Bangladesh\n2. Walkar Footwear"),
    ])
    expect(result.others).toEqual([
      { name: "Lotto Bangladesh", runs: 3 },
      { name: "Walkar", runs: 2 },
    ])
  })

  it("counts a business once per run even when listed twice", () => {
    const result = agg([run("1. Bata\n2. Apex\n3. Bata")])
    expect(result.others.find((o) => o.name === "Bata")?.runs).toBe(1)
  })

  it("excludes unscored (reputation) runs and failed runs", () => {
    const result = agg([
      run("1. Common complaints\n2. Bata", { scored: false }),
      run("1. Apex", { status: "FAILED" }),
      run("1. Bata"),
    ])
    expect(result.totalCountedRuns).toBe(1)
    expect(result.others).toEqual([{ name: "Bata", runs: 1 }])
  })

  it("does not count a 'Common complaints' item from a reputation run", () => {
    const result = agg([run("1. Common complaints", { scored: false }), run("1. Bata")])
    expect(result.others.map((o) => o.name)).not.toContain("Common complaints")
  })

  it("lists a chosen competitor with 0 runs, and excludes it from others", () => {
    const result = agg([run("1. Bata\n2. Rival Pipes"), run("1. Bata")], ["Rival Pipes", "Ghost Co"])
    expect(result.chosenCompetitors).toEqual([
      { name: "Rival Pipes", runs: 1 },
      { name: "Ghost Co", runs: 0 },
    ])
    expect(result.others.map((o) => o.name)).toEqual(["Bata"])
  })

  it("sorts by runs desc then name", () => {
    const result = agg([run("1. Zed\n2. Alpha\n3. Mid"), run("1. Mid")])
    expect(result.others.map((o) => o.name)).toEqual(["Mid", "Alpha", "Zed"])
  })
})
