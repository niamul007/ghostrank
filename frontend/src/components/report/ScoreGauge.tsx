import { useMounted } from "../../hooks/useMounted"
import { TONE_STROKE, TONE_TEXT, toneForPct } from "./barTone"

const R = 52
const CIRC = 2 * Math.PI * R

/** Circular SVG gauge: score in the middle, label underneath. */
export function ScoreGauge({ score, label }: { score: number; label: string }) {
  const mounted = useMounted()
  const pct = Math.min(100, Math.max(0, score))
  const tone = toneForPct(pct)

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative h-36 w-36">
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`Score ${Math.round(score)} out of 100`}
        >
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" className="stroke-surface-2" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={mounted ? CIRC * (1 - pct / 100) : CIRC}
            className={`transition-[stroke-dashoffset] duration-1000 ease-out ${TONE_STROKE[tone]}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-mono text-4xl font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
            {Math.round(score)}
          </span>
          <span className="font-mono text-[11px] text-text-faint">/100</span>
        </div>
      </div>
      <p className="max-w-52 text-xs text-text-dim">{label}</p>
    </div>
  )
}
