import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "../../components/PageHeader"
import { Card } from "../../components/Card"
import { ErrorBanner } from "../../components/ErrorBanner"
import { PageSpinner } from "../../components/Spinner"
import { IconArrowLeft } from "../../components/icons"
import { getClient, updateClient } from "../../api/clients"
import { getErrorMessage } from "../../api/client"
import { clientToFormInput, type ClientFormValues } from "../../lib/schemas"
import type { Client } from "../../types"
import { ClientForm } from "./ClientForm"

export function ClientEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [client, setClient] = useState<Client | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setClient(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleUpdate(values: ClientFormValues) {
    if (!id) return
    // The form turns a cleared link into undefined, which would leave it out of the request
    // and keep the old value. Send "" so the API clears it.
    await updateClient(id, {
      ...values,
      website: values.website ?? "",
      facebookUrl: values.facebookUrl ?? "",
      mapsUrl: values.mapsUrl ?? "",
    })
    navigate(`/clients/${id}`)
  }

  if (error) {
    return (
      <>
        <BackLink to="/clients" label="All clients" />
        <ErrorBanner message={error} onRetry={load} />
      </>
    )
  }

  if (!client) return <PageSpinner label="Loading client…" />

  return (
    <>
      <BackLink to={`/clients/${client.id}`} label={client.businessName} />
      <PageHeader eyebrow="Edit client" title={client.businessName} />
      <Card>
        <ClientForm
          key={client.id}
          initialValues={clientToFormInput(client)}
          submitLabel="Save changes"
          onSubmit={handleUpdate}
          onCancel={() => navigate(`/clients/${client.id}`)}
        />
      </Card>
    </>
  )
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-faint hover:text-text">
      <IconArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  )
}
