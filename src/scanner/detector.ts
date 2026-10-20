// ──────────────────────────────────────────
// GhostRank — Fuzzy Business Detector
// ──────────────────────────────────────────
// Detection happens HERE, in code, against the AI's actual response text —
// never by asking the AI to grade itself. The AI (see AI_SYSTEM_PROMPT in
// ../config/ai.config.ts) just answers naturally, like it would for a real
// customer; this module is the only thing that decides whether the
// business was actually mentioned.
//
// Why fuzzy matching instead of exact string search?
// A real reader recognizes "Sunderban Tours" as the same business as
// "Sundarban Tour Service" despite the spelling drift and dropped word.
// Exact matching would call that a miss. We score similarity instead of
// checking equality, so minor spelling variation, spacing, and partial
// names are still caught — the same way a human skimming the answer would
// read it.
//
// Provider-agnostic by design: everything here operates on plain response
// text, so it works identically whether that text came from Claude,
// ChatGPT, Perplexity, or Gemini.

import type { MatchStrength } from "../types"

// ──────────────────────────────────────────
// Text normalization
// ──────────────────────────────────────────

/**
 * Lowercases, strips punctuation (keeps letters/digits/spaces), and
 * collapses whitespace. Two names that only differ by case, an ampersand
 * vs "and", or extra spacing normalize to the same thing before scoring.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// ──────────────────────────────────────────
// Levenshtein similarity
// ──────────────────────────────────────────

/**
 * Classic edit-distance DP — minimum single-character insertions,
 * deletions, and substitutions to turn `a` into `b`. O(a.length * b.length),
 * fine here since we're always comparing short strings (business names and
 * short word-windows, not whole documents).
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prevRow = new Array<number>(n + 1)
  let currRow = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prevRow[j] = j

  for (let i = 1; i <= m; i++) {
    currRow[0] = i
    for (let j = 1; j <= n; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + substitutionCost // substitution
      )
    }
    ;[prevRow, currRow] = [currRow, prevRow]
  }

  return prevRow[n]
}

/**
 * Edit-distance similarity normalized to 0..1 (1 = identical).
 * Inputs should already be normalize()d.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

// ──────────────────────────────────────────
// Tokenization (keeps original character offsets for context extraction)
// ──────────────────────────────────────────

interface Token {
  text: string
  start: number
  end: number
}

/** Words in their ORIGINAL casing/position — offsets point into the un-normalized source text. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const re = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length })
  }
  return tokens
}

// ──────────────────────────────────────────
// Fuzzy business-name matching
// ──────────────────────────────────────────

/** score >= EXACT_THRESHOLD: same business, allowing for case/punctuation only. */
const EXACT_THRESHOLD = 0.92
/** score >= FUZZY_THRESHOLD: close enough to be the same business with typos/wording drift. */
const FUZZY_THRESHOLD = 0.72

function classifyMatch(score: number): MatchStrength {
  if (score >= EXACT_THRESHOLD) return "exact"
  if (score >= FUZZY_THRESHOLD) return "fuzzy"
  return "none"
}

/**
 * Generic business-type words. A word in here still counts, just at a
 * fraction of the weight of a distinctive word — an AI dropping "Service"
 * from "Sundarban Tour Service" shouldn't tank the match score nearly as
 * much as it garbling "Sundarban" would.
 */
const GENERIC_WORDS = new Set([
  "the", "and", "of", "in", "at", "by", "for", "a", "an",
  "llc", "inc", "co", "ltd", "corp", "company",
  "clinic", "studio", "agency", "shop", "store", "center", "centre",
  "group", "service", "services", "solutions",
])

const GENERIC_WORD_WEIGHT = 0.3
const SIGNIFICANT_WORD_WEIGHT = 1

interface WeightedWord {
  word: string
  weight: number
}

/**
 * Weights each business-name word by how distinctive it is. If literally
 * every word is generic (a business named something like "The Service"),
 * downweighting all of them would leave nothing to discriminate on, so
 * that degenerate case falls back to weighting every word equally.
 */
function weighBusinessWords(businessName: string): WeightedWord[] {
  const words = tokenize(businessName).map((t) => t.text.toLowerCase())
  const weighted = words.map((word) => ({
    word,
    weight:
      GENERIC_WORDS.has(word) || word.length <= 2 ? GENERIC_WORD_WEIGHT : SIGNIFICANT_WORD_WEIGHT,
  }))

  if (weighted.every((w) => w.weight < SIGNIFICANT_WORD_WEIGHT)) {
    return weighted.map((w) => ({ ...w, weight: SIGNIFICANT_WORD_WEIGHT }))
  }
  return weighted
}

