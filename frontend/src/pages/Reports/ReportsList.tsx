import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { ScoreMeter } from "../../components/ScoreMeter"
import { EmptyState } from "../../components/EmptyState"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowRight, IconReports } from "../../components/icons"
import { listClients } from "../../api/clients"
import { listReportsForClient } from "../../api/reports"
import { getErrorMessage } from "../../api/client"
import { formatRelative } from "../../lib/format"
import type { ReportListItem } from "../../types"

interface ReportRow {
  item: ReportListItem
  clientName: string
}

export function ReportsListPage() {
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setError(null)
      try {
        // Same story as Scans: no "all reports for this agency" endpoint,
        // only per-client — composed from every client's report list.
        const clientList = await listClients()
        const reportLists = await Promise.all(
          clientList.map((c) => listReportsForClient(c.id).catch(() => [] as ReportListItem[]))
        )
        const merged: ReportRow[] = reportLists.flatMap((list, i) =>
          list.map((item) => ({ item, clientName: clientList[i]!.businessName }))
        )
        merged.sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime())
        setRows(merged)
      } catch (err) {
        setError(getErrorMessage(err))
      }
    }
    load()
  }, [])

  if (rows === null && !error) return <PageSpinner label="Loading reports…" />

  return (
    <>
      <PageHeader
        eyebrow="Deliverables"
        title="Reports"
        description="Client-ready visibility reports generated from your scans."
      />

      {error ? <ErrorBanner message={error} /> : null}

      {rows && rows.length === 0 ? (
        <EmptyState
          icon={<IconReports className="h-8 w-8" />}
          title="No reports yet"
          description="Generate a report from any completed scan to see it here."
        />
      ) : rows && rows.length > 0 ? (
        <Card padded={false} className="divide-y divide-border-soft">
          {rows.map(({ item, clientName }) => (
            <Link
              key={item.id}
              to={`/reports/${item.id}`}
              className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{clientName}</p>
                <p className="mt-0.5 text-xs text-text-faint">{formatRelative(item.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {item.scan.score !== null ? <ScoreMeter score={item.scan.score} size="sm" showLabel={false} /> : null}
                <IconArrowRight className="h-4 w-4 text-text-faint" />
              </div>
            </Link>
          ))}
        </Card>
      ) : null}
    </>
  )
}
