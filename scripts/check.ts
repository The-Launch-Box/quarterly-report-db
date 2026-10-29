import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { isAdminEmail, isLaunchboxEmail, launchboxEmailFromClaims } from "../src/auth/access"
import { formatCurrency, parseNumber, parsePercentInput } from "../src/data/format"
import { isExpired, SNAPSHOT_TTL_MS } from "../src/data/retention"
import { publishWorkspace, readLiveSnapshot, saveSnapshot } from "../server/snapshots"
import { aggregateColumn, cellNumber, computeKpis } from "../src/data/metrics"
import { parseWorkspace } from "../src/data/persist"
import { reducer } from "../src/data/reducer"
import { createSeedWorkspace, seedProblems, varianceStatus, withExpectedColumn } from "../src/data/seed"
import { EXPECTED_COLUMN_ID, LABEL_COLUMN_ID, type Board, type Workspace } from "../src/data/types"

function must<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) throw new Error(message)
  return value
}

const problems = seedProblems()
if (problems.length > 0) throw new Error(problems.join("\n"))

if (parseNumber("$1.2M") !== 1_200_000) throw new Error("parse millions")
if (parseNumber("3k") !== 3000) throw new Error("parse thousands")
if (parsePercentInput("86%") !== 0.86) throw new Error("parse percent sign")
if (parsePercentInput("0.86") !== 0.86) throw new Error("parse ratio")
if (!formatCurrency(-1200).startsWith("−")) throw new Error("minus glyph")

const seed = createSeedWorkspace()
const parsed = parseWorkspace(JSON.parse(JSON.stringify(seed)) as unknown)
if (!parsed || parsed.boards.length !== 3) throw new Error("roundtrip failed")
if (parseWorkspace({ version: 1, boards: [] }) !== null) throw new Error("empty boards accepted")
if (parseWorkspace({ version: 2, boards: seed.boards }) !== null) throw new Error("bad version accepted")

const ytd = must(seed.boards.find((board) => board.id === "ytd"), "ytd")
const echelon = must(ytd.groups.find((group) => group.id === "echelon"), "echelon")
const revenueRow = must(
  echelon.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue"),
  "revenue row",
)
const q4 = must(ytd.columns.find((column) => column.id === "q4"), "q4")
const ytdColumn = must(ytd.columns.find((column) => column.id === "ytd"), "ytd column")

const edited = reducer(seed, {
  type: "set-cell",
  boardId: "ytd",
  groupId: "echelon",
  rowId: revenueRow.id,
  columnId: "q4",
  value: "9999999",
})
const editedBoard = must(edited.boards.find((board) => board.id === "ytd"), "edited ytd")
const editedRow = must(
  editedBoard.groups.find((group) => group.id === "echelon")?.rows.find((row) => row.id === revenueRow.id),
  "edited row",
)
if (cellNumber(q4, editedRow, editedBoard.columns) !== 9_999_999) throw new Error("q4 cell did not update")
const expectedYtd = ["q1", "q2", "q3"].reduce((sum, id) => sum + Number(editedRow.cells[id] ?? 0), 0) + 9_999_999
if (cellNumber(ytdColumn, editedRow, editedBoard.columns) !== expectedYtd) throw new Error("ytd formula did not follow q4")

const blocked = reducer(edited, {
  type: "set-cell",
  boardId: "ytd",
  groupId: "echelon",
  rowId: revenueRow.id,
  columnId: "ytd",
  value: "1",
})
const blockedRow = must(
  blocked.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "echelon")?.rows.find((row) => row.id === revenueRow.id),
  "blocked row",
)
if (blockedRow.cells.ytd) throw new Error("formula cell was stored")

const q4Kpi = computeKpis(editedBoard, "echelon").find((kpi) => kpi.id === "q4-revenue")
if (!q4Kpi || q4Kpi.value !== "$10.00M") throw new Error(`q4 kpi ${q4Kpi?.value ?? "missing"}`)

const headcount = must(seed.boards.find((board) => board.id === "headcount"), "headcount")
const cost = must(headcount.columns.find((column) => column.id === "cost"), "cost")
const engineering = must(
  headcount.groups.find((group) => group.id === "echelon")?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Engineering"),
  "engineering",
)
if (cellNumber(cost, engineering, headcount.columns) !== 52 * 215_000) throw new Error("fully loaded seed")
const rate = must(headcount.columns.find((column) => column.id === "rate"), "rate")
const echelonRoles = must(headcount.groups.find((group) => group.id === "echelon"), "echelon roles").rows
if (aggregateColumn(rate, echelonRoles, headcount.columns) !== null) throw new Error("annual rate was summed across roles")

const hired = reducer(seed, {
  type: "set-cell",
  boardId: "headcount",
  groupId: "echelon",
  rowId: engineering.id,
  columnId: "q4",
  value: "60",
})
const hiredBoard = must(hired.boards.find((board) => board.id === "headcount"), "hired board")
const hiredRow = must(
  hiredBoard.groups.find((group) => group.id === "echelon")?.rows.find((row) => row.id === engineering.id),
  "hired row",
)
if (cellNumber(cost, hiredRow, hiredBoard.columns) !== 60 * 215_000) throw new Error("fully loaded did not follow forecast")

