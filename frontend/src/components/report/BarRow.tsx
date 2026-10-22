import { useMounted } from "../../hooks/useMounted"
import { TONE_FILL, toneForPct } from "./barTone"

interface BarRowProps {
  label: string
  value: number
  max: number
  /** Right-hand readout, e.g. "12/30". */
  readout: string
  /** Exact numbers shown in the hover/focus tooltip. */
  tooltip: string
  active?: boolean
  onClick?: () => void
}

/** One labelled horizontal bar. Becomes a toggle button when onClick is given. */
export function BarRow({ label, value, max, readout, tooltip, active = false, onClick }: BarRowProps) {
  const mounted = useMounted()
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  const body = (
    <>
      <span className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className={`capitalize ${active ? "text-accent" : "text-text-dim"}`}>{label}</span>
        <span className="font-mono tabular-nums text-text">{readout}</span>
      </span>
      <span className="block h-2 w-full overflow-hidden rounded-full border border-border-soft bg-surface-2">
        <span
          className={`block h-full rounded-full transition-[width] duration-700 ease-out ${TONE_FILL[toneForPct(pct)]}`}
          style={{ width: mounted ? `${pct}%` : "0%" }}
        />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-7 right-0 z-10 whitespace-nowrap rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltip}
      </span>
    </>
  )

  const base = "group relative block w-full text-left"
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={`${base} cursor-pointer rounded-md`}>
        {body}
      </button>
    )
  }
  return (
    <div tabIndex={0} className={`${base} rounded-md`}>
      {body}
    </div>
  )
}
