import { Card } from "../Card"
import { BarRow } from "./BarRow"

export function CompetitorBars({ competitors }: { competitors: { name: string; mentions: number }[] }) {
  const max = Math.max(1, ...competitors.map((c) => c.mentions))
  return (
    <Card>
      <h2 className="mb-1 font-display text-sm font-semibold text-text">Recommended instead</h2>
      <p className="text-xs text-text-faint">Businesses the AI named in your place.</p>
      {competitors.length === 0 ? (
        <p className="pt-6 text-sm text-text-dim">No competitors found</p>
      ) : (
        <div className="flex flex-col gap-4 pt-6">
          {competitors.map((c) => (
            <BarRow
              key={c.name}
              label={c.name}
              value={c.mentions}
              max={max}
              tone="neutral"
              readout={String(c.mentions)}
              tooltip={`${c.name}: recommended ${c.mentions} ${c.mentions === 1 ? "time" : "times"}`}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
