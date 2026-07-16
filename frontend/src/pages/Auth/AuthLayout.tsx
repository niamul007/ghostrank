import type { ReactNode } from "react"
import { GhostMark } from "../../components/icons"

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-12">
      {/* Ambient glow — the one deliberate flourish on an otherwise quiet screen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[620px] -translate-x-1/2 rounded-full opacity-25 blur-[110px]"
        style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
      />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <GhostMark className="h-9 w-9 text-accent" />
          <div>
            <h1 className="font-display text-xl font-semibold text-text">{title}</h1>
            <p className="mt-1 text-sm text-text-dim">{subtitle}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]">
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-text-faint">{footer}</p>
      </div>
    </div>
  )
}
