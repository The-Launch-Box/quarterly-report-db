import fs from "node:fs"
import path from "node:path"

import { isExpired } from "../src/data/retention"
import { parseWorkspace } from "../src/data/persist"
import {
  createSeedWorkspace,
  withExpectedColumn,
  withFirmRatios,
  withImprovDeck,
  withoutRetiredStatuses,
  withoutYtdSubtitle,
} from "../src/data/seed"
import type { Workspace } from "../src/data/types"

export interface StoredSnapshot {
  savedAt: string
  savedBy: string
  workspace: Workspace
}

export interface BoardPayload {
  source: "saved" | "seed"
  savedAt: string | null
  savedBy: string | null
  expiresAt: string | null
  workspace: Workspace
}

export type PublishResult =
  | { ok: true; snapshot: StoredSnapshot }
  | { ok: false; status: 400 | 403; message: string }

export function currentBoard(dir: string, now = Date.now()): BoardPayload {
  const live = readLiveSnapshot(dir, now)
  if (!live) return seedPayload()
  return {
    source: "saved",
    savedAt: live.savedAt,
    savedBy: live.savedBy,
    expiresAt: null,
    workspace: withoutRetiredStatuses(withoutYtdSubtitle(withFirmRatios(withImprovDeck(live.workspace)))),
  }
}

export function seedBoard(): Workspace {
  return withoutYtdSubtitle(withFirmRatios(withExpectedColumn(createSeedWorkspace())))
}

export function publishWorkspace(
  dir: string,
  viewer: { admin: boolean; email: string },
  body: unknown,
  now = Date.now(),
): PublishResult {
  if (!viewer.admin) return { ok: false, status: 403, message: "Only admins can save." }
  const workspace = parseWorkspace(body)
  if (!workspace) return { ok: false, status: 400, message: "The boards could not be saved." }
  const snapshot = saveSnapshot(
    dir,
    { savedBy: viewer.email, workspace: withoutRetiredStatuses(withExpectedColumn(workspace)) },
    now,
  )
  return { ok: true, snapshot }
}

export function readLiveSnapshot(dir: string, now = Date.now()): StoredSnapshot | null {
  purgeExpired(dir, now)
  return readSnapshotFile(currentPath(dir))
}

export function saveSnapshot(
  dir: string,
  input: { savedBy: string; workspace: Workspace },
  now = Date.now(),
): StoredSnapshot {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  purgeExpired(dir, now)
  const previous = readSnapshotFile(currentPath(dir))
  if (previous) {
    fs.mkdirSync(historyDir(dir), { recursive: true, mode: 0o700 })
    const stamp = previous.savedAt.replace(/[:.]/g, "-")
    writeJson(path.join(historyDir(dir), `${stamp}.json`), previous)
  }
  const snapshot: StoredSnapshot = {
    savedAt: new Date(now).toISOString(),
    savedBy: input.savedBy,
    workspace: input.workspace,
  }
  writeJson(currentPath(dir), snapshot)
  purgeExpired(dir, now)
  return snapshot
}

export function purgeExpired(dir: string, now = Date.now()): void {
  const folder = historyDir(dir)
  if (!fs.existsSync(folder)) return
  for (const name of fs.readdirSync(folder)) {
    const file = path.join(folder, name)
    const snapshot = readSnapshotFile(file)
    if (!snapshot || isExpired(snapshot.savedAt, now)) fs.unlinkSync(file)
  }
}

function seedPayload(): BoardPayload {
  return {
    source: "seed",
    savedAt: null,
    savedBy: null,
    expiresAt: null,
    workspace: seedBoard(),
  }
}

function readSnapshotFile(file: string): StoredSnapshot | null {
  if (!fs.existsSync(file)) return null
  try {
    const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
    if (!isRecord(value) || typeof value.savedAt !== "string" || typeof value.savedBy !== "string") return null
    const workspace = parseWorkspace(value.workspace)
    if (!workspace) return null
    return {
      savedAt: value.savedAt,
      savedBy: value.savedBy,
      workspace: withoutRetiredStatuses(withoutYtdSubtitle(withFirmRatios(withExpectedColumn(workspace)))),
    }
  } catch {
    return null
  }
}

function writeJson(file: string, value: unknown): void {
  const temp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600 })
  fs.renameSync(temp, file)
}

function currentPath(dir: string): string {
  return path.join(dir, "current.json")
}

function historyDir(dir: string): string {
  return path.join(dir, "history")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
