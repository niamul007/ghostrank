import type { ReactNode } from "react"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 px-6 text-center">
      {icon ? <div className="text-text-faint">{icon}</div> : null}
      <p className="font-display text-base font-medium text-text">{title}</p>
      {description ? <p className="max-w-sm text-sm text-text-dim">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
