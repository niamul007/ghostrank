// ──────────────────────────────────────────
// Frontend validation — mirrors the backend's zod schemas
// (src/schemas/auth.schema.ts, src/schemas/client.schema.ts) so form
// errors show up before a round trip, not just after a 400 comes back.
// Register adds a client-only confirmPassword check the backend doesn't
// have any concept of.
// ──────────────────────────────────────────

import { z } from "zod"
import { LIST_ITEM_MAX, LIST_LIMITS } from "./clientOptions"
import type { Client } from "../types"

export const registerFormSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one digit"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>

export const loginFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

// Blank is allowed (the "at least one link" rule is checked on the whole form)
// and becomes undefined so it is left out of the request.
const linkField = (label: string) =>
  z
    .string()
    .trim()
    .max(2000, `${label} is too long`)
    .refine((v) => v === "" || isHttpUrl(v), `${label} must be a valid http(s) link, like https://example.com`)
    .transform((v) => (v === "" ? undefined : v))

// Trims every item and drops empty ones, then enforces item count and length.
const listField = (label: string, maxItems: number) =>
  z
    .array(z.string())
    .transform((items) => items.map((i) => i.trim()).filter((i) => i !== ""))
    .pipe(
      z
        .array(z.string().max(LIST_ITEM_MAX, `Each ${label} item must be ${LIST_ITEM_MAX} characters or fewer`))
        .max(maxItems, `${label} can have at most ${maxItems} items`)
    )

export const clientFormSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(2, "Business name must be at least 2 characters")
      .max(200, "Business name is too long"),
    city: z
      .string()
      .trim()
      .min(2, "City or area must be at least 2 characters")
      .max(200, "City or area is too long"),
    niche: z.string().trim().min(1, "Choose a niche").max(100, "Niche is too long"),
    website: linkField("Website"),
    facebookUrl: linkField("Facebook page"),
    mapsUrl: linkField("Google Maps link"),
    nameVariants: listField("Name variants", LIST_LIMITS.nameVariants),
    knownFor: listField("Known for", LIST_LIMITS.knownFor),
    competitors: listField("Competitors", LIST_LIMITS.competitors),
  })
  .refine((d) => d.website || d.facebookUrl || d.mapsUrl, {
    message: "Add at least one link",
    path: ["links"],
  })

/** Validated form output — what gets sent to the API. */
export type ClientFormValues = z.output<typeof clientFormSchema>

/** Raw form state before validation (links are plain strings, "" when empty). */
export type ClientFormInput = z.input<typeof clientFormSchema>

/** Which form fields belong to each step of the business form (0-based). "links" is the at-least-one-link rule. */
export const CLIENT_FORM_STEP_FIELDS: ReadonlyArray<ReadonlyArray<keyof ClientFormInput | "links">> = [
  ["businessName", "city", "niche"],
  ["website", "facebookUrl", "mapsUrl", "links"],
  ["nameVariants", "knownFor", "competitors"],
]

/** Runs the full client schema and returns only the errors that belong to one step. */
export function clientStepErrors(input: ClientFormInput, step: number): Record<string, string> {
  const result = clientFormSchema.safeParse(input)
  if (result.success) return {}
  const all = fieldErrors(result.error as z.ZodError<Record<string, unknown>>) as Record<string, string>
  const out: Record<string, string> = {}
  for (const key of CLIENT_FORM_STEP_FIELDS[step]) {
    if (all[key]) out[key] = all[key]
  }
  return out
}

/** The first step (0-based) that owns one of the given error keys, or -1. */
export function firstStepWithError(errorKeys: string[]): number {
  return CLIENT_FORM_STEP_FIELDS.findIndex((fields) => fields.some((f) => errorKeys.includes(f)))
}

/**
 * Starting values for the edit form. Old clients may have no city (only a
 * location), so the location is shown as the city in that case.
 */
export function clientToFormInput(client: Client): ClientFormInput {
  return {
    businessName: client.businessName,
    city: client.city || client.location,
    niche: client.niche,
    website: client.website ?? "",
    facebookUrl: client.facebookUrl ?? "",
    mapsUrl: client.mapsUrl ?? "",
    nameVariants: client.nameVariants ?? [],
    knownFor: client.knownFor ?? [],
    competitors: client.competitors ?? [],
  }
}

/** Flattens a zod error into { field: firstMessage } — what Input's error prop expects. */
export function fieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError<T>
): Partial<Record<keyof T, string>> {
  const flat = error.flatten().fieldErrors as Record<string, string[] | undefined>
  const out: Partial<Record<keyof T, string>> = {}
  for (const key in flat) {
    const messages = flat[key]
    if (messages && messages.length > 0) {
      out[key as keyof T] = messages[0]
    }
  }
  return out
}