/**
 * Scores a window of response words against the weighted business-name
 * words: each business word contributes its best per-word similarity
 * against ANY word in the window, weighted by distinctiveness, then
 * averaged. This is what makes a dropped generic word ("Service") cost
 * little while a garbled distinctive word ("Sundarban" -> "Sunderban")
 * still scores highly via its own per-word edit-distance similarity —
 * whole-phrase edit distance would instead penalize the dropped word by
 * its full character length, which sinks scores for names an AI
 * paraphrases or trims, not just misspells.
 */
function scoreWindow(businessWords: WeightedWord[], windowWords: string[]): number {
  let weightedSum = 0
  let totalWeight = 0

  for (const { word, weight } of businessWords) {
    let best = 0
    for (const candidate of windowWords) {
      const sim = similarity(word, candidate)
      if (sim > best) best = sim
    }
    weightedSum += best * weight
    totalWeight += weight
  }

  return totalWeight === 0 ? 0 : weightedSum / totalWeight
}

const SCORE_EPSILON = 1e-9

/**
 * Index range (inclusive) of the window words that matched a business word:
 * for each business word, its most similar window word, kept only if it is
 * at least a fuzzy match. If nothing qualifies, falls back to the single
 * most similar word so the range is never empty.
 */
function matchedTokenRange(
  businessWords: WeightedWord[],
  windowWords: string[]
): { first: number; last: number } {
  let first = Infinity
  let last = -1
  let fallbackIndex = 0
  let fallbackSim = -1

  for (const { word } of businessWords) {
    let bestIndex = 0
    let bestSim = -1
    for (let j = 0; j < windowWords.length; j++) {
      const sim = similarity(word, windowWords[j]!)
      if (sim > bestSim) {
        bestSim = sim
        bestIndex = j
      }
    }
    if (bestSim >= FUZZY_THRESHOLD) {
      first = Math.min(first, bestIndex)
      last = Math.max(last, bestIndex)
    }
    if (bestSim > fallbackSim) {
      fallbackSim = bestSim
      fallbackIndex = bestIndex
    }
  }

  return last === -1 ? { first: fallbackIndex, last: fallbackIndex } : { first, last }
}

export interface MatchCandidate {
  strength: MatchStrength
  /** 0..1 similarity score of the best-matching window against the business name. */
  score: number
  /** The actual substring of the response that matched, in its original casing. */
  matchedText: string
  /** Character offsets into the original response text — used for context extraction. */
  start: number
  end: number
}

/**
 * Slides a word-window across the response (sized to the business name's
 * own word count plus a little slack) and scores each position via
 * scoreWindow(). Returns the single best-scoring window, or null if the
 * response has no words at all.
 *
 * This is deliberately a window search rather than scoring the whole
 * response at once — a business name is usually a few words inside a much
 * longer answer, so we need "does this phrase fuzzy-appear anywhere in
 * this text, and where", not just a single yes/no similarity number.
 * Sliding through every start position makes the result self-correcting
 * against misalignment — a window that happens to split the real mention
 * in half scores lower than the one that captures it cleanly, so the max
 * naturally lands on the best-aligned window.
 */
export function findBestMatch(responseText: string, businessName: string): MatchCandidate | null {
  const responseTokens = tokenize(responseText)
  const businessWords = weighBusinessWords(businessName)
  if (businessWords.length === 0 || responseTokens.length === 0) return null

  const windowSize = Math.min(responseTokens.length, businessWords.length + 2)

  let best: MatchCandidate | null = null

  for (let i = 0; i + windowSize <= responseTokens.length; i++) {
    const windowTokens = responseTokens.slice(i, i + windowSize)
    const windowWords = windowTokens.map((t) => t.text.toLowerCase())
    const score = scoreWindow(businessWords, windowWords)

    // Narrow the window to the tokens that actually matched a business
    // word, so slack tokens (e.g. the end of the previous list item) never
    // end up inside the reported match.
    const { first, last } = matchedTokenRange(businessWords, windowWords)
    const start = windowTokens[first]!.start
    const end = windowTokens[last]!.end

    // Ties go to the narrowest span; strict comparisons keep the earliest.
    const better =
      !best ||
      score > best.score + SCORE_EPSILON ||
      (Math.abs(score - best.score) <= SCORE_EPSILON && end - start < best.end - best.start)

    if (better) {
      best = {
        strength: classifyMatch(score),
        score,
        matchedText: responseText.slice(start, end),
        start,
        end,
      }
    }
  }

  return best
}

