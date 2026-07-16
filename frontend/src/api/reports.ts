import { api } from "./client"
import type { ApiSuccess, ReportData, ReportListItem, ReportRecord } from "../types"

/** Rich, freshly-computed report — scoreLabel + recommendations included. */
export async function createReport(scanId: string): Promise<ReportData> {
  const res = await api.post<ApiSuccess<ReportData>>(`/api/scans/${scanId}/report`)
  return res.data.data
}

/** Raw persisted row — see ReportRecord for what's missing vs createReport(). */
export async function getReport(id: string): Promise<ReportRecord> {
  const res = await api.get<ApiSuccess<ReportRecord>>(`/api/reports/${id}`)
  return res.data.data
}

export async function listReportsForClient(clientId: string): Promise<ReportListItem[]> {
  const res = await api.get<ApiSuccess<ReportListItem[]>>(`/api/clients/${clientId}/reports`)
  return res.data.data
}
