import type { IncomingMessage, ServerResponse } from "node:http"
import path from "node:path"

import { currentBoard, publishWorkspace, seedBoard } from "./snapshots"
import { authenticate } from "./verify"
import { loadEnvFile } from "./env"

const BODY_LIMIT = 2_000_000

let envLoaded = false

export function dataDir(): string {
  return path.resolve(process.env.BOARD_DATA_DIR || path.join(process.cwd(), "data"))
}

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!envLoaded) {
    loadEnvFile()
    envLoaded = true
  }
  const pathname = requestPath(req.url)
  if (!pathname.startsWith("/api/")) return false

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return send(res, 200, { ok: true })
    }
    if (req.method === "GET" && pathname === "/api/workspace") {
      const auth = await authenticate(req.headers.authorization)
      if (!auth.ok) return send(res, auth.status, { message: auth.message })
      return send(res, 200, currentBoard(dataDir()))
    }
    if (req.method === "GET" && pathname === "/api/seed") {
      const auth = await authenticate(req.headers.authorization)
      if (!auth.ok) return send(res, auth.status, { message: auth.message })
      if (!auth.viewer.admin) return send(res, 403, { message: "Only admins can reset the boards." })
      return send(res, 200, { workspace: seedBoard() })
    }
    if (req.method === "PUT" && pathname === "/api/workspace") {
      const auth = await authenticate(req.headers.authorization)
      if (!auth.ok) return send(res, auth.status, { message: auth.message })
      const body = await readJson(req)
      const result = publishWorkspace(dataDir(), auth.viewer, body)
      if (!result.ok) return send(res, result.status, { message: result.message })
      return send(res, 200, currentBoard(dataDir()))
    }
    return send(res, 404, { message: "Not found." })
  } catch (error) {
    const message = error instanceof Error && error.message === "too large" ? "That save is too large." : "The request could not be completed."
    const status = error instanceof Error && error.message === "too large" ? 413 : 400
    return send(res, status, { message })
  }
}

function requestPath(url: string | undefined): string {
  const value = url ?? "/"
  const end = value.search(/[?#]/)
  return end === -1 ? value : value.slice(0, end)
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > BODY_LIMIT) throw new Error("too large")
    chunks.push(buffer)
  }
  if (chunks.length === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
}

function send(res: ServerResponse, status: number, body: unknown): boolean {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  })
  res.end(payload)
  return true
}