const heads = computeKpis(headcount, "echelon").find((kpi) => kpi.id === "q4-heads")
if (!heads || heads.value !== "113") throw new Error(`headcount kpi ${heads?.value ?? "missing"}`)

let workspace = reducer(seed, { type: "add-column", boardId: "revenue", name: "Notes", kind: "text" })
const withColumn = must(workspace.boards.find((board) => board.id === "revenue"), "revenue")
if (!withColumn.columns.some((column) => column.name === "Notes")) throw new Error("column missing")
const firstGroup = must(withColumn.groups[0], "first group")
workspace = reducer(workspace, { type: "add-row", boardId: "revenue", groupId: firstGroup.id })
const grown = must(workspace.boards.find((board) => board.id === "revenue")?.groups[0], "grown")
if (grown.rows.length !== firstGroup.rows.length + 1) throw new Error("row missing")

let solo = seed
for (const company of seed.boards[0]?.groups.slice(1) ?? []) {
  solo = reducer(solo, { type: "delete-company", groupId: company.id })
}
const lastId = must(solo.boards[0]?.groups[0], "last company").id
solo = reducer(solo, { type: "delete-company", groupId: lastId })
if (solo.boards[0]?.groups.length !== 1) throw new Error("last company was removed")

for (const board of seed.boards) {
  if (board.columns[0]?.id !== LABEL_COLUMN_ID) throw new Error(`${board.id} label column is not first`)
  const expectedIndex = board.columns.findIndex((column) => column.id === EXPECTED_COLUMN_ID)
  const q1Index = board.columns.findIndex((column) => column.id === "q1")
  if (expectedIndex !== 1) throw new Error(`${board.id} expected is not beside the first quarter`)
  if (q1Index >= 0 && expectedIndex !== q1Index - 1) throw new Error(`${board.id} expected is not beside Q1`)
  for (const group of board.groups) {
    for (const row of group.rows) {
      if (!row.cells[EXPECTED_COLUMN_ID]) throw new Error(`${board.id} ${row.id} missing expected`)
    }
  }
}

const echelonRevenue = must(
  ytd.groups.find((group) => group.id === "echelon")?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue"),
  "echelon revenue",
)
if (echelonRevenue.cells[EXPECTED_COLUMN_ID] !== "19344000") {
  throw new Error(`echelon annual plan ${echelonRevenue.cells[EXPECTED_COLUMN_ID] ?? "missing"}`)
}
if (echelonRevenue.cells.status !== "On track") throw new Error("echelon revenue is inside 4% of expected")
if (engineering.cells[EXPECTED_COLUMN_ID] !== "54") throw new Error("engineering expected plan")
if (engineering.cells.status !== "On track") throw new Error("engineering forecast is inside 4% of plan")

const improvRevenue = must(
  ytd.groups.find((group) => group.id === "improv")?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue"),
  "improv revenue",
)
if (improvRevenue.cells.status !== "Behind") throw new Error("improv revenue is more than 8% under expected")
const dxRevenue = must(
  ytd.groups.find((group) => group.id === "dxfoundation")?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue"),
  "dx revenue",
)
if (dxRevenue.cells.status !== "Watch") throw new Error("dx revenue sits between 4% and 8% under expected")
const gAndA = must(
  headcount.groups.find((group) => group.id === "hyperscayle")?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "G&A"),
  "hyperscayle g&a",
)
if (gAndA.cells.status !== "Ahead") throw new Error("g&a forecast is more than 8% over expected")

if (varianceStatus(104, 100) !== "On track") throw new Error("4% is on track")
if (varianceStatus(96, 100) !== "On track") throw new Error("4% under is on track")
if (varianceStatus(108, 100) !== "Watch") throw new Error("8% is still inside the outer band")
if (varianceStatus(92, 100) !== "Watch") throw new Error("8% under is still inside the outer band")
if (varianceStatus(109, 100) !== "Ahead") throw new Error("past 8% above is ahead")
if (varianceStatus(91, 100) !== "Behind") throw new Error("past 8% below is behind")
if (varianceStatus(0, 0) !== "On track") throw new Error("zero expected match")
if (varianceStatus(1, 0) !== "Ahead") throw new Error("positive against zero expected")

const kept = withExpectedColumn(seed)
const keptExpected = kept.boards
  .find((board) => board.id === "ytd")
  ?.groups.find((group) => group.id === "echelon")
  ?.rows.find((row) => row.id === echelonRevenue.id)
if (keptExpected?.cells[EXPECTED_COLUMN_ID] !== "19344000") throw new Error("expected column was rewritten")

const misplaced = withExpectedColumn({
  ...seed,
  boards: seed.boards.map((board) => ({
    ...board,
    columns: [
      must(board.columns.find((column) => column.id === EXPECTED_COLUMN_ID), "expected"),
      ...board.columns.filter((column) => column.id !== EXPECTED_COLUMN_ID),
    ],
  })),
})
const moved = must(misplaced.boards.find((board) => board.id === "ytd"), "moved ytd")
if (moved.columns[0]?.id !== LABEL_COLUMN_ID || moved.columns[1]?.id !== EXPECTED_COLUMN_ID || moved.columns[2]?.id !== "q1") {
  throw new Error("expected was not moved beside Q1")
}

