import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Button } from "../../components/Button"
import { Modal } from "../../components/Modal"
import { StatusPill } from "../../components/StatusPill"
import { ScoreMeter } from "../../components/ScoreMeter"
import { EmptyState } from "../../components/EmptyState"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowRight, IconPlus, IconScans } from "../../components/icons"
import { listClients } from "../../api/clients"
import { listScansForClient, startScan } from "../../api/scans"
import { getErrorMessage } from "../../api/client"
import { formatRelative } from "../../lib/format"
import type { Client, Scan } from "../../types"

interface ScanRow {
  scan: Scan
  clientName: string
}

export function ScansListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ScanRow[] | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showStart, setShowStart] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState("")
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      // No "all scans for this agency" endpoint exists — only per-client.
      // Compose the full list from every client's scan history.
      const clientList = await listClients()
      setClients(clientList)
      const scanLists = await Promise.all(
        clientList.map((c) => listScansForClient(c.id).catch(() => [] as Scan[]))
      )
      const merged: ScanRow[] = scanLists.flatMap((scans, i) =>
        scans.map((scan) => ({ scan, clientName: clientList[i]!.businessName }))
      )
      merged.sort((a, b) => new Date(b.scan.createdAt).getTime() - new Date(a.scan.createdAt).getTime())
      setRows(merged)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleStartScan() {
    if (!selectedClientId) return
    setStarting(true)
    setStartError(null)
    try {
      const { scanId } = await startScan(selectedClientId)
      navigate(`/scans/${scanId}`)
    } catch (err) {
      setStartError(getErrorMessage(err))
      setStarting(false)
    }
  }

  if (rows === null && !error) return <PageSpinner label="Loading scans…" />

  return (
    <>
      <PageHeader
        eyebrow="Signal history"
        title="Scans"
        description="Every AI visibility scan run across your clients."
        action={
          <Button
            icon={<IconPlus className="h-4 w-4" />}
            onClick={() => setShowStart(true)}
            disabled={clients.length === 0}
          >
            Start scan
          </Button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      {rows && rows.length === 0 ? (
        <EmptyState
          icon={<IconScans className="h-8 w-8" />}
          title="No scans yet"
          description={
            clients.length === 0
              ? "Add a client first, then run a scan to see results here."
              : "Start a scan on one of your clients to see results here."
          }
          action={
            clients.length > 0 ? (
              <Button icon={<IconPlus className="h-4 w-4" />} onClick={() => setShowStart(true)}>
                Start your first scan
              </Button>
            ) : (
              <Link to="/clients">
                <Button icon={<IconPlus className="h-4 w-4" />}>Add a client</Button>
              </Link>
            )
          }
        />
      ) : rows && rows.length > 0 ? (
        <Card padded={false} className="divide-y divide-border-soft">
          {rows.map(({ scan, clientName }) => (
            <Link
              key={scan.id}
              to={`/scans/${scan.id}`}
              className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{clientName}</p>
                <p className="mt-0.5 text-xs text-text-faint">{formatRelative(scan.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {scan.status === "COMPLETED" && scan.score !== null ? (
                  <ScoreMeter score={scan.score} size="sm" showLabel={false} />
                ) : null}
                <StatusPill status={scan.status} />
                <IconArrowRight className="h-4 w-4 text-text-faint" />
              </div>
            </Link>
          ))}
        </Card>
      ) : null}

      <Modal open={showStart} onClose={() => setShowStart(false)} title="Start a new scan">
        <div className="flex flex-col gap-4">
          {startError ? <ErrorBanner message={startError} /> : null}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="scan-client" className="text-xs font-medium text-text-dim">
              Client
            </label>
            <select
              id="scan-client"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text outline-none focus:border-accent"
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName} — {c.niche}, {c.location}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-faint">
              Sends 5 prompts to Claude simulating how customers search for this business.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowStart(false)} disabled={starting}>
              Cancel
            </Button>
            <Button size="sm" loading={starting} disabled={!selectedClientId} onClick={handleStartScan}>
              Start scan
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
