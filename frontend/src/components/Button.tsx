import type { ButtonHTMLAttributes, ReactNode } from "react"

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline"
type Size = "sm" | "md"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-[#0b0b10] hover:bg-accent-hover disabled:hover:bg-accent shadow-[0_0_0_1px_rgba(164,143,255,0.4)]",
  secondary:
    "bg-surface-2 text-text border border-border hover:bg-surface-hover hover:border-text-faint",
  ghost: "bg-transparent text-text-dim hover:text-text hover:bg-surface-2",
  outline:
    "bg-transparent text-accent border border-accent hover:bg-accent-soft hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
  danger: "bg-transparent text-bad border border-bad/30 hover:bg-bad-soft",
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer whitespace-nowrap
        ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