const migrated = withExpectedColumn(stripExpected(seed))
const migratedRole = migrated.boards
  .find((board) => board.id === "headcount")
  ?.groups.find((group) => group.id === "echelon")
  ?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Engineering")
if (migratedRole?.cells[EXPECTED_COLUMN_ID] !== "54") throw new Error("migrated headcount expected")
const migratedMotion = migrated.boards
  .find((board) => board.id === "revenue")
  ?.groups.find((group) => group.id === "echelon")
  ?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "New logos")
const goal = migratedMotion?.cells.goal
if (!goal || migratedMotion.cells[EXPECTED_COLUMN_ID] !== goal) throw new Error("migrated revenue expected")

if (!isLaunchboxEmail("Kaylee.Scanlin@thelaunchbox.com")) throw new Error("launchbox email should be accepted")
if (isLaunchboxEmail("kaylee.scanlin@thelaunchbox.com.evil")) throw new Error("lookalike domain should be rejected")
if (isLaunchboxEmail("not an email")) throw new Error("plain text should be rejected")
if (!isAdminEmail("karla.oros@thelaunchbox.com")) throw new Error("karla should be an admin")
if (!isAdminEmail("daniel.bernasconi@thelaunchbox.com")) throw new Error("daniel should be an admin")
if (!isAdminEmail("kaylee.scanlin@thelaunchbox.com")) throw new Error("kaylee should be an admin")
if (isAdminEmail("someone@thelaunchbox.com")) throw new Error("other launchbox accounts are viewers")
if (launchboxEmailFromClaims({ preferred_username: "guest_other.com#EXT#@tenant.onmicrosoft.com", email: "guest@other.com" })) {
  throw new Error("guest claims should not count as launchbox")
}

const hour = 60 * 60 * 1000
if (isExpired(new Date(0).toISOString(), SNAPSHOT_TTL_MS - 1)) throw new Error("snapshot should still be live before 24 hours")
if (!isExpired(new Date(0).toISOString(), SNAPSHOT_TTL_MS)) throw new Error("snapshot should expire at 24 hours")

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "q3-boards-"))
const savedAt = Date.parse("2026-10-28T12:00:00.000Z")
try {
  const denied = publishWorkspace(dir, { admin: false, email: "someone@thelaunchbox.com" }, seed, savedAt)
  if (denied.ok) throw new Error("viewers must not save")
  if (fs.existsSync(path.join(dir, "current.json"))) throw new Error("denied save wrote a file")

  const first = publishWorkspace(dir, { admin: true, email: "karla.oros@thelaunchbox.com" }, seed, savedAt)
  if (!first.ok) throw new Error(first.message)
  const second = publishWorkspace(dir, { admin: true, email: "kaylee.scanlin@thelaunchbox.com" }, seed, savedAt + hour)
  if (!second.ok) throw new Error(second.message)
  const history = fs.readdirSync(path.join(dir, "history"))
  if (history.length !== 1) throw new Error("the previous save should be kept")
  const live = readLiveSnapshot(dir, savedAt + SNAPSHOT_TTL_MS - 1)
  if (!live || live.savedBy !== "kaylee.scanlin@thelaunchbox.com") throw new Error("the newest save should stay for 24 hours")
  if (readLiveSnapshot(dir, savedAt + hour + SNAPSHOT_TTL_MS)) throw new Error("saves should be deleted after 24 hours")
  if (fs.existsSync(path.join(dir, "current.json"))) throw new Error("expired save file should be removed")
  if (fs.readdirSync(path.join(dir, "history")).length !== 0) throw new Error("expired history should be removed")

  saveSnapshot(dir, { savedBy: "daniel.bernasconi@thelaunchbox.com", workspace: seed }, savedAt)
  const bad = publishWorkspace(dir, { admin: true, email: "karla.oros@thelaunchbox.com" }, { version: 1, boards: [] }, savedAt + hour)
  if (bad.ok) throw new Error("invalid boards should be rejected")
  const still = readLiveSnapshot(dir, savedAt + hour)
  if (!still || still.savedBy !== "daniel.bernasconi@thelaunchbox.com") throw new Error("a rejected save should leave the current copy")
} finally {
  fs.rmSync(dir, { recursive: true, force: true })
}

console.log("ok")

function stripExpected(workspace: Workspace): Workspace {
  return {
    ...workspace,
    boards: workspace.boards.map((board) => stripBoard(board)),
  }
}

function stripBoard(board: Board): Board {
  return {
    ...board,
    columns: board.columns.filter((column) => column.id !== EXPECTED_COLUMN_ID),
    groups: board.groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => ({ ...row, cells: withoutExpected(row.cells) })),
    })),
  }
}

function withoutExpected(cells: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(cells)) {
    if (key !== EXPECTED_COLUMN_ID) next[key] = value
  }
  return next
}
