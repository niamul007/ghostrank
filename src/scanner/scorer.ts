import { findMention } from "./matcher"

export interface ScanRun {
  questionId: string
  group: string
  scored: boolean
  status: string
  answer: string | null
}

export interface Tally {
  mentioned: number
  counted: number
}

export interface ScanScore {
  score: number | null
  countedRuns: number
  expectedRuns: number
  lowConfidence: boolean
  byGroup: { find: Tally; compare: Tally; need: Tally }
  perQuestion: Array<Tally & { questionId: string }>
  averagePosition: number | null
  reputation: Tally
}

const MIN_COVERAGE = 0.7

export function scoreScan({ runs, businessNames }: { runs: ScanRun[]; businessNames: string[] }): ScanScore {
  const byGroup = {
    find: { mentioned: 0, counted: 0 },
    compare: { mentioned: 0, counted: 0 },
    need: { mentioned: 0, counted: 0 },
  }
  const reputation: Tally = { mentioned: 0, counted: 0 }
  const questions = new Map<string, Tally>()
  const runsPerQuestion = new Map<string, number>()
  const positions: number[] = []
  let mentionedRuns = 0
  let countedRuns = 0

  for (const run of runs) {
    if (run.scored) {
      runsPerQuestion.set(run.questionId, (runsPerQuestion.get(run.questionId) ?? 0) + 1)
      if (!questions.has(run.questionId)) questions.set(run.questionId, { mentioned: 0, counted: 0 })
    }
    if (run.status !== "SUCCESS") continue

    const mention = findMention(run.answer ?? "", businessNames)
    if (!run.scored) {
      reputation.counted++
      if (mention.mentioned) reputation.mentioned++
      continue
    }

    countedRuns++
    const q = questions.get(run.questionId)!
    q.counted++
    const g = byGroup[run.group as keyof typeof byGroup]
    if (g) g.counted++
    if (mention.mentioned) {
      mentionedRuns++
      q.mentioned++
      if (g) g.mentioned++
      if (mention.position !== null) positions.push(mention.position)
    }
  }

  const perQuestionRuns = Math.max(0, ...runsPerQuestion.values())
  const expectedRuns = questions.size * perQuestionRuns

  return {
    score: countedRuns === 0 ? null : Math.round((mentionedRuns / countedRuns) * 100),
    countedRuns,
    expectedRuns,
    lowConfidence: countedRuns === 0 || countedRuns < MIN_COVERAGE * expectedRuns,
    byGroup,
    perQuestion: [...questions].map(([questionId, t]) => ({ questionId, ...t })),
    averagePosition: positions.length === 0 ? null : positions.reduce((a, b) => a + b, 0) / positions.length,
    reputation,
  }
}
