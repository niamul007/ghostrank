// ──────────────────────────────────────────
// GhostRank — Client Validation Schemas
// ──────────────────────────────────────────
// Zod validates incoming request data.
// If someone sends { niche: 123 } instead of a string,
// Zod catches it before it reaches the controller.

import { z } from "zod"

export const createClientSchema = z.object({
  body: z.object({
    businessName: z
      .string({ required_error: "Business name is required" })
      .min(2, "Business name must be at least 2 characters")
      .max(200, "Business name too long"),
    niche: z
      .string({ required_error: "Niche is required" })
      .min(2, "Niche must be at least 2 characters")
      .max(100, "Niche too long"),
    location: z
      .string({ required_error: "Location is required" })
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