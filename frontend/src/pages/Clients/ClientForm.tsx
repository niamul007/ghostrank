import { useState, type FormEvent } from "react"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { ErrorBanner } from "../../components/ErrorBanner"
import { getErrorMessage } from "../../api/client"
import { clientFormSchema, fieldErrors, type ClientFormValues } from "../../lib/schemas"

interface ClientFormProps {
  initialValues?: ClientFormValues
  submitLabel: string
  onSubmit: (values: ClientFormValues) => Promise<void>
  onCancel?: () => void
}

const EMPTY: ClientFormValues = { businessName: "", niche: "", location: "" }

export function ClientForm({ initialValues = EMPTY, submitLabel, onSubmit, onCancel }: ClientFormProps) {
  const [values, setValues] = useState<ClientFormValues>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormValues, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function setField(field: keyof ClientFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const result = clientFormSchema.safeParse(values)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})

    setLoading(true)
    try {
      await onSubmit(result.data)
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <ErrorBanner message={formError} /> : null}
      <Input
        label="Business name"
        name="businessName"
        placeholder="Smile Dental Clinic"
        value={values.businessName}
        onChange={(e) => setField("businessName", e.target.value)}
        error={errors.businessName}
      />
      <Input
        label="Niche"
        name="niche"
        placeholder="dentist"
        value={values.niche}
        onChange={(e) => setField("niche", e.target.value)}
        error={errors.niche}
        hint={!errors.niche ? "What kind of business is this?" : undefined}
      />
      <Input
        label="Location"
        name="location"
        placeholder="Miami, FL"
        value={values.location}
        onChange={(e) => setField("location", e.target.value)}
        error={errors.location}
      />
      <div className="mt-1 flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
