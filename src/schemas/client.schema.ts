// ──────────────────────────────────────────
// GhostRank — Client Validation Schemas
// ──────────────────────────────────────────

import { z } from "zod"

const ITEM_MAX = 80

// Blank string counts as "not provided" so empty form fields don't fail URL checks.
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

const optionalUrl = (label: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(2000, `${label} too long`)
      .refine(isHttpUrl, `${label} must be a valid http(s) URL`)
      .optional()
  )

// Trims every item, drops empty ones, then enforces the item count and length.
const stringList = (label: string, maxItems: number) =>
  z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.map((i) => (typeof i === "string" ? i.trim() : i)).filter((i) => i !== "")
        : v,
    z
      .array(z.string().max(ITEM_MAX, `${label} items must be ${ITEM_MAX} characters or fewer`))
      .max(maxItems, `${label} can have at most ${maxItems} items`)
      .optional()
  )

const optionalFields = {
  website: optionalUrl("Website"),
  facebookUrl: optionalUrl("Facebook URL"),
  mapsUrl: optionalUrl("Maps URL"),
  nameVariants: stringList("Name variants", 5),
  knownFor: stringList("Known for", 3),
  competitors: stringList("Competitors", 3),
}

export const createClientSchema = z
  .object({
    businessName: z
      .string({ error: "Business name is required" })
      .trim()
      .min(2, "Business name must be at least 2 characters")
      .max(200, "Business name too long"),
    city: z
      .string({ error: "City is required" })
      .trim()
      .min(2, "City must be at least 2 characters")
      .max(200, "City too long"),
    niche: z
      .string({ error: "Niche is required" })
      .trim()
      .min(2, "Niche must be at least 2 characters")
      .max(100, "Niche too long"),
    // Optional on create: blank counts as not provided, the controller falls back to city.
    location: z.preprocess(
      blankToUndefined,
      z
        .string()
        .trim()
        .min(2, "Location must be at least 2 characters")
        .max(200, "Location too long")
        .optional()
    ),
    ...optionalFields,
  })
  .refine((d) => d.website || d.facebookUrl || d.mapsUrl, {
    message: "Provide at least one of website, facebookUrl or mapsUrl",
    path: ["website"],
  })

// Updates are partial: a link can be replaced but not cleared (blank = unchanged),
// so an updated business can never end up with its last link removed.
export const updateClientSchema = z.object({
  businessName: z.string().trim().min(2).max(200).optional(),
  city: z.string().trim().min(2, "City must be at least 2 characters").max(200).optional(),
  niche: z.string().trim().min(2).max(100).optional(),
  location: z.string().trim().min(2).max(200).optional(),
  ...optionalFields,
})
