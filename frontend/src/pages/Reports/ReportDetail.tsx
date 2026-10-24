import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { ScoreGauge } from "../../components/report/ScoreGauge"
import { ScoreBreakdownBars } from "../../components/report/ScoreBreakdownBars"
import { TopFixes } from "../../components/report/TopFixes"
import { PromptTypeBars } from "../../components/report/PromptTypeBars"
import { CompetitorBars } from "../../components/report/CompetitorBars"
import { PromptRow } from "../../components/report/PromptRow"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowLeft } from "../../components/icons"
import { getReport } from "../../api/reports"
import { getErrorMessage } from "../../api/client"
import { PLATFORM_LABEL } from "../../lib/reportPresentation"
import { formatDateTime } from "../../lib/format"
import type { ReportData } from "../../types"

interface LocationState {
  report?: ReportData
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const stateReport = (location.state as LocationState | null)?.report
  // Only trust router state if it is for the report in the URL.
  const passedReport = stateReport?.id === id ? stateReport : undefined

  const [report, setReport] = useState<ReportData | null>(passedReport ?? null)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setError(null)
    try {
      setReport(await getReport(id))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  useEffect(() => {
    // Came via navigation state from ScanDetail — already the full shape,
    // no fetch needed. Direct URL / refresh falls through to GET.
    if (passedReport) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const visibleResults = report
    ? selectedType
      ? report.results.filter((r) => r.category === selectedType)
      : report.results
    : []

  // Top fixes already show their recommendation text; don't repeat it below.
  const topFixTexts = new Set(report?.topFixes?.map((f) => f.recommendation))
  const remainingRecommendations = report
    ? report.topFixes
      ? report.recommendations.filter((rec) => !topFixTexts.has(rec))
      : report.recommendations
    : []

  if (error) {
    return (
      <>
        <BackLink />
        <ErrorBanner message={error} onRetry={load} />
      </>
    )
  }

  if (!report) return <PageSpinner label="Loading report…" />

  return (
    <>
      <BackLink />

      <PageHeader
        eyebrow={report.business.niche}
        title={report.business.name}
        description={`${report.business.location} · generated ${formatDateTime(report.generatedAt)}`}
      />

      <Card className="mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ScoreGauge score={report.score} label={report.scoreLabel} />
        {report.breakdown ? (
          <ScoreBreakdownBars breakdown={report.breakdown} />
        ) : (
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-1 sm:text-right">
            {report.platforms.map((p) => (
              <div key={p.platform}>
                <p className="text-[10px] uppercase tracking-wide text-text-faint">{PLATFORM_LABEL[p.platform]}</p>
                <p className="mt-0.5 font-mono text-sm font-medium text-text">
                  {p.mentioned}/{p.total} mentioned · {p.score}/100
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {report.topFixes ? <TopFixes fixes={report.topFixes} /> : null}

      {report.byPromptType || report.competitors ? (
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          {report.byPromptType ? (
            <PromptTypeBars stats={report.byPromptType} selected={selectedType} onSelect={setSelectedType} />
          ) : null}
          {report.competitors ? <CompetitorBars competitors={report.competitors} /> : null}
        </div>
      ) : null}

      {remainingRecommendations.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-sm font-semibold text-text">Recommendations</h2>
          <div className="flex flex-col gap-2">
            {remainingRecommendations.map((rec, i) => (
              <Card key={i} className="flex gap-3">
                <span className="mt-0.5 shrink-0 font-mono text-xs font-semibold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-sm text-text-dim">{rec}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-sm font-semibold text-text">Prompt results</h2>
          {selectedType ? (
            <button
              type="button"
              onClick={() => setSelectedType(null)}
              className="cursor-pointer rounded-full bg-surface-2 px-2.5 py-1 text-xs text-accent hover:text-text"
            >
              {selectedType} ✕ clear filter
            </button>
          ) : null}
        </div>
        <Card padded={false} className="divide-y divide-border-soft">
          {visibleResults.length > 0 ? (
            visibleResults.map((result, i) => <PromptRow key={`${selectedType ?? "all"}-${i}`} result={result} />)
          ) : (
            <p className="px-5 py-4 text-sm text-text-dim">No prompts of this type.</p>
          )}
        </Card>
      </section>
    </>
  )
}

function BackLink() {
  return (
    <Link to="/reports" className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-faint hover:text-text">
      <IconArrowLeft className="h-4 w-4" />
      All reports
    </Link>
  )
}
