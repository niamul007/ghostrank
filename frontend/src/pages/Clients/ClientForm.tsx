import { useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { Input } from "../../components/Input"
import { Button } from "../../components/Button"
import { Select } from "../../components/Select"
import { ErrorBanner } from "../../components/ErrorBanner"
import { StringListField, type StringListFieldHandle } from "../../components/StringListField"
import { getErrorMessage } from "../../api/client"
import {
  clientFormSchema,
  clientStepErrors,
  fieldErrors,
  firstStepWithError,
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
type ListKey = "nameVariants" | "knownFor" | "competitors"

const STEP_NAMES = ["Business", "Links", "Details"] as const
const LAST_STEP = STEP_NAMES.length - 1
const LIST_KEYS: ListKey[] = ["nameVariants", "knownFor", "competitors"]
const LIMIT_MESSAGE = "Limit reached. Remove one to add another."

function isListedNiche(niche: string): boolean {
  return (NICHES as readonly string[]).includes(niche) && niche !== OTHER_NICHE
}

export function ClientForm({ initialValues = EMPTY, submitLabel, onSubmit, onCancel }: ClientFormProps) {
  const isEdit = initialValues !== EMPTY
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
  const [step, setStep] = useState(0)
  const listRefs = {
    nameVariants: useRef<StringListFieldHandle>(null),
    knownFor: useRef<StringListFieldHandle>(null),
    competitors: useRef<StringListFieldHandle>(null),
  }

  function setField<K extends keyof ClientFormInput>(field: K, value: ClientFormInput[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function currentNiche() {
    return nicheChoice === OTHER_NICHE ? nicheOther.trim() : nicheChoice
  }

  function friendlyErrors(found: Partial<Record<ErrorKey, string>>) {
    if (nicheChoice === OTHER_NICHE && found.niche === "Choose a niche") {
      found.niche = "Type the kind of business"
    }
    return found
  }

  /** Adds any text typed in a list box but never added. Blocks when it does not fit. */
  function mergeDrafts() {
    const merged = { ...values }
    const listErrors: Partial<Record<ErrorKey, string>> = {}
    let blocked = false
    for (const key of LIST_KEYS) {
      const handle = listRefs[key].current
      const draft = handle?.getDraft().trim() ?? ""
      if (!handle || !draft) continue
      const items = merged[key]
      if (items.some((i) => i.toLowerCase() === draft.toLowerCase())) {
        handle.clearDraft()
      } else if (items.length >= LIST_LIMITS[key]) {
        listErrors[key] = LIMIT_MESSAGE
        blocked = true
      } else if (draft.length > LIST_ITEM_MAX) {
        // The list box itself shows the length message.
        blocked = true
      } else {
        merged[key] = [...items, draft]
        handle.clearDraft()
      }
    }
    return { merged, listErrors, blocked }
  }

  function goNext() {
    const found = friendlyErrors(
      clientStepErrors({ ...values, niche: currentNiche() }, step) as Partial<Record<ErrorKey, string>>
    )
    setErrors(found)
    if (Object.keys(found).length === 0) setStep((s) => Math.min(s + 1, LAST_STEP))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    // Enter in a text box on steps 1 and 2 means Next. Only the last step's button submits.
    if (e.key === "Enter" && step < LAST_STEP && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault()
      goNext()
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (step < LAST_STEP) {
      goNext()
      return
    }
    setFormError(null)

    const { merged, listErrors, blocked } = mergeDrafts()
    setValues(merged)
    if (blocked) {
      setErrors(listErrors)
      return
    }

    const result = clientFormSchema.safeParse({ ...merged, niche: currentNiche() })
    if (!result.success) {
      const found = friendlyErrors(fieldErrors(result.error) as Partial<Record<ErrorKey, string>>)
      setErrors(found)
      const target = firstStepWithError(Object.keys(found))
      if (target >= 0) setStep(target)
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
  const noDetails = LIST_KEYS.every((k) => values[k].length === 0)
  const lastLabel = !isEdit && noDetails ? "Skip and save" : submitLabel
  // All steps stay mounted so typed text survives Back and Next; only the current one is visible.
  const stepClass = (n: number) => (step === n ? "flex flex-col gap-4" : "hidden")

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="flex flex-col gap-4">
      <p className="text-xs font-medium text-text-dim">
        Step {step + 1} of {STEP_NAMES.length} - {STEP_NAMES[step]}
      </p>
      {formError ? <ErrorBanner message={formError} /> : null}

      <div className={stepClass(0)}>
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

        <Select
          id="niche"
          label="Niche"
          value={nicheChoice}
          onChange={setNicheChoice}
          options={NICHES}
          placeholder="Choose a niche"
          error={nicheChoice !== OTHER_NICHE ? errors.niche : undefined}
        />
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
      </div>

      <div className={stepClass(1)}>
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
      </div>

      <div className={stepClass(2)}>
        <StringListField
          ref={listRefs.nameVariants}
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
          ref={listRefs.knownFor}
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
          ref={listRefs.competitors}
          label="Competitors"
          items={values.competitors}
          onChange={(items) => setField("competitors", items)}
          max={LIST_LIMITS.competitors}
          itemMax={LIST_ITEM_MAX}
          placeholder="A competing business name"
          hint="Optional."
          error={errors.competitors}
        />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <div>
          {step > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep(step - 1)} disabled={loading}>
              Back
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          ) : null}
          {step < LAST_STEP ? (
            <Button key="next" type="button" size="sm" onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button key="submit" type="submit" size="sm" loading={loading}>
              {lastLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
