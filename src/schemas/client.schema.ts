// ──────────────────────────────────────────
// GhostRank — Client Validation Schemas
// ──────────────────────────────────────────

import { z } from "zod"

export const createClientSchema = z.object({
  body: z.object({
    businessName: z
      .string({ error: "Business name is required" })
      .min(2, "Business name must be at least 2 characters")
      .max(200, "Business name too long"),
    niche: z
      .string({ error: "Niche is required" })
      .min(2, "Niche must be at least 2 characters")
      .max(100, "Niche too long"),
    location: z
      .string({ error: "Location is required" })
      .min(2, "Location must be at least 2 characters")
      .max(200, "Location too long"),
  }),
})

export const updateClientSchema = z.object({
  body: z.object({
    businessName: z.string().min(2).max(200).optional(),
    niche: z.string().min(2).max(100).optional(),
    location: z.string().min(2).max(200).optional(),
  }),
})