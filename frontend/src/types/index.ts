// ──────────────────────────────────────────
// GhostRank — Shared frontend types
// ──────────────────────────────────────────
// Mirrors the backend's Prisma models and controller response shapes
// (see ../../../src/{controllers,services,types} on the backend).
// Kept intentionally close to what the API actually returns, including
// its inconsistencies — see the two Report shapes below.

export type Platform = "chatgpt" | "perplexity" | "gemini" | "claude"

export type SentimentLabel = "positive" | "neutral" | "negative"

export type PromptCategory = "direct" | "comparison" | "discovery" | "specific"

export type ScanStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED"

export type AgencyRole = "AGENCY" | "ADMIN"

// ──────────────────────────────────────────
// Envelope shapes every endpoint responds with
// ──────────────────────────────────────────

export interface ApiSuccess<T> {
  status: "success"
  data: T
}

/** DELETE /api/clients/:id responds with a message, not a data key. */
export interface ApiMessage {
  status: "success"
  message: string
}

/** AppError-driven failures: 401s, 403s, 409s, generic 500s. */
export interface ApiErrorMessage {
  status: "error"
  message: string
}

/** zod `validate()` middleware failures: 400 with per-field arrays. */
export interface ApiErrorFields {
  status: "error"
  errors: Record<string, string[] | undefined>
}

export type ApiErrorBody = ApiErrorMessage | ApiErrorFields

export function isFieldErrors(body: unknown): body is ApiErrorFields {
  return (
    typeof body === "object" &&
    body !== null &&
    "errors" in body &&
    typeof (body as ApiErrorFields).errors === "object"
  )
}

// ──────────────────────────────────────────
// Auth
// ──────────────────────────────────────────

export interface Agency {
  id: string
  name: string
  email: string
  logo: string | null
  brandColors: unknown
  role: AgencyRole
  createdAt: string
  updatedAt: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

/** Decoded JWT payload — the only identity info available after login. */
export interface JwtClaims {
  agencyId: string
  role: AgencyRole
  iat: number
  exp: number
}

// ──────────────────────────────────────────
// Clients
// ──────────────────────────────────────────

/** The trimmed-down scan summary embedded in client list/detail responses. */
export interface ClientScanSummary {
  id: string
  score: number | null
  status: ScanStatus
  createdAt: string
}

export interface Client {
  id: string
  agencyId: string
  businessName: string
  niche: string
  /** Legacy column: older clients only have this. New ones get it copied from city. */
  location: string
  city: string | null
  website: string | null
  facebookUrl: string | null
  mapsUrl: string | null
  nameVariants: string[]
  knownFor: string[]
  competitors: string[]
  createdAt: string
  updatedAt: string
  /** Present on list (latest 1) and detail (full history) responses only. */
  scans?: ClientScanSummary[]
}

export interface CreateClientPayload {
  businessName: string
  city: string
  niche: string
  website?: string
  facebookUrl?: string
  mapsUrl?: string
  nameVariants?: string[]
  knownFor?: string[]
  competitors?: string[]
}

export type UpdateClientPayload = Partial<CreateClientPayload>

// ──────────────────────────────────────────
// Scans
// ──────────────────────────────────────────

export interface ScanResult {
  id: string
  scanId: string
  platform: string
  prompt: string
  category: string
  response: string
  mentioned: boolean
  position: number | null
  sentiment: string | null
}

export interface VisibilityScore {
  overall: number
  byPlatform: Record<Platform, number>
  mentionCount: number
  totalPrompts: number
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  averagePosition: number | null
}

export interface Scan {
  id: string
  clientId: string
  status: ScanStatus
  score: number | null
  promptsUsed: string[] | null
  rawResults: VisibilityScore | null
  errorMsg: string | null
  createdAt: string
  updatedAt: string
  scanResults: ScanResult[]
  client: Client
}

export interface StartScanResponse {
  scanId: string
  message: string
}

export type RunStatus = "SUCCESS" | "FAILED"

/** One ScanRun row from GET /api/scans/:id/runs (a single AI answer). */
export interface ScanRunRow {
  id: string
  scanId: string
  questionId: string
  group: string
  questionText: string
  scored: boolean
  runNumber: number
  provider: string
  model: string
  status: RunStatus
  answer: string
  errorLabel: string | null
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number | null
  createdAt: string
}

/** GET /api/scans/:id/runs — no score here; fetch the scan for that. */
export interface ScanRunsResponse {
  id: string
  status: ScanStatus
  errorMsg: string | null
  rawResults: { questionSetVersion?: number | string } | null
  runs: ScanRunRow[]
}

// ──────────────────────────────────────────
// Reports
// ──────────────────────────────────────────

export type ResultIssue = "not_mentioned" | "low_position" | "negative" | "ok"

/**
 * What POST /api/scans/:scanId/report and GET /api/reports/:id both return.
 * Mirrors ReportData in the backend's src/services/report.service.ts.
 */
export interface ReportData {
  version: 1
  id: string
  generatedAt: string
  business: {
    name: string
    niche: string
    location: string
  }
  score: number
  scoreLabel: string
  platforms: {
    platform: Platform
    score: number
    mentioned: number
    total: number
  }[]
  results: {
    prompt: string
    platform: string
    category: string
    mentioned: boolean
    position: number | null
    sentiment: string | null
    answerExcerpt: string
    competitors: string[]
    issue: ResultIssue
    fix: string | null
  }[]
  recommendations: string[]
  // Added later — absent on reports generated before they existed, so the
  // page treats each as optional and hides its section when missing.
  breakdown?: ScoreBreakdown
  byPromptType?: Partial<Record<PromptCategory, { total: number; mentioned: number }>>
  competitors?: { name: string; mentions: number }[]
  topFixes?: { recommendation: string; missedPrompts: number }[]
}

/**
 * Report for a v2 scan (version 2).
 * Mirrors ReportDataV2 in the backend's src/services/reportV2.ts.
 */
export interface ReportDataV2 {
  version: 2
  id: string
  generatedAt: string
  business: { name: string; niche: string; location: string; city: string | null }
  agency: { name: string; logo: string | null; brandColors: string[] }
  scanDate: string
  score: number
  scoreLabel: "Strong" | "Mixed" | "Rarely named" | "Not named"
  scoreRange: { low: number; high: number }
  basedOnRuns: number
  lowConfidence: boolean
  averagePosition: number | null
  byGroup: {
    group: "find" | "compare" | "need"
    mentioned: number
    counted: number
    percent: number
  }[]
  questions: { questionId: string; group: string; text: string; mentioned: number; counted: number }[]
  reputationQuestion: { questionId: string; text: string; mentioned: number; counted: number } | null
  named: {
    others: { name: string; runs: number; percent: number }[]
    chosenCompetitors: { name: string; runs: number; percent: number }[]
  }
  reputation: { answers: string[] }
  /** Missing on reports saved before this field existed */
  sources?: { domains: { domain: string; runs: number }[]; totalRuns: number }
  model: { provider: string; model: string }
}

/** Either report shape; narrow on `version`. */
export type Report = ReportData | ReportDataV2

export interface ScoreBreakdown {
  mentionRate: { earned: number; max: number }
  position: { earned: number; max: number }
  coverage: { earned: number; max: number }
  sentiment: { earned: number; max: number }
}

/** What GET /api/clients/:clientId/reports returns — scan is trimmed. */
export interface ReportListItem {
  id: string
  scanId: string
  clientId: string
  pdfUrl: string | null
  webUrl: string | null
  createdAt: string
  scan: {
    score: number | null
    status: ScanStatus
    createdAt: string
  }
}

// Agency branding (GET/PATCH /api/agency)

export interface AgencyBranding {
  id: string
  name: string
  logo: string | null
  /** Saved as a one-element array of hex colours, or null when unset. */
  brandColors: string[] | null
}

/** "" clears brandColor / logoUrl. */
export interface UpdateAgencyPayload {
  name?: string
  brandColor?: string
  logoUrl?: string
}
