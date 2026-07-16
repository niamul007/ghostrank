import { api } from "./client"
import type { ApiSuccess, Client, CreateClientPayload, UpdateClientPayload } from "../types"

export async function listClients(): Promise<Client[]> {
  const res = await api.get<ApiSuccess<Client[]>>("/api/clients")
  return res.data.data
}

export async function getClient(id: string): Promise<Client> {
  const res = await api.get<ApiSuccess<Client>>(`/api/clients/${id}`)
  return res.data.data
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const res = await api.post<ApiSuccess<Client>>("/api/clients", payload)
  return res.data.data
}

export async function updateClient(id: string, payload: UpdateClientPayload): Promise<Client> {
  const res = await api.patch<ApiSuccess<Client>>(`/api/clients/${id}`, payload)
  return res.data.data
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/api/clients/${id}`)
}
