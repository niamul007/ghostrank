import { useState, type KeyboardEvent } from "react"
import { Button } from "./Button"

interface StringListFieldProps {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  max: number
  itemMax: number
  placeholder?: string
  hint?: string
  error?: string
  /** Tap-to-add chips. Hidden once the list is full or the item is already added. */
  suggestions?: string[]
}

/** A small add-and-remove list of short text items with a visible limit. */
export function StringListField({
  label,
  items,
  onChange,
  max,
  itemMax,
  placeholder,
  hint,
  error,
  suggestions = [],
}: StringListFieldProps) {
  const [draft, setDraft] = useState("")
  const full = items.length >= max
  const id = `list-${label.toLowerCase().replace(/\s+/g, "-")}`

  function add(text: string) {
    const value = text.trim()
    if (!value || full) return
    if (items.some((i) => i.toLowerCase() === value.toLowerCase())) {
      setDraft("")
      return
    }
    onChange([...items, value])
    setDraft("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      add(draft)
    }
  }

  const chips = suggestions.filter((s) => !items.some((i) => i.toLowerCase() === s.toLowerCase()))
  const tooLong = draft.trim().length > itemMax

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-medium text-text-dim">
          {label}
        </label>
        <span className="text-xs text-text-faint">
          {items.length} of {max}
        </span>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, idx) => (
            <li
              key={`${item}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text"
            >
              <span className="min-w-0 break-words">{item}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="shrink-0 text-xs text-text-dim hover:text-bad"
                aria-label={`Remove ${item}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!full ? (
        <div className="flex gap-2">
          <input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`min-w-0 flex-1 rounded-md bg-surface-2 border px-3 py-2.5 text-sm text-text placeholder:text-text-faint
              outline-none transition-colors
              ${error || tooLong ? "border-bad focus:border-bad" : "border-border focus:border-accent"}`}
            aria-invalid={Boolean(error) || tooLong}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => add(draft)} disabled={!draft.trim() || tooLong}>
            Add
          </Button>
        </div>
      ) : (
        <p className="text-xs text-text-faint">Limit reached. Remove one to add another.</p>
      )}

      {tooLong ? <p className="text-xs text-bad">Keep it to {itemMax} characters or fewer</p> : null}

      {!full && chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label={`${label} suggestions`}>
          {chips.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-accent-border bg-accent-soft px-2.5 py-1 text-xs text-text hover:border-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-faint">{hint}</p>
      ) : null}
    </div>
  )
}
