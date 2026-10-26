import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Button } from "../../components/Button"
import { Badge } from "../../components/Badge"
import { StatusPill } from "../../components/StatusPill"
import { ScoreMeter } from "../../components/ScoreMeter"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner, Spinner } from "../../components/Spinner"
import { IconArrowLeft, IconReports } from "../../components/icons"
import { getScan, getScanRuns, startScan } from "../../api/scans"
import { createReport } from "../../api/reports"
import { getErrorMessage } from "../../api/client"
import { useInterval } from "../../hooks/useInterval"
import { formatDateTime } from "../../lib/format"
import type { Scan, ScanRunsResponse, SentimentLabel } from "../../types"

const SENTIMENT_TONE: Record<SentimentLabel, "good" | "neutral" | "bad"> = {
  positive: "good",
  neutral: "neutral",
  negative: "bad",
}

const POLL_MS = 3000
/** A v2 scan records 24 answers in total. */
const EXPECTED_RUNS = 24

const isTerminal = (status: string) => status === "COMPLETED" || status === "FAILED"

/** True when a rawResults blob carries the v2 question-set version tag. */
function hasQuestionSetVersion(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { questionSetVersion?: unknown }).questionSetVersion != null
  )
}

function runsLookV2(info: ScanRunsResponse | null): boolean {
  return info !== null && (info.runs.length > 0 || hasQuestionSetVersion(info.rawResults))
}

export function ScanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  // A brand-new v2 scan has no runs yet and looks just like an old PENDING
  // scan, so whoever starts one passes this hint along.
  const hintedV2 = (location.state as { v2?: boolean } | null)?.v2 === true

  if (!id) return null
  // Keyed by id so "Try again" (a new scan id) starts from a clean slate.
  return <ScanDetailView key={id} id={id} hintedV2={hintedV2} />
}

function ScanDetailView({ id, hintedV2 }: { id: string; hintedV2: boolean }) {
  const navigate = useNavigate()

  const [scan, setScan] = useState<Scan | null>(null)
  const [runsInfo, setRunsInfo] = useState<ScanRunsResponse | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Runs are fetched first so the scan is never older than the runs. A runs
  // failure is swallowed: old scans must keep working off getScan alone.
  const load = useCallback(async () => {
    try {
      const nextRuns = await getScanRuns(id).catch(() => null)
      const nextScan = await getScan(id)
      setRunsInfo(nextRuns)
      setScan(nextScan)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const isV2 = hintedV2 || runsLookV2(runsInfo) || hasQuestionSetVersion(scan?.rawResults)
  // The runs endpoint is the freshest word on status for a v2 scan.
  const status = isV2 && runsInfo ? runsInfo.status : scan?.status
  const errorMsg = isV2 && runsInfo ? runsInfo.errorMsg : scan?.errorMsg

  // Each tick asks for the runs. The full scan (which carries the score) is
  // only fetched for old scans, or once a v2 scan reaches COMPLETED/FAILED.
  const poll = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const nextRuns = await getScanRuns(id).catch(() => null)
      if (nextRuns && (hintedV2 || runsLookV2(nextRuns)) && !isTerminal(nextRuns.status)) {
        setRunsInfo(nextRuns)
        return
      }
      const nextScan = await getScan(id)
      setRunsInfo(nextRuns)
      setScan(nextScan)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      inFlight.current = false
    }
  }, [id, hintedV2])

  const isPolling = status === "PENDING" || status === "RUNNING"
  useInterval(poll, isPolling ? POLL_MS : null)

  async function handleTryAgain() {
    if (!scan) return
    setRetrying(true)
    setRetryError(null)
    try {
      const { scanId } = await startScan(scan.clientId)
      navigate(`/scans/${scanId}`, { state: { v2: true } })
    } catch (err) {
      setRetryError(getErrorMessage(err))
      setRetrying(false)
    }
  }

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
    setRunsInfo(null)
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
        action={<StatusPill status={status ?? scan.status} />}
      />

      {isV2 ? (
        <V2Status
          status={status ?? scan.status}
          errorMsg={errorMsg ?? null}
          score={scan.score}
          runCount={runsInfo ? runsInfo.runs.length : null}
          generating={generating}
          reportError={reportError}
          retrying={retrying}
          retryError={retryError}
          onViewReport={handleGenerateReport}
          onTryAgain={handleTryAgain}
        />
      ) : null}

      {!isV2 && (scan.status === "PENDING" || scan.status === "RUNNING") ? (
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

      {!isV2 && scan.status === "FAILED" ? (
        <ErrorBanner message={scan.errorMsg ?? "This scan failed for an unknown reason."} />
      ) : null}

      {!isV2 && scan.status === "COMPLETED" && scan.score !== null ? (
        <Card className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <ScoreMeter score={scan.score} size="lg" />
            {scan.rawResults ? (
              <div className="flex gap-6 font-mono text-xs text-text-dim">
                <Stat label="Mentioned" value={`${scan.rawResults.mentionCount}/${scan.rawResults.totalPrompts}`} />
                <Stat
                  label="Avg. position"
                  value={
                    scan.rawResults.averagePosition !== null
                      ? `#${scan.rawResults.averagePosition}`
                      : scan.rawResults.mentionCount === 0
                        ? "Not listed"
                        : "Not ranked"
                  }
                />
                <Stat
                  label="Sentiment"
                  value={`+${scan.rawResults.sentimentBreakdown.positive} / ${scan.rawResults.sentimentBreakdown.neutral} neutral / -${scan.rawResults.sentimentBreakdown.negative}`}
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

interface V2StatusProps {
  status: Scan["status"]
  errorMsg: string | null
  score: number | null
  /** null until the first runs response arrives. */
  runCount: number | null
  generating: boolean
  reportError: string | null
  retrying: boolean
  retryError: string | null
  onViewReport: () => void
  onTryAgain: () => void
}

function V2Status(props: V2StatusProps) {
  const { status, runCount } = props

  if (status === "PENDING" || status === "RUNNING") {
    const n = runCount ?? 0
    const pct = Math.min(100, Math.round((n / EXPECTED_RUNS) * 100))
    return (
      <Card className="mb-6 flex items-center gap-4">
        <Spinner size={22} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text">
            {n === 0 ? "Starting…" : `Asking the AI ${n} of ${EXPECTED_RUNS} answers`}
          </p>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={EXPECTED_RUNS}
            aria-valuenow={Math.min(n, EXPECTED_RUNS)}
          >
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>
    )
  }

  if (status === "FAILED") {
    return (
      <div className="mb-6">
        <ErrorBanner
          message={props.errorMsg ?? "This scan failed for an unknown reason."}
          onRetry={props.retrying ? undefined : props.onTryAgain}
        />
        {props.retryError ? <p className="mt-2 text-xs text-bad">{props.retryError}</p> : null}
      </div>
    )
  }

  return (
    <Card className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        {props.score !== null ? (
          <ScoreMeter score={props.score} size="lg" />
        ) : (
          <p className="text-sm text-text-dim">No score was calculated for this scan.</p>
        )}
        {runCount !== null ? (
          <div className="flex gap-6 font-mono text-xs text-text-dim">
            <Stat label="Answers" value={String(runCount)} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          icon={<IconReports className="h-4 w-4" />}
          loading={props.generating}
          disabled={props.score === null}
          onClick={props.onViewReport}
        >
          View report
        </Button>
        {props.reportError ? <p className="text-xs text-bad">{props.reportError}</p> : null}
      </div>
    </Card>
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
