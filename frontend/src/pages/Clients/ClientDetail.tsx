import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Button } from "../../components/Button"
import { ConfirmDialog } from "../../components/ConfirmDialog"
import { StatusPill } from "../../components/StatusPill"
import { ScoreMeter } from "../../components/ScoreMeter"
import { EmptyState } from "../../components/EmptyState"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowLeft, IconArrowRight, IconEdit, IconScans, IconTrash } from "../../components/icons"
import { deleteClient, getClient } from "../../api/clients"
import { startScan } from "../../api/scans"
import { getErrorMessage } from "../../api/client"
import { formatRelative } from "../../lib/format"
import type { Client } from "../../types"

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [client, setClient] = useState<Client | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [startingScan, setStartingScan] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setError(null)
    try {
      setClient(await getClient(id))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    try {
      await deleteClient(id)
      navigate("/clients", { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setShowDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleStartScan() {
    if (!id) return
    setStartingScan(true)
    setScanError(null)
    try {
      const { scanId } = await startScan(id)
      navigate(`/scans/${scanId}`, { state: { v2: true } })
    } catch (err) {
      setScanError(getErrorMessage(err))
      setStartingScan(false)
    }
  }

  if (error) {
    return (
      <>
        <BackLink />
        {/* A failed delete also lands here with the client loaded; retrying the load would not redo the delete. */}
        <ErrorBanner message={error} onRetry={client ? undefined : load} />
      </>
    )
  }

  if (!client) return <PageSpinner label="Loading client…" />

  const scans = [...(client.scans ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  const latestScan = scans[0]
  const scanInFlight = latestScan?.status === "PENDING" || latestScan?.status === "RUNNING"

  return (
    <>
      <BackLink />

      <PageHeader
        eyebrow={client.niche}
        title={client.businessName}
        description={client.location}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<IconEdit className="h-4 w-4" />} onClick={() => navigate(`/clients/${client.id}/edit`)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" icon={<IconTrash className="h-4 w-4" />} onClick={() => setShowDelete(true)}>
              Delete
            </Button>
          </div>
        }
      />

      <Card className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-sm font-semibold text-text">Run a new scan</p>
          <p className="mt-1 text-sm text-text-dim">
            Asks Claude fresh questions and re-checks {client.businessName}'s AI visibility.
          </p>
          {scanError ? (
            <p className="mt-2 text-sm text-bad">{scanError}</p>
          ) : null}
        </div>
        <Button
          icon={<IconScans className="h-4 w-4" />}
          loading={startingScan}
          disabled={scanInFlight}
          onClick={handleStartScan}
        >
          {scanInFlight ? "Scan running…" : "Start scan"}
        </Button>
      </Card>

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold text-text">Scan history</h2>
        {scans.length === 0 ? (
          <EmptyState
            icon={<IconScans className="h-8 w-8" />}
            title="No scans yet"
            description="Run your first scan to see how AI models talk about this business."
          />
        ) : (
          <Card padded={false} className="divide-y divide-border-soft">
            {scans.map((scan) => (
              <Link
                key={scan.id}
                to={`/scans/${scan.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm text-text">{formatRelative(scan.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {scan.status === "COMPLETED" && scan.score !== null ? (
                    <ScoreMeter score={scan.score} size="sm" showLabel={false} />
                  ) : null}
                  <StatusPill status={scan.status} />
                  <IconArrowRight className="h-4 w-4 text-text-faint" />
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={showDelete}
        title="Delete this client?"
        description={`This permanently deletes ${client.businessName} and all of its scans and reports. This can't be undone.`}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </>
  )
}

function BackLink() {
  return (
    <Link
      to="/clients"
      className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-faint hover:text-text"
    >
      <IconArrowLeft className="h-4 w-4" />
      All clients
    </Link>
  )
}
