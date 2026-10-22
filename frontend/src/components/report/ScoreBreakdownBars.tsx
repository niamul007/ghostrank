import type { ScoreBreakdown } from "../../types"
import { BarRow } from "./BarRow"

const ROWS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "mentionRate", label: "Mentions" },
  { key: "position", label: "Position" },
  { key: "coverage", label: "Coverage" },
  { key: "sentiment", label: "Sentiment" },
]

export function ScoreBreakdownBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="flex w-full flex-col gap-4 pt-6">
      {ROWS.map(({ key, label }) => {
        const part = breakdown[key]
        if (!part) return null
        return (
          <BarRow
            key={key}
            label={label}
            value={part.earned}
            max={part.max}
            readout={`${part.earned}/${part.max}`}
            tooltip={`${label}: ${part.earned} of ${part.max} points`}
          />
        )
      })}
    </div>
  )
}
