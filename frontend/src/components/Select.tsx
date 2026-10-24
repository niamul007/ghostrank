import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  error?: string
  id?: string
}

export function Select({ label, value, onChange, options, placeholder = "Choose an option", error, id }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const listId = `${selectId}-listbox`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedIndex = options.indexOf(value)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  // Keep the highlighted option visible inside the list's own scroll.
  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" })
  }, [open, active])

  function openList() {
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function pick(index: number) {
    const option = options[index]
    if (option !== undefined) onChange(option)
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault()
        openList()
      }
      return
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setActive((a) => Math.min(a + 1, options.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        break
      case "Enter":
      case " ":
        e.preventDefault()
        pick(active)
        break
      case "Escape":
        // Close only the list; keep the Escape from reaching the modal.
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        break
      case "Tab":
        setOpen(false)
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const letter = e.key.toLowerCase()
          for (let step = 1; step <= options.length; step++) {
            const i = (active + step) % options.length
            if (options[i].toLowerCase().startsWith(letter)) {
              setActive(i)
              break
            }
          }
        }
    }
  }

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-xs font-medium text-text-dim">
        {label}
      </label>
      <button
        type="button"
        id={selectId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${selectId}-option-${active}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${selectId}-error` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => {
          // Stops Firefox from clicking the button when Space is released.
          if (e.key === " ") e.preventDefault()
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-md bg-surface-2 border px-3 py-2.5 text-left text-sm
          outline-none transition-colors
          ${error ? "border-bad focus:border-bad" : "border-border focus:border-accent"}`}
      >
        <span className={selectedIndex >= 0 ? "text-text" : "text-text-faint"}>
          {selectedIndex >= 0 ? value : placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-surface-2 py-1 shadow-lg"
        >
          {options.map((option, i) => (
            <li
              key={option}
              id={`${selectId}-option-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              // Keep focus on the button so the keyboard keeps working.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm
                ${i === active ? "bg-border" : ""}
                ${i === selectedIndex ? "text-accent font-medium" : "text-text"}`}
            >
              {option}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={`${selectId}-error`} className="text-xs text-bad">
          {error}
        </p>
      ) : null}
    </div>
  )
}
