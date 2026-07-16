import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { Button } from "../../components/Button"
import { Modal } from "../../components/Modal"
import { StatusPill } from "../../components/StatusPill"
import { ScoreMeter } from "../../components/ScoreMeter"
import { EmptyState } from "../../components/EmptyState"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowRight, IconClients, IconPlus } from "../../components/icons"
import { createClient, listClients } from "../../api/clients"
import { getErrorMessage } from "../../api/client"
import { formatRelative } from "../../lib/format"
import type { ClientFormValues } from "../../lib/schemas"
import type { Client } from "../../types"
import { ClientForm } from "./ClientForm"

export function ClientsListPage() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  async function load() {
    setError(null)
    try {
      setClients(await listClients())
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(values: ClientFormValues) {
    const client = await createClient(values)
    setClients((prev) => (prev ? [client, ...prev] : [client]))
    setShowCreate(false)
  }

  if (clients === null && !error) return <PageSpinner label="Loading clients…" />

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Clients"
        description="Every business you're tracking AI visibility for."
        action={
          <Button icon={<IconPlus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
            Add client
          </Button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      {clients && clients.length === 0 ? (
        <EmptyState
          icon={<IconClients className="h-8 w-8" />}
          title="No clients yet"
          description="Add a business to start running AI visibility scans against it."
          action={
            <Button icon={<IconPlus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
              Add your first client
            </Button>
          }
        />
      ) : clients && clients.length > 0 ? (
        <Card padded={false} className="divide-y divide-border-soft">
          {clients.map((client) => {
            const scan = client.scans?.[0]
            return (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-text">{client.businessName}</p>
                  <p className="mt-0.5 truncate text-sm text-text-faint">
                    {client.niche} · {client.location}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {scan ? (
                    <div className="hidden items-center gap-3 sm:flex">
                      {scan.status === "COMPLETED" && scan.score !== null ? (
                        <ScoreMeter score={scan.score} size="sm" showLabel={false} />
                      ) : null}
                      <StatusPill status={scan.status} />
                      <span className="text-xs text-text-faint">{formatRelative(scan.createdAt)}</span>
                    </div>
                  ) : (
                    <span className="hidden text-xs text-text-faint sm:inline">No scans yet</span>
                  )}
                  <IconArrowRight className="h-4 w-4 text-text-faint" />
                </div>
              </Link>
            )
          })}
        </Card>
      ) : null}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add a client">
        <ClientForm submitLabel="Add client" onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      </Modal>
    </>
  )
}
