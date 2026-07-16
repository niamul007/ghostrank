import type { ScanStatus } from "../types"
import { Badge, type Tone } from "./Badge"

const STATUS_META: Record<ScanStatus, { label: string; tone: Tone; pulse?: boolean }> = {
  PENDING: { label: "pending", tone: "neutral" },
  RUNNING: { label: "running", tone: "accent", pulse: true },
  COMPLETED: { label: "completed", tone: "good" },
  FAILED: { label: "failed", tone: "bad" },
}

export function StatusPill({ status }: { status: ScanStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone} pulse={meta.pulse}>
      {meta.label}
    </Badge>
  )
}
