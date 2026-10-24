import { useState, type FormEvent } from "react"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { ErrorBanner } from "../../components/ErrorBanner"
import { StringListField } from "../../components/StringListField"
import { getErrorMessage } from "../../api/client"
import {
  clientFormSchema,
  fieldErrors,
  type ClientFormInput,
  type ClientFormValues,
} from "../../lib/schemas"
import { KNOWN_FOR_SUGGESTIONS, LIST_ITEM_MAX, LIST_LIMITS, NICHES, OTHER_NICHE } from "../../lib/clientOptions"

interface ClientFormProps {
  initialValues?: ClientFormInput
  submitLabel: string
  onSubmit: (values: ClientFormValues) => Promise<void>
  onCancel?: () => void
}

const EMPTY: ClientFormInput = {
  businessName: "",
  city: "",
  niche: "",
  website: "",
  facebookUrl: "",
  mapsUrl: "",
  nameVariants: [],
  knownFor: [],
  competitors: [],
}

type ErrorKey = keyof ClientFormInput | "links"

function isListedNiche(niche: string): boolean {
  return (NICHES as readonly string[]).includes(niche) && niche !== OTHER_NICHE
}

export function ClientForm({ initialValues = EMPTY, submitLabel, onSubmit, onCancel }: ClientFormProps) {
  const [values, setValues] = useState<ClientFormInput>(initialValues)
  // A saved niche that is not in the list (older clients) is shown as "Other" with its text filled in.
  const [nicheChoice, setNicheChoice] = useState<string>(() =>
    !initialValues.niche ? "" : isListedNiche(initialValues.niche) ? initialValues.niche : OTHER_NICHE
  )
  const [nicheOther, setNicheOther] = useState<string>(() =>
    initialValues.niche && !isListedNiche(initialValues.niche) && initialValues.niche !== OTHER_NICHE
      ? initialValues.niche
      : ""
  )
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function setField<K extends keyof ClientFormInput>(field: K, value: ClientFormInput[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const niche = nicheChoice === OTHER_NICHE ? nicheOther.trim() : nicheChoice
    const result = clientFormSchema.safeParse({ ...values, niche })
    if (!result.success) {
      const found = fieldErrors(result.error) as Partial<Record<ErrorKey, string>>
      if (nicheChoice === OTHER_NICHE && found.niche === "Choose a niche") {
        found.niche = "Type the kind of business"
      }
      setErrors(found)
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

  const suggestions = KNOWN_FOR_SUGGESTIONS[nicheChoice] ?? []
  const linksError = errors.links

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
        label="City or area"
        name="city"
        placeholder="Dhanmondi, Dhaka"
        value={values.city}
        onChange={(e) => setField("city", e.target.value)}
        error={errors.city}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="niche" className="text-xs font-medium text-text-dim">
          Niche
        </label>
        <select
          id="niche"
          name="niche"
          value={nicheChoice}
          onChange={(e) => setNicheChoice(e.target.value)}
          aria-invalid={Boolean(errors.niche) && nicheChoice !== OTHER_NICHE}
          className={`rounded-md bg-surface-2 border px-3 py-2.5 text-sm text-text outline-none transition-colors
            ${errors.niche && nicheChoice !== OTHER_NICHE ? "border-bad focus:border-bad" : "border-border focus:border-accent"}`}
        >
          <option value="" disabled>
            Choose a niche
          </option>
          {NICHES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {errors.niche && nicheChoice !== OTHER_NICHE ? <p className="text-xs text-bad">{errors.niche}</p> : null}
      </div>
      {nicheChoice === OTHER_NICHE ? (
        <Input
          label="What kind of business?"
          name="nicheOther"
          placeholder="Pet grooming"
          value={nicheOther}
          onChange={(e) => setNicheOther(e.target.value)}
          error={errors.niche}
        />
      ) : null}

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-text-dim">Links (add at least one)</legend>
        {linksError ? <p className="text-xs text-bad">{linksError}</p> : null}
        <Input
          label="Website"
          name="website"
          placeholder="https://smiledental.com"
          value={values.website}
          onChange={(e) => setField("website", e.target.value)}
          error={errors.website}
        />
        <Input
          label="Facebook page"
          name="facebookUrl"
          placeholder="https://facebook.com/smiledental"
          value={values.facebookUrl}
          onChange={(e) => setField("facebookUrl", e.target.value)}
          error={errors.facebookUrl}
        />
        <Input
          label="Google Maps link"
          name="mapsUrl"
          placeholder="https://maps.google.com/..."
          value={values.mapsUrl}
          onChange={(e) => setField("mapsUrl", e.target.value)}
          error={errors.mapsUrl}
        />
      </fieldset>

      <StringListField
        label="Name variants"
        items={values.nameVariants}
        onChange={(items) => setField("nameVariants", items)}
        max={LIST_LIMITS.nameVariants}
        itemMax={LIST_ITEM_MAX}
        placeholder="Another way people write the name"
        hint="Optional. Spellings or short names customers use."
        error={errors.nameVariants}
      />
      <StringListField
        label="Known for"
        items={values.knownFor}
        onChange={(items) => setField("knownFor", items)}
        max={LIST_LIMITS.knownFor}
        itemMax={LIST_ITEM_MAX}
        placeholder="Type your own"
        hint="Optional. Tap a suggestion or type your own."
        suggestions={suggestions}
        error={errors.knownFor}
      />
      <StringListField
        label="Competitors"
        items={values.competitors}
        onChange={(items) => setField("competitors", items)}
        max={LIST_LIMITS.competitors}
        itemMax={LIST_ITEM_MAX}
        placeholder="A competing business name"
        hint="Optional."
        error={errors.competitors}
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
