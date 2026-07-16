import { api } from "./client"
import type { ApiSuccess, Scan, StartScanResponse } from "../types"

export async function startScan(clientId: string): Promise<StartScanResponse> {
  const res = await api.post<ApiSuccess<StartScanResponse>>(`/api/clients/${clientId}/scans`)
  return res.data.data
}

export async function getScan(id: string): Promise<Scan> {
  const res = await api.get<ApiSuccess<Scan>>(`/api/scans/${id}`)
  return res.data.data
}

export async function listScansForClient(clientId: string): Promise<Scan[]> {
  const res = await api.get<ApiSuccess<Scan[]>>(`/api/clients/${clientId}/scans`)
  return res.data.data
}
