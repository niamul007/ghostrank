// ──────────────────────────────────────────
// GhostRank — Agency Controller
// ──────────────────────────────────────────
// The signed-in agency's own profile and report branding.
// The agencyId always comes from the JWT, never from the request.

import { Request, Response, NextFunction } from "express"
import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { AppError } from "../utils/AppError"
import { UpdateAgencyInput } from "../schemas/agency.schema"

// Explicit select: the password hash and email are never read from the database here.
const agencySelect = { id: true, name: true, logo: true, brandColors: true } as const

/** Picks the public branding fields. Anything else on the row (e.g. password) is dropped. */
export function toAgencyBranding(row: {
  id: string
  name: string
  logo: string | null
  brandColors: unknown
}) {
  return { id: row.id, name: row.name, logo: row.logo, brandColors: row.brandColors }
}

/** GET /api/agency */
export async function getAgency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const agency = await prisma.agency.findUnique({
      where: { id: req.user!.agencyId },
      select: agencySelect,
    })
    if (!agency) return next(new AppError("Agency not found", 404))

    res.status(200).json({ status: "success", data: { agency: toAgencyBranding(agency) } })
  } catch (err) {
    next(err)
  }
}

/** PATCH /api/agency — name, brandColor (-> brandColors: [hex]), logoUrl (-> logo). "" clears. */
export async function updateAgency(
  req: Request<{}, {}, UpdateAgencyInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, brandColor, logoUrl } = req.body

    const data: Prisma.AgencyUpdateInput = {}
    if (name !== undefined) data.name = name
    if (brandColor !== undefined) {
      data.brandColors = brandColor === "" ? Prisma.DbNull : [brandColor]
    }
    if (logoUrl !== undefined) data.logo = logoUrl === "" ? null : logoUrl

    const agency = await prisma.agency.update({
      where: { id: req.user!.agencyId },
      data,
      select: agencySelect,
    })

    res.status(200).json({ status: "success", data: { agency: toAgencyBranding(agency) } })
  } catch (err) {
    next(err)
  }
}
