import { getScoreLabel, getScoreTone } from "../lib/reportPresentation"

const TONE_TEXT: Record<string, string> = {
  good: "text-good",
  accent: "text-accent",
  warn: "text-warn",
  bad: "text-bad",
}

const TONE_BAR: Record<string, string> = {
  good: "bg-good",
  accent: "bg-accent",
  warn: "bg-warn",
  bad: "bg-bad",
}

/** Compact score readout — big number, thin meter, optional label. */
export function ScoreMeter({
  score,
  size = "md",
  showLabel = true,
}: {
  score: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}) {
  const tone = getScoreTone(score)
  const numberClass = size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-xl"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono font-semibold tabular-nums ${numberClass} ${TONE_TEXT[tone]}`}>
          {Math.round(score)}
        </span>
        <span className="text-xs text-text-faint font-mono">/100</span>
      </div>
      <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-surface-2 border border-border-soft">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${TONE_BAR[tone]}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      {showLabel ? <p className="text-xs text-text-dim">{getScoreLabel(score)}</p> : null}
    </div>
  )
}
