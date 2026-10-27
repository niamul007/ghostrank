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
      { name: "Walkar Footwear", runs: 2 },
    ])
  })

  it.each([
    ["Cova", "Caffè Cova"],
    ["Marchesi 1824", "Pasticceria Marchesi 1824"],
    ["Lotto", "Lotto Bangladesh"],
    ["Walkar", "Walkar Footwear"],
  ])("merges %s into %s", (short, long) => {
    const result = agg([run(`1. ${short}\n2. ${long}`), run(`1. ${long}`)])
    expect(result.others).toEqual([{ name: long, runs: 2 }])
  })

  it("does not bridge: a short name contained by two longer names stays separate", () => {
    const result = agg([run("1. Bay Footwear\n2. Bay Leaf Cafe\n3. Bay")])
    expect(result.others.map((o) => o.name).sort()).toEqual(["Bay", "Bay Footwear", "Bay Leaf Cafe"])
  })

  it("counts a merged business once per run", () => {
    const result = agg([run("1. Cova\n2. Caffè Cova")])
    expect(result.others).toEqual([{ name: "Caffè Cova", runs: 1 }])
  })

  it("counts a business once per run even when listed twice", () => {
    const result = agg([run("1. Bata\n2. Apex\n3. Bata")])
    expect(result.others.find((o) => o.name === "Bata")?.runs).toBe(1)
  })

  it("merges British and American spellings, counting once per run even in the same answer", () => {
    const result = agg([
      run("1. Neighbourhood\n2. Neighborhood Coffee"),
      run("1. Neighborhood Coffee"),
    ])
    expect(result.others).toEqual([{ name: "Neighborhood Coffee", runs: 2 }])
  })

  it("shows the most frequent original spelling after a spelling fold", () => {
    const result = agg([run("1. Neighbourhood"), run("1. Neighbourhood"), run("1. Neighborhood")])
    expect(result.others).toEqual([{ name: "Neighbourhood", runs: 3 }])
  })

  it("keeps different businesses separate even when their spelling folds to a shared word", () => {
    const result = agg([run("1. Harbour Fish Market\n2. Harbor Bakery")])
    expect(result.others.map((o) => o.name).sort()).toEqual(["Harbor Bakery", "Harbour Fish Market"])
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
