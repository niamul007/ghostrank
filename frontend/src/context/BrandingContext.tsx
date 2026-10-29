// ──────────────────────────────────────────
// GhostRank — Agency branding context
// ──────────────────────────────────────────
// Shares the agency logo between the top bar and the Settings page so a
// successful save updates the header avatar without a reload.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { getAgency } from "../api/agency"
import { useAuth } from "./AuthContext"

interface BrandingContextValue {
  logoUrl: string
  setLogoUrl: (logoUrl: string) => void
  agencyName: string
  setAgencyName: (agencyName: string) => void
}

const BrandingContext = createContext<BrandingContextValue | null>(null)

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [logoUrl, setLogoUrl] = useState("")
  const [agencyName, setAgencyName] = useState("")

  useEffect(() => {
    if (!isAuthenticated) {
      setLogoUrl("")
      setAgencyName("")
      return
    }
    let cancelled = false
    getAgency()
      .then((agency) => {
        if (cancelled) return
        setLogoUrl(agency.logo ?? "")
        setAgencyName(agency.name ?? "")
      })
      .catch(() => {
        // The header falls back to the letter avatar.
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const value = useMemo(
    () => ({ logoUrl, setLogoUrl, agencyName, setAgencyName }),
    [logoUrl, agencyName],
  )

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider")
  return ctx
}
