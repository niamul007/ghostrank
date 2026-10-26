import { api } from "./client"
import type { AgencyBranding, ApiSuccess, UpdateAgencyPayload } from "../types"

export async function getAgency(): Promise<AgencyBranding> {
  const res = await api.get<ApiSuccess<{ agency: AgencyBranding }>>("/api/agency")
  return res.data.data.agency
}

export async function updateAgency(payload: UpdateAgencyPayload): Promise<AgencyBranding> {
  const res = await api.patch<ApiSuccess<{ agency: AgencyBranding }>>("/api/agency", payload)
  return res.data.data.agency
}
