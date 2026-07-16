import type { HTMLAttributes, ReactNode } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
  hover?: boolean
}

export function Card({ children, padded = true, hover = false, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-surface border border-border
        ${padded ? "p-5 sm:p-6" : ""}
        ${hover ? "transition-colors hover:border-text-faint" : ""}
        ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
