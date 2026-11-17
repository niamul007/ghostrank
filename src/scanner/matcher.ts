export interface Mention {
  mentioned: boolean
  matchedName: string | null
  position: number | null
}

export interface ListedName {
  position: number
  name: string
}

export type ListedKind = "client" | "chosen-competitor" | "other"

export interface ClassifiedListed extends ListedName {
  kind: ListedKind
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/&/g, " and ")
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const COMPANY_SUFFIXES = new Set(["co", "company", "inc", "llc", "ltd"])

// Looser key used ONLY to match chosen competitors against listed names.
// A trailing company suffix is dropped only if at least 2 words remain.
export function competitorKey(name: string): string {
  let words = normalize(name).split(" ").filter(Boolean)
  if (words.length > 1 && words[0] === "the") words = words.slice(1)
  while (words.length > 2 && COMPANY_SUFFIXES.has(words[words.length - 1])) {
    words = words.slice(0, -1)
  }
  return words.map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)).join(" ")
}

function competitorKeys(names: string[]): string[] {
  const out = new Set<string>()
  for (const n of names) {
    const key = competitorKey(n)
    if (key.length >= 2) out.add(key)
  }
  return [...out]
}

function normalizeNames(names: string[]): string[] {
  const out = new Set<string>()
  for (const n of names) {
    const norm = normalize(n)
    if (norm.length >= 2) out.add(norm)
  }
  return [...out]
}

function containsName(paddedText: string, normName: string): boolean {
  return paddedText.includes(` ${normName} `)
}

function pad(text: string): string {
  return ` ${normalize(text)} `
}

export function extractListedNames(answer: string): ListedName[] {
  const listed: ListedName[] = []
  for (const line of answer.replace(/\*\*/g, "").split(/\r?\n/)) {
    const m = line.match(/^\s*(\d+)[.)]\s+(.+)$/)
    if (!m) continue
    const name = m[2].split(/\s[—–-]\s|:|\(/)[0].trim()
    if (name) listed.push({ position: Number(m[1]), name })
  }
  return listed
}

export function findMention(answer: string, names: string[]): Mention {
  const normNames = normalizeNames(names)
  const padded = pad(answer)
  const matchedName = normNames.find((n) => containsName(padded, n)) ?? null
  if (!matchedName) return { mentioned: false, matchedName: null, position: null }

  const entry = extractListedNames(answer).find((l) => {
    const p = pad(l.name)
    return normNames.some((n) => containsName(p, n))
  })
  return { mentioned: true, matchedName, position: entry ? entry.position : null }
}

export function classifyListed(
  listed: ListedName[],
  businessNames: string[],
  competitorNames: string[],
): ClassifiedListed[] {
  const business = normalizeNames(businessNames)
  const competitors = competitorKeys(competitorNames)
  return listed.map((l) => {
    const p = pad(l.name)
    const pc = ` ${competitorKey(l.name)} `
    const kind: ListedKind = business.some((n) => containsName(p, n))
      ? "client"
      : competitors.some((n) => containsName(pc, n))
        ? "chosen-competitor"
        : "other"
    return { ...l, kind }
  })
}
