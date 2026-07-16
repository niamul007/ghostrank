export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className="inline-block rounded-full border-2 border-border border-t-accent animate-spin"
    />
  )
}

export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-text-faint">
      <Spinner size={26} />
      <p className="text-sm font-mono">{label}</p>
    </div>
  )
}
