import { PageHeader } from "../../components/PageHeader"
import { Button } from "../../components/Button"
import { Card } from "../../components/Card"
import { ScoreGauge } from "../../components/report/ScoreGauge"
import { BarRow } from "../../components/report/BarRow"
import { formatDate, formatDateTime } from "../../lib/format"
import type { ReportDataV2 } from "../../types"

const GROUP_LABEL: Record<ReportDataV2["byGroup"][number]["group"], string> = {
  find: "Looking for a recommendation",
  compare: "Comparing options",
  need: "Specific needs",
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="report-section-title mb-3 font-display text-sm font-semibold text-text">{children}</h2>
}

/** Version 2 report. Score and charts come from counted runs only; reputation answers are shown raw. */
export function ReportV2({ report }: { report: ReportDataV2 }) {
  const { business, basedOnRuns } = report
  const place = business.city ?? business.location
  const hasRuns = basedOnRuns > 0

  return (
    <>
      <PageHeader
        eyebrow={business.niche}
        title={business.name}
        description={`${place} · scanned ${formatDate(report.scanDate)}`}
        action={
          <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
            Save as PDF
          </Button>
        }
      />

      {hasRuns ? (
        <>
          <Card className="mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <ScoreGauge score={report.score} label={report.scoreLabel} />
            <div className="w-full">
              <p className="font-display text-base font-semibold text-text">
                Likely between {report.scoreRange.low}% and {report.scoreRange.high}%
              </p>
              <p className="mt-2 text-sm text-text-dim">
                Based on {basedOnRuns} AI answers. Results vary between scans, so treat the score as a range.
              </p>
              {report.lowConfidence ? (
                <p
                  role="alert"
                  className="mt-3 rounded-md border border-warn px-3 py-2 text-sm text-warn"
                >
                  Warning: some answers failed, so this result is less reliable.
                </p>
              ) : null}
            </div>
          </Card>

          <section className="report-section mb-8">
            <SectionTitle>By question type</SectionTitle>
            <Card className="flex flex-col gap-4">
              {report.byGroup.map((g) => {
                const readout = `${g.mentioned} of ${g.counted} answers (${Math.round(g.percent)}%)`
                return (
                  <BarRow
                    key={g.group}
                    label={GROUP_LABEL[g.group]}
                    value={g.mentioned}
                    max={Math.max(g.counted, 1)}
                    readout={readout}
                    tooltip={readout}
                  />
                )
              })}
            </Card>
          </section>

          <section className="report-section mb-8">
            <SectionTitle>Question by question</SectionTitle>
            <Card padded={false} className="divide-y divide-border-soft">
              {report.questions.map((q) => {
                const gap = q.counted > 0 && q.mentioned === 0
                return (
                  <div
                    key={q.questionId}
                    className={`flex items-start justify-between gap-4 px-5 py-3 ${gap ? "bg-surface-2" : ""}`}
                  >
                    <p className="text-sm text-text-dim">{q.text}</p>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-xs tabular-nums ${gap ? "text-bad" : "text-text"}`}>
                        named in {q.mentioned} of {q.counted} answers
                      </p>
                      {gap ? <p className="mt-0.5 text-[11px] font-semibold uppercase text-bad">Gap</p> : null}
                    </div>
                  </div>
                )
              })}
            </Card>
          </section>

          <section className="report-section mb-8">
            <SectionTitle>Who the AI recommends instead</SectionTitle>
            <Card>
              {report.named.others.length === 0 ? (
                <p className="text-sm text-text-dim">No other businesses were named.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {report.named.others.map((o) => (
                    <BarRow
                      key={o.name}
                      label={o.name}
                      value={o.percent}
                      max={100}
                      tone="neutral"
                      readout={`named in ${Math.round(o.percent)}% of answers`}
                      tooltip={`${o.name}: ${o.runs} of ${basedOnRuns} answers`}
                    />
                  ))}
                </div>
              )}
              {report.averagePosition !== null ? (
                <p className="mt-5 text-xs text-text-faint">
                  When {business.name} was named, it was listed around position {report.averagePosition}
                </p>
              ) : null}
            </Card>
          </section>

          <section className="report-section mb-8">
            <SectionTitle>Your chosen competitors</SectionTitle>
            <Card>
              {report.named.chosenCompetitors.length === 0 ? (
                <p className="text-sm text-text-dim">
                  You haven't chosen any competitors yet. Add some on the client's edit page to see how often the AI
                  names them.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {report.named.chosenCompetitors.map((c) => (
                    <li key={c.name} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-text-dim">{c.name}</span>
                      <span className="font-mono text-xs tabular-nums text-text">
                        named in {c.runs} of {basedOnRuns} answers
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      ) : (
        <Card className="mb-8">
          <p className="font-display text-sm font-semibold text-text">Not enough answers</p>
          <p className="mt-1 text-sm text-text-dim">
            None of the AI answers in this scan could be counted, so there is no score or chart to show. Try running
            the scan again.
          </p>
        </Card>
      )}

      {report.reputation.answers.length > 0 ? (
        <section className="report-section mb-8">
          <SectionTitle>What the AI says when asked directly</SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-text-faint">AI answers can be inaccurate.</p>
          <div className="flex flex-col gap-3">
            {report.reputation.answers.map((answer, i) => (
              <Card key={i}>
                <p className="mb-2 text-[11px] uppercase tracking-wide text-text-faint">
                  AI answer when asked about {business.name}
                </p>
                <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-4 text-sm text-text-dim">
                  “{answer}”
                </blockquote>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="report-footer border-t border-border-soft pt-4 text-xs text-text-faint">
        <p>
          Generated {formatDateTime(report.generatedAt)} using {({ claude: 'Claude' } as Record<string, string>)[report.model.provider] ?? report.model.provider} ({report.model.model})
        </p>
        <p className="mt-1">AI answers change over time, so a later scan may give different results.</p>
      </footer>
    </>
  )
}
