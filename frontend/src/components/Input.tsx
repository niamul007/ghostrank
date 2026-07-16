import { forwardRef, type InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...rest }, ref) => {
    const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-medium text-text-dim">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`rounded-md bg-surface-2 border px-3 py-2.5 text-sm text-text placeholder:text-text-faint
            outline-none transition-colors
            ${error ? "border-bad focus:border-bad" : "border-border focus:border-accent"}
            ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-bad">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-text-faint">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)
Input.displayName = "Input"
