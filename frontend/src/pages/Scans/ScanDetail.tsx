import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Button } from "../../components/Button"
import { Badge } from "../../components/Badge"
import { StatusPill } from "../../components/StatusPill"
import { ScoreMeter } from "../../components/ScoreMeter"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner, Spinner } from "../../components/Spinner"
import { IconArrowLeft, IconReports } from "../../components/icons"
import { getScan } from "../../api/scans"
import { createReport } from "../../api/reports"
import { getErrorMessage } from "../../api/client"
import { useInterval } from "../../hooks/useInterval"
import { formatDateTime } from "../../lib/format"
import type { Scan, SentimentLabel } from "../../types"

const SENTIMENT_TONE: Record<SentimentLabel, "good" | "neutral" | "bad"> = {
  positive: "good",
  neutral: "neutral",
  negative: "bad",
}

const POLL_MS = 3000

export function ScanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [scan, setScan] = useState<Scan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!id) return
    try {
      setScan(await getScan(id))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const isPolling = scan?.status === "PENDING" || scan?.status === "RUNNING"
  useInterval(load, isPolling ? POLL_MS : null)

  async function handleGenerateReport() {
    if (!scan) return
    setGenerating(true)
    setReportError(null)
    try {
      const report = await createReport(scan.id)
      // Hand the freshly-computed report straight to the detail page instead
      // of making it re-fetch — GET /reports/:id returns a leaner shape
      // missing scoreLabel/recommendations (see ReportRecord in types).
      navigate(`/reports/${report.id}`, { state: { report } })
    } catch (err) {
      setReportError(getErrorMessage(err))
      setGenerating(false)
    }
  }

  function retry() {
    setError(null)
    setScan(null)
    load()
  }

  function toggleExpanded(resultId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(resultId)) next.delete(resultId)
      else next.add(resultId)
      return next
    })
  }

  if (error) {
    return (
      <>
        <BackLink />
        <ErrorBanner message={error} onRetry={retry} />
      </>
    )
  }

  if (!scan) return <PageSpinner label="Loading scan…" />

  return (
    <>
      <BackLink />

      <PageHeader
        eyebrow={scan.client.niche}
        title={
          <span className="flex items-center gap-3">
            <Link to={`/clients/${scan.clientId}`} className="hover:text-accent">
              {scan.client.businessName}
            </Link>
          </span>
        }
        description={`${scan.client.location} · scanned ${formatDateTime(scan.createdAt)}`}
        action={<StatusPill status={scan.status} />}
      />

      {scan.status === "PENDING" || scan.status === "RUNNING" ? (
        <Card className="mb-6 flex items-center gap-4">
          <Spinner size={22} />
          <div>
            <p className="text-sm font-medium text-text">
              {scan.status === "PENDING" ? "Queued…" : "Scanning…"}
            </p>
            <p className="mt-0.5 text-sm text-text-dim">
              Sending prompts to Claude and checking responses for mentions of{" "}
              {scan.client.businessName}. This refreshes automatically every few seconds.
            </p>
          </div>
        </Card>
      ) : null}

      {scan.status === "FAILED" ? (
        <ErrorBanner message={scan.errorMsg ?? "This scan failed for an unknown reason."} />
      ) : null}

      {scan.status === "COMPLETED" && scan.score !== null ? (
        <Card className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <ScoreMeter score={scan.score} size="lg" />
            {scan.rawResults ? (
              <div className="flex gap-6 font-mono text-xs text-text-dim">
                <Stat label="Mentioned" value={`${scan.rawResults.mentionCount}/${scan.rawResults.totalPrompts}`} />
                <Stat
                  label="Avg. position"
                  value={scan.rawResults.averagePosition !== null ? `#${scan.rawResults.averagePosition}` : "—"}
                />
                <Stat
                  label="Sentiment"
                  value={`+${scan.rawResults.sentimentBreakdown.positive} / -${scan.rawResults.sentimentBreakdown.negative}`}
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Button icon={<IconReports className="h-4 w-4" />} loading={generating} onClick={handleGenerateReport}>
              Generate report
            </Button>
            {reportError ? <p className="text-xs text-bad">{reportError}</p> : null}
          </div>
        </Card>
      ) : null}

      {scan.scanResults.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold text-text">Prompt results</h2>
          <div className="flex flex-col gap-2">
            {scan.scanResults.map((result) => {
              const isOpen = expanded.has(result.id)
              return (
                <Card key={result.id} padded={false}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(result.id)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text">{result.prompt}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{result.category}</Badge>
                        <Badge tone={result.mentioned ? "good" : "neutral"}>
                          {result.mentioned ? "mentioned" : "not mentioned"}
                        </Badge>
                        {result.position !== null ? <Badge tone="accent">position #{result.position}</Badge> : null}
                        {result.sentiment ? (
                          <Badge tone={SENTIMENT_TONE[result.sentiment as SentimentLabel]}>
                            {result.sentiment}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-mono text-text-faint">
                      {isOpen ? "hide" : "view"}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-border-soft px-5 py-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-dim">
                        {result.response}
                      </p>
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-text-faint">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-text">{value}</p>
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/scans" className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-faint hover:text-text">
      <IconArrowLeft className="h-4 w-4" />
      All scans
    </Link>
  )
}
