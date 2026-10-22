import { Card } from "../Card"

type Fix = { recommendation: string; missedPrompts: number }

export function TopFixes({ fixes }: { fixes: Fix[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-sm font-semibold text-text">Top fixes</h2>
      {fixes.length === 0 ? (
        <Card className="border-good/40 bg-good-soft">
          <p className="text-sm font-medium text-good">No urgent fixes</p>
          <p className="mt-1 text-sm text-text-dim">Your business is showing up well. Keep monitoring.</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {fixes.map((fix, i) => (
            <Card key={i} className="flex flex-col gap-3">
              <span className="font-mono text-xs font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
              <p className="flex-1 wrap-break-word text-sm text-text">{fix.recommendation}</p>
              <p className="font-mono text-[11px] text-text-faint">
                Missed in {fix.missedPrompts} {fix.missedPrompts === 1 ? "prompt" : "prompts"}
              </p>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
