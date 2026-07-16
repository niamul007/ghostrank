import type { ReactNode } from "react"

export type Tone = "good" | "warn" | "bad" | "accent" | "neutral"

const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-surface-2 text-text-faint",
}

export function Badge({
  tone = "neutral",
  children,
  pulse = false,
}: {
  tone?: Tone
  children: ReactNode
  pulse?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono font-medium
        tracking-wide ${TONE_CLASSES[tone]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${pulse ? "animate-pulse-soft" : ""}`}
        aria-hidden="true"
      />
      {children}
    </span>
  )
}
