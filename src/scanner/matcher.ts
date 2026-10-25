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
  const competitors = normalizeNames(competitorNames)
  return listed.map((l) => {
    const p = pad(l.name)
    const kind: ListedKind = business.some((n) => containsName(p, n))
      ? "client"
      : competitors.some((n) => containsName(p, n))
        ? "chosen-competitor"
        : "other"
    return { ...l, kind }
  })
}
