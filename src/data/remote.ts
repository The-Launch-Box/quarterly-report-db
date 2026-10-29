import { acquireIdToken } from "@/auth/msal"

import { parseWorkspace } from "./persist"
import type { Workspace } from "./types"

export interface BoardPayload {
  source: "saved" | "seed"
  savedAt: string | null
  savedBy: string | null
  expiresAt: string | null
  workspace: Workspace
}

export async function fetchBoard(): Promise<BoardPayload> {
  const response = await authed("/api/workspace")
  return readPayload(response)
}

export async function fetchSeed(): Promise<Workspace> {
  const response = await authed("/api/seed")
  if (!response.ok) throw new Error(await readError(response))
  const body: unknown = await response.json()
  if (!isRecord(body)) throw new Error("The starter figures could not be loaded.")
  const workspace = parseWorkspace(body.workspace)
  if (!workspace) throw new Error("The starter figures could not be loaded.")
  return workspace
}

export async function putBoard(workspace: Workspace): Promise<BoardPayload> {
  const response = await authed("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workspace),
  })
  return readPayload(response)
}

async function authed(path: string, init?: RequestInit): Promise<Response> {
  const token = await acquireIdToken()
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return fetch(path, { ...init, headers, cache: "no-store" })
}

async function readPayload(response: Response): Promise<BoardPayload> {
  if (!response.ok) throw new Error(await readError(response))
  const body: unknown = await response.json()
  if (!isRecord(body) || (body.source !== "saved" && body.source !== "seed")) {
    throw new Error("The boards could not be loaded.")
  }
  const workspace = parseWorkspace(body.workspace)
  if (!workspace) throw new Error("The boards could not be loaded.")
  return {
    source: body.source,
    savedAt: typeof body.savedAt === "string" ? body.savedAt : null,
    savedBy: typeof body.savedBy === "string" ? body.savedBy : null,
    expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
    workspace,
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (isRecord(body) && typeof body.message === "string" && body.message) return body.message
  } catch {
    /* use the fallback */
  }
  if (response.status === 401) return "Sign in again."
  if (response.status === 403) return "Only admins can change the boards."
  return "The boards could not be reached."
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
