export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-text animate-fade-in"
    >
      <span className="mt-0.5 font-mono text-bad" aria-hidden="true">
        !
      </span>
      <span>{message}</span>
    </div>
  )
}
