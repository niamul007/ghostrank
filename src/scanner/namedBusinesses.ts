import { classifyListed, extractListedNames, normalize } from "./matcher"

export interface NamedRun {
  scored: boolean
  status: string
  answer: string | null
}

export interface NamedCount {
  name: string
  runs: number
}

export interface NamedBusinesses {
  others: NamedCount[]
  chosenCompetitors: NamedCount[]
  totalCountedRuns: number
}

function isWordPrefix(shorter: string[], longer: string[]): boolean {
  return shorter.length <= longer.length && shorter.every((w, i) => w === longer[i])
}

export function aggregateNamedBusinesses({
  runs,
  businessNames,
  competitorNames,
}: {
  runs: NamedRun[]
  businessNames: string[]
  competitorNames: string[]
}): NamedBusinesses {
  const counted = runs.filter((r) => r.scored && r.status === "SUCCESS")

  // Per run, the distinct normalized "other" names (with their spelling)
  const perRun: Array<Map<string, string>> = []
  const spellings = new Map<string, Map<string, number>>()
  const chosenRuns = new Map<string, number>(competitorNames.map((c) => [c, 0]))

  for (const run of counted) {
    const listed = extractListedNames(run.answer ?? "")

    const seen = new Map<string, string>()
    for (const item of classifyListed(listed, businessNames, competitorNames)) {
      if (item.kind !== "other") continue
      const key = normalize(item.name)
      if (!key || seen.has(key)) continue
      seen.set(key, item.name)
      const counts = spellings.get(key) ?? new Map<string, number>()
      counts.set(item.name, (counts.get(item.name) ?? 0) + 1)
      spellings.set(key, counts)
    }
    perRun.push(seen)

    for (const competitor of competitorNames) {
      const named = classifyListed(listed, businessNames, [competitor]).some(
        (l) => l.kind === "chosen-competitor",
      )
      if (named) chosenRuns.set(competitor, (chosenRuns.get(competitor) ?? 0) + 1)
    }
  }

  // Merge keys that are word-prefixes of each other (union-find)
  const keys = [...spellings.keys()]
  const words = new Map(keys.map((k) => [k, k.split(" ")]))
  const parent = new Map(keys.map((k) => [k, k]))
  const find = (k: string): string => {
    let root = k
    while (parent.get(root) !== root) root = parent.get(root)!
    return root
  }
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = words.get(keys[i])!
      const b = words.get(keys[j])!
      if (isWordPrefix(a, b) || isWordPrefix(b, a)) parent.set(find(keys[i]), find(keys[j]))
    }
  }

  const groups = new Map<string, { runs: number; spellings: Map<string, number> }>()
  for (const key of keys) {
    const root = find(key)
    const group = groups.get(root) ?? { runs: 0, spellings: new Map<string, number>() }
    for (const [spelling, n] of spellings.get(key)!) {
      group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + n)
    }
    groups.set(root, group)
  }
  for (const seen of perRun) {
    const hit = new Set<string>()
    for (const key of seen.keys()) hit.add(find(key))
    for (const root of hit) groups.get(root)!.runs++
  }

  const others = [...groups.values()].map((g) => {
    const name = [...g.spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
    return { name, runs: g.runs }
  })
  others.sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))

  return {
    others,
    chosenCompetitors: [...chosenRuns].map(([name, runs]) => ({ name, runs })),
    totalCountedRuns: counted.length,
  }
}