// ──────────────────────────────────────────
// Context extraction
// ──────────────────────────────────────────

interface Sentence {
  text: string
  start: number
  end: number
}

/**
 * Splits on sentence-ending punctuation, keeping offsets into the original
 * text (shifted by `offset` when `text` is a slice of a larger string). A
 * leading list marker ("1.", "2)", "-", "*", "#") is never a sentence end.
 */
function splitSentences(text: string, offset = 0): Sentence[] {
  const sentences: Sentence[] = []
  const re = /(?:^[ \t]*(?:\d+[.)]|[-*#]+)[ \t]*)?[^.!?]+(?:[.!?]+|$)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match[0].trim().length === 0) continue
    sentences.push({
      text: match[0],
      start: offset + match.index,
      end: offset + match.index + match[0].length,
    })
  }
  return sentences
}

const MAX_LINE_CONTEXT = 300

/**
 * Pulls the sentence containing the match so callers can see HOW the
 * business was mentioned (praised, just listed, warned against, etc.)
 * without analyzing the whole response — a competitor praised in the
 * opening line shouldn't bleed into our client's sentiment.
 */
export function extractContext(responseText: string, match: MatchCandidate): string {
  // Lists: a numbered/bulleted item is the unit of context, not the "1."
  // that sentence splitting would otherwise cut it down to.
  let sentenceSource = responseText
  let sentenceOffset = 0
  if (responseText.includes("\n")) {
    const lineStart = responseText.lastIndexOf("\n", match.start - 1) + 1
    const nextBreak = responseText.indexOf("\n", match.start)
    const lineEnd = nextBreak === -1 ? responseText.length : nextBreak
    const line = responseText.slice(lineStart, lineEnd).trim()
    if (line.length > 0 && line.length <= MAX_LINE_CONTEXT) return line
    sentenceSource = responseText.slice(lineStart, lineEnd)
    sentenceOffset = lineStart
  }

  const sentences = splitSentences(sentenceSource, sentenceOffset)
  const containing = sentences.find((s) => match.start >= s.start && match.start < s.end)

  if (containing) {
    const trimmed = containing.text.trim()
    if (trimmed.length > 0) return trimmed
  }

  // Fallback if sentence splitting didn't find a clean boundary (e.g. the
  // match spans a sentence break) — grab a character radius instead.
  const start = Math.max(0, match.start - 100)
  const end = Math.min(responseText.length, match.end + 100)
  return responseText.slice(start, end).trim()
}

// ──────────────────────────────────────────
// Alternative business extraction (best-effort heuristic)
// ──────────────────────────────────────────

/**
 * Looks for consecutive-capitalized-word phrases ("Bright Smile Dental",
 * "Miami Family Dentistry") as candidate business names mentioned instead
 * of the client's own. This is a plain-text heuristic, not real named-
 * entity recognition — it will also catch things like multi-word place
 * names or a sentence-initial capitalized phrase. Treat results as
 * suggestive, not authoritative; see the report note on upgrading this to
 * a dedicated lightweight extraction call if false positives are a problem.
 */
export function extractAlternatives(
  responseText: string,
  businessName: string,
  maxResults = 5
): string[] {
  const re = /\b[A-Z][a-zA-Z'&-]*(?:\s+[A-Z][a-zA-Z'&-]*){1,3}\b/g
  const businessWords = weighBusinessWords(businessName)
  const seen = new Set<string>()
  const results: string[] = []

  let match: RegExpExecArray | null
  while ((match = re.exec(responseText)) !== null && results.length < maxResults) {
    const phrase = match[0].trim()
    const key = normalize(phrase)
    if (!key || seen.has(key)) continue
    seen.add(key)

    // Skip anything that fuzzy-matches the client's own business name —
    // same scoring as findBestMatch, so a typo'd re-mention of the target
    // ("Sunderban Tours" for "Sundarban Tour Service") doesn't also show
    // up as an "alternative" to itself. Using the plain whole-phrase
    // similarity() here instead would miss that, for the same reason it
    // under-scored the primary match before word-weighting was added.
    const candidateWords = key.split(" ")
    if (classifyMatch(scoreWindow(businessWords, candidateWords)) !== "none") continue

    results.push(phrase)
  }

  return results
}
