import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Badge } from "../../components/Badge"
import { ScoreMeter } from "../../components/ScoreMeter"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowLeft } from "../../components/icons"
import { getReport } from "../../api/reports"
import { getErrorMessage } from "../../api/client"
import { PLATFORM_LABEL } from "../../lib/reportPresentation"
import { formatDateTime } from "../../lib/format"
import type { ReportData, SentimentLabel } from "../../types"

const SENTIMENT_TONE: Record<SentimentLabel, "good" | "neutral" | "bad"> = {
  positive: "good",
  neutral: "neutral",
  negative: "bad",
}

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

  useEffect(() => {
    // Came via navigation state from ScanDetail — already the full shape,
    // no fetch needed. Direct URL / refresh falls through to GET.
    if (passedReport) return
    if (!id) return

    async function load() {
      try {
        setReport(await getReport(id!))
      } catch (err) {
        setError(getErrorMessage(err))
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) {
    return (
      <>
        <BackLink />
        <ErrorBanner message={error} />
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

      <Card className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <ScoreMeter score={report.score} size="lg" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-1 sm:text-right">
          {report.platforms.map((p) => (
            <div key={p.platform}>
              <p className="text-[10px] uppercase tracking-wide text-text-faint">{PLATFORM_LABEL[p.platform]}</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-text">
                {p.mentioned}/{p.total} mentioned · {p.score}/100
              </p>
            </div>
          ))}
        </div>
      </Card>

      {report.recommendations.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-sm font-semibold text-text">Recommendations</h2>
          <div className="flex flex-col gap-2">
            {report.recommendations.map((rec, i) => (
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
        <h2 className="mb-3 font-display text-sm font-semibold text-text">Prompt results</h2>
        <Card padded={false} className="divide-y divide-border-soft">
          {report.results.map((result, i) => (
            <div key={i} className="px-5 py-4">
              <p className="text-sm text-text">{result.prompt}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{result.category}</Badge>
                <Badge tone={result.mentioned ? "good" : "neutral"}>
                  {result.mentioned ? "mentioned" : "not mentioned"}
                </Badge>
                {result.position !== null ? <Badge tone="accent">position #{result.position}</Badge> : null}
                {result.sentiment ? (
                  <Badge tone={SENTIMENT_TONE[result.sentiment as SentimentLabel]}>{result.sentiment}</Badge>
                ) : null}
              </div>
            </div>
          ))}
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
