import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { getReport } from "../../api/reports"
import { getErrorMessage } from "../../api/client"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { PrintReportV2 } from "../../components/report/PrintReportV2"
import type { Report } from "../../types"

/** Standalone print page: no app shell, just a toolbar and the A4 document. */
export function ReportPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const back = `/reports/${id ?? ""}`

  return (
    <div className="pr-page">
      <div className="no-print pr-toolbar">
        <Link to={back} className="pr-back">
          ← Back to report
        </Link>
        <button type="button" className="pr-print-btn" disabled={report?.version !== 2} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      {error ? (
        <div className="no-print pr-state">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      ) : !report ? (
        <PageSpinner label="Loading report…" />
      ) : report.version === 2 ? (
        <PrintReportV2 report={report} />
      ) : (
        <p className="no-print pr-state">The print layout is only available for newer reports.</p>
      )}
    </div>
  )
}
