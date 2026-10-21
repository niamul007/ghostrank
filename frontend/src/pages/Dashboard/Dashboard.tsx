import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Button } from "../../components/Button"
import { StatusPill } from "../../components/StatusPill"
import { ScoreMeter } from "../../components/ScoreMeter"
import { EmptyState } from "../../components/EmptyState"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowRight, IconClients, IconPlus, IconReports, IconScans } from "../../components/icons"
import { listClients } from "../../api/clients"
import { listReportsForClient } from "../../api/reports"
import { getErrorMessage } from "../../api/client"
import { formatRelative } from "../../lib/format"
import type { Client, ReportListItem } from "../../types"

interface RecentReport {
  item: ReportListItem
  clientName: string
}

export function DashboardPage() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [reports, setReports] = useState<RecentReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Bumped on every load and on unmount so a stale request can't set state.
  const requestRef = useRef(0)

  async function load() {
    const request = ++requestRef.current
    const isStale = () => request !== requestRef.current

    setLoading(true)
    setError(null)
    try {
      const clientList = await listClients()
      if (isStale()) return
      setClients(clientList)

      // No "all reports for this agency" endpoint exists — only
      // per-client. Bound the fan-out to the 6 most recently active
      // clients so the dashboard stays fast for demo-sized data.
      const candidates = [...clientList]
        .filter((c) => c.scans && c.scans.length > 0)
        .sort(
          (a, b) =>
            new Date(b.scans![0]!.createdAt).getTime() - new Date(a.scans![0]!.createdAt).getTime()
        )
        .slice(0, 6)

      const reportLists = await Promise.all(
        candidates.map((c) => listReportsForClient(c.id).catch(() => [] as ReportListItem[]))
      )
      if (isStale()) return

      const merged: RecentReport[] = reportLists.flatMap((list, i) =>
        list.map((item) => ({ item, clientName: candidates[i]!.businessName }))
      )
      merged.sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime())
      setReports(merged.slice(0, 5))
    } catch (err) {
      if (!isStale()) setError(getErrorMessage(err))
    } finally {
      if (!isStale()) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return () => {
      requestRef.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <PageSpinner label="Loading dashboard…" />

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Command center" title="Dashboard" />
        <ErrorBanner message={error} onRetry={load} />
      </>
    )
  }

  const clientList = clients ?? []
  const latestScans = clientList
    .filter((c) => c.scans && c.scans.length > 0)
    .sort(
      (a, b) => new Date(b.scans![0]!.createdAt).getTime() - new Date(a.scans![0]!.createdAt).getTime()
    )
    .slice(0, 5)

  const inProgress = clientList.filter(
    (c) => c.scans?.[0]?.status === "PENDING" || c.scans?.[0]?.status === "RUNNING"
  ).length

  const completedScores = clientList
    .map((c) => c.scans?.[0])
    .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.status === "COMPLETED" && s!.score !== null)
    .map((s) => s.score as number)

  const avgScore =
    completedScores.length > 0
      ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length)
      : null

  if (clientList.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Command center" title="Dashboard" />
        <EmptyState
          icon={<IconClients className="h-8 w-8" />}
          title="No clients yet"
          description="Add your first client to start scanning how AI recommends their business."
          action={
            <Link to="/clients">
              <Button icon={<IconPlus className="h-4 w-4" />}>Add your first client</Button>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Command center"
        title="Dashboard"
        description="Your agency's AI visibility, at a glance."
        action={
          <Link to="/clients">
            <Button variant="secondary" icon={<IconPlus className="h-4 w-4" />}>
              Add client
            </Button>
          </Link>
        }
      />

      {/* ── Stat tiles ──────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clients" value={clientList.length} />
        <StatTile label="Scans in progress" value={inProgress} tone={inProgress > 0 ? "accent" : undefined} />
        <StatTile
          label="Avg. visibility score"
          value={avgScore !== null ? avgScore : "—"}
          suffix={avgScore !== null ? "/100" : undefined}
        />
        <StatTile
          label="Reports generated"
          value={reports !== null && reports.length > 0 ? `${reports.length}+` : reports?.length ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Recent scans ──────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-text">
              <IconScans className="h-4 w-4 text-text-faint" />
              Recent scans
            </h2>
            <Link to="/scans" className="text-xs font-medium text-accent hover:text-accent-hover">
              View all
            </Link>
          </div>
          <Card padded={false} className="divide-y divide-border-soft">
            {latestScans.length === 0 ? (
              <p className="p-6 text-sm text-text-faint">No scans yet.</p>
            ) : (
              latestScans.map((client) => {
                const scan = client.scans![0]!
                return (
                  <Link
                    key={scan.id}
                    to={`/scans/${scan.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{client.businessName}</p>
                      <p className="mt-0.5 text-xs text-text-faint">{formatRelative(scan.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {scan.status === "COMPLETED" && scan.score !== null ? (
                        <ScoreMeter score={scan.score} size="sm" showLabel={false} />
                      ) : null}
                      <StatusPill status={scan.status} />
                    </div>
                  </Link>
                )
              })
            )}
          </Card>
        </section>

        {/* ── Recent reports ────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-text">
              <IconReports className="h-4 w-4 text-text-faint" />
              Recent reports
            </h2>
            <Link to="/reports" className="text-xs font-medium text-accent hover:text-accent-hover">
              View all
            </Link>
          </div>
          <Card padded={false} className="divide-y divide-border-soft">
            {!reports || reports.length === 0 ? (
              <p className="p-6 text-sm text-text-faint">
                No reports yet. Generate one from a completed scan.
              </p>
            ) : (
              reports.map(({ item, clientName }) => (
                <Link
                  key={item.id}
                  to={`/reports/${item.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{clientName}</p>
                    <p className="mt-0.5 text-xs text-text-faint">{formatRelative(item.createdAt)}</p>
                  </div>
                  <IconArrowRight className="h-4 w-4 shrink-0 text-text-faint" />
                </Link>
              ))
            )}
          </Card>
        </section>
      </div>
    </>
  )
}

function StatTile({
  label,
  value,
  suffix,
  tone,
}: {
  label: string
  value: string | number
  suffix?: string
  tone?: "accent"
}) {
  return (
    <Card className="flex flex-col gap-1.5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-text-faint">{label}</p>
      <p className="flex items-baseline gap-1 font-mono">
        <span className={`text-2xl font-semibold tabular-nums ${tone === "accent" ? "text-accent" : "text-text"}`}>
          {value}
        </span>
        {suffix ? <span className="text-xs text-text-faint">{suffix}</span> : null}
      </p>
    </Card>
  )
}
