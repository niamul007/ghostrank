import { nichePhrase } from "./nichePhrases"

export const QUESTION_SET_VERSION = "v2"

export type QuestionGroup = "find" | "compare" | "need" | "reputation"

export interface Question {
  id: string
  group: QuestionGroup
  text: string
  scored: boolean
}

export interface QuestionInput {
  businessName: string
  city?: string | null
  location?: string | null
  niche: string
  nameVariants?: string[] | null
  knownFor?: string[] | null
  competitors?: string[] | null
}

const GENERIC_NEEDS = ["good value for money", "excellent customer reviews"]

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function fill(template: string, values: Record<string, string>): string {
  return clean(template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? ""))
}

// Names shorter than 2 characters are ignored so they cannot match everything.
function blockedNames(input: QuestionInput): string[] {
  return [input.businessName, ...(input.nameVariants ?? []), ...(input.competitors ?? [])]
    .map((n) => clean(String(n ?? "")).toLowerCase())
    .filter((n) => n.length >= 2)
}

function pickNeeds(knownFor: string[], blocked: string[]): string[] {
  const needs: string[] = []
  const seen = new Set<string>()
  const candidates = [
    ...knownFor.map((raw) => ({ raw, generic: false })),
    ...GENERIC_NEEDS.map((raw) => ({ raw, generic: true })),
  ]
  for (const { raw, generic } of candidates) {
    const need = clean(String(raw ?? "")).toLowerCase()
    if (!need || seen.has(need)) continue
    if (!generic && blocked.some((n) => need.includes(n))) continue
    seen.add(need)
    needs.push(need)
    if (needs.length === 2) break
  }
  return needs
}

// Deterministic: same input, same 8 questions in the same order.
// nameVariants and competitors never appear in a question; knownFor items
// that contain one of them (or the business name) are skipped.
export function buildQuestions(input: QuestionInput): Question[] {
  const area = (input.city ?? "").trim() || (input.location ?? "").trim()
  if (!area) throw new Error("Cannot build questions: the business has no city or location")
  const { singular, plural } = nichePhrase(input.niche)
  const [need1, need2] = pickNeeds(input.knownFor ?? [], blockedNames(input))
  const base = { singular, plural, area }

  const q = (id: string, group: QuestionGroup, template: string, extra: Record<string, string> = {}): Question => ({
    id,
    group,
    text: fill(template, { ...base, ...extra }),
    scored: group !== "reputation",
  })

  const needTemplate = "Which {plural} in {area} are best known for {need}?"

  return [
    q("find-1", "find", "What is the best {singular} in {area}?"),
    q("find-2", "find", "Can you recommend a good {singular} in {area}?"),
    q("find-3", "find", "I'm looking for a reliable {singular} near {area}. Any suggestions?"),
    q("compare-1", "compare", "Compare the top {plural} in {area}."),
    q("compare-2", "compare", "Which {plural} in {area} are worth visiting, and how do they differ?"),
    q("need-1", "need", needTemplate, { need: need1 }),
    q("need-2", "need", needTemplate, { need: need2 }),
    q("reputation-1", "reputation", "What do people say about {name} in {area}?", { name: clean(input.businessName) }),
  ]
}
