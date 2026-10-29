import { useEffect, useRef, useState, type ReactNode } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useBranding } from "../context/BrandingContext"
import {
  GhostMark,
  IconClients,
  IconDashboard,
  IconLogout,
  IconReports,
  IconScans,
  IconSettings,
} from "./icons"

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: IconDashboard, end: true },
  { to: "/clients", label: "Clients", icon: IconClients, end: false },
  { to: "/scans", label: "Scans", icon: IconScans, end: false },
  { to: "/reports", label: "Reports", icon: IconReports, end: false },
  { to: "/settings", label: "Settings", icon: IconSettings, end: false },
]

export function Layout({ children }: { children: ReactNode }) {
  const { identity, agencyId, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLElement>(null)
  const { logoUrl, agencyName } = useBranding()
  const [logoFailed, setLogoFailed] = useState(false)

  // A new URL gets a fresh chance to load.
  useEffect(() => setLogoFailed(false), [logoUrl])

  // The window no longer scrolls on desktop, so reset the content scroller on navigation.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  const logo = logoUrl.trim()
  const showLogo = /^https?:\/\/\S+$/i.test(logo) && !logoFailed

  const email = identity?.email ?? agencyId ?? "Agency"
  const name = agencyName.trim()
  const initial = (name || email).trim().charAt(0).toUpperCase() || "?"

  return (
    <div className="print-shell flex min-h-screen bg-bg sm:h-screen sm:supports-[height:100dvh]:h-dvh sm:min-h-0 sm:overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-border bg-surface sm:flex sm:min-h-0">
        <div className="flex shrink-0 items-center gap-2.5 px-5 py-6">
          <GhostMark className="h-7 w-7 text-accent" />
          <span className="font-display text-[17px] font-semibold tracking-tight text-text">
            GhostRank
          </span>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
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

        <div className="shrink-0 border-t border-border-soft p-3">
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
      <div className="print-shell flex min-w-0 flex-1 flex-col sm:min-h-0">
        <header className="no-print flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5 sm:hidden">
            <GhostMark className="h-6 w-6 text-accent" />
            <span className="font-display text-sm font-semibold text-text">GhostRank</span>
          </div>
          <div className="hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="max-w-[200px] text-right leading-tight">
              <p className="truncate text-sm font-bold text-text" title={name || email}>
                {name || email}
              </p>
              {name && (
                <p className="truncate text-xs text-text-faint font-mono" title={email}>
                  {email}
                </p>
              )}
            </div>
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-mono text-sm font-semibold text-accent">
              {showLogo ? (
                <img
                  src={logo}
                  alt=""
                  onError={() => setLogoFailed(true)}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
          </div>
        </header>

        <main
          ref={scrollRef}
          className="print-main flex-1 px-5 py-8 pb-24 sm:min-h-0 sm:overflow-y-auto sm:px-8 sm:pb-8"
        >
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface sm:hidden">
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
