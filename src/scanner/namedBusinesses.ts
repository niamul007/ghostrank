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

const GENERIC_WORDS = new Set([
  "cafe",
  "caffe",
  "coffee",
  "bar",
  "pasticceria",
  "restaurant",
  "ristorante",
  "shop",
  "the",
  "di",
  "da",
  "and",
  "of",
])

function coreWords(key: string): string[] {
  const words = key.split(" ")
  const core = words.filter((w) => !GENERIC_WORDS.has(w))
  return core.length > 0 ? core : words
}

function isContiguousRun(shorter: string[], longer: string[]): boolean {
  for (let i = 0; i + shorter.length <= longer.length; i++) {
    if (shorter.every((w, j) => w === longer[i + j])) return true
  }
  return false
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

  // Keys with the same core are one entry; a shorter core merges into a longer
  // one only when exactly one longer core contains it (no chaining).
  const keys = [...spellings.keys()]
  const entryOf = new Map<string, string>()
  const entryWords = new Map<string, string[]>()
  for (const key of keys) {
    const words = coreWords(key)
    const id = words.join(" ")
    entryOf.set(key, id)
    entryWords.set(id, words)
  }
  const target = new Map<string, string>()
  for (const [id, words] of entryWords) {
    const containers = [...entryWords].filter(
      ([otherId, other]) =>
        otherId !== id && other.length > words.length && isContiguousRun(words, other),
    )
    target.set(id, containers.length === 1 ? containers[0][0] : id)
  }
  const find = (k: string): string => target.get(entryOf.get(k)!)!

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
    const name = [...g.spellings].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))[0][0]
    return { name, runs: g.runs }
  })
  others.sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))

  return {
    others,
    chosenCompetitors: [...chosenRuns].map(([name, runs]) => ({ name, runs })),
    totalCountedRuns: counted.length,
  }
}
