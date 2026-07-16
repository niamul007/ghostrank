import type { ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  GhostMark,
  IconClients,
  IconDashboard,
  IconLogout,
  IconReports,
  IconScans,
} from "./icons"

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: IconDashboard, end: true },
  { to: "/clients", label: "Clients", icon: IconClients, end: false },
  { to: "/scans", label: "Scans", icon: IconScans, end: false },
  { to: "/reports", label: "Reports", icon: IconReports, end: false },
]

export function Layout({ children }: { children: ReactNode }) {
  const { identity, agencyId, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  const displayName = identity?.name ?? identity?.email ?? agencyId ?? "Agency"
  const initial = displayName.trim().charAt(0).toUpperCase() || "?"

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface sm:flex">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <GhostMark className="h-7 w-7 text-accent" />
          <span className="font-display text-[17px] font-semibold tracking-tight text-text">
            GhostRank
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-text-dim hover:bg-surface-2 hover:text-text"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border-soft p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-dim transition-colors hover:bg-bad-soft hover:text-bad"
          >
            <IconLogout className="h-[18px] w-[18px]" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5 sm:hidden">
            <GhostMark className="h-6 w-6 text-accent" />
            <span className="font-display text-sm font-semibold text-text">GhostRank</span>
          </div>
          <div className="hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-text">{displayName}</p>
              <p className="text-xs text-text-faint font-mono">agency</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft font-mono text-sm font-semibold text-accent">
              {initial}
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 py-8 pb-24 sm:px-8 sm:pb-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface sm:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-accent" : "text-text-faint"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-text-faint"
        >
          <IconLogout className="h-5 w-5" />
          Log out
        </button>
      </nav>
    </div>
  )
}
