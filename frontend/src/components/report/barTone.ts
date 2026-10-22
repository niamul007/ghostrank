export type BarTone = "good" | "warn" | "bad"

/** Green high, amber mid, red low. */
export function toneForPct(pct: number): BarTone {
  if (pct >= 67) return "good"
  if (pct >= 34) return "warn"
  return "bad"
}

export const TONE_FILL: Record<BarTone, string> = {
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
}

export const TONE_STROKE: Record<BarTone, string> = {
  good: "stroke-good",
  warn: "stroke-warn",
  bad: "stroke-bad",
}

export const TONE_TEXT: Record<BarTone, string> = {
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
}
