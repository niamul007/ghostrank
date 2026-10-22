import type { ReportData } from "../../types"
import { Card } from "../Card"
import { BarRow } from "./BarRow"

export function PromptTypeBars({
  stats,
  selected,
  onSelect,
}: {
  stats: NonNullable<ReportData["byPromptType"]>
  selected: string | null
  onSelect: (type: string | null) => void
}) {
  const entries = Object.entries(stats).filter((e): e is [string, { total: number; mentioned: number }] => !!e[1])
  return (
    <Card>
      <h2 className="mb-1 font-display text-sm font-semibold text-text">Mentioned by prompt type</h2>
      <p className="text-xs text-text-faint">Select a bar to filter the prompts below.</p>
      <div className="flex flex-col gap-4 pt-6">
        {entries.map(([type, s]) => (
          <BarRow
            key={type}
            label={type}
            value={s.mentioned}
            max={s.total}
            readout={`${s.mentioned}/${s.total}`}
            tooltip={`${s.mentioned} of ${s.total} ${type} prompts mentioned you`}
            active={selected === type}
            onClick={() => onSelect(selected === type ? null : type)}
          />
        ))}
      </div>
    </Card>
  )
}
