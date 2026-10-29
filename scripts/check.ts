import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { isAdminEmail, isLaunchboxEmail, launchboxEmailFromClaims } from "../src/auth/access"
import { resizeCeiling } from "../src/components/column-resize"
import { firmTableMarks, trendSegment, trendValue } from "../src/data/firm-chart"
import { formatCurrency, parseNumber, parsePercentInput } from "../src/data/format"
import { isExpired, SNAPSHOT_TTL_MS } from "../src/data/retention"
import { publishWorkspace, readLiveSnapshot, saveSnapshot } from "../server/snapshots"
import {
  aggregateColumn,
  cellNumber,
  computeKpis,
  defaultBarColumnIds,
  defaultChartGrain,
  defaultPieColumnId,
  defaultScatterColumnIds,
  formatColumnValue,
  listCompanies,
  plotRows,
  profitMarginChart,
  uniqueLabels,
} from "../src/data/metrics"
import { parseWorkspace } from "../src/data/persist"
import { keepFirmBoards, reducer } from "../src/data/reducer"
import { commitHtml, editorHtml, sanitizeRichText } from "../src/data/rich-text"
import { createSeedWorkspace, IMPROV_OPERATING_RESULTS, seedProblems, varianceStatus, withExpectedColumn, withFirmRatios, withImprovDeck, withoutRetiredStatuses, withoutYtdSubtitle } from "../src/data/seed"
import { EXPECTED_COLUMN_ID, LABEL_COLUMN_ID, MAX_COLUMN_WIDTH, type Board, type Column, type Workspace } from "../src/data/types"

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

const firmCount = listCompanies(seed).length
let custom = reducer(seed, { type: "add-board", boardId: "board-pipeline", firmId: "echelon", title: "Pipeline" })
const pipeline = must(custom.boards.find((board) => board.id === "board-pipeline"), "pipeline")
if (pipeline.firmId !== "echelon" || pipeline.title !== "Pipeline") throw new Error("custom board was not created")
if (pipeline.columns[0]?.id !== LABEL_COLUMN_ID || pipeline.columns[0]?.name !== "Title") throw new Error("custom board title column")
const notes = must(pipeline.columns[1], "custom column")
if (notes.name !== "Column" || notes.kind !== "text") throw new Error("custom board column")
const pipelineGroup = must(pipeline.groups[0], "pipeline group")
if (pipelineGroup.rows.length !== 3 || pipelineGroup.rows.some((row) => row.cells[LABEL_COLUMN_ID] !== "")) {
  throw new Error("custom board rows")
}
if (listCompanies(custom).length !== firmCount) throw new Error("custom board became a firm")
if (reducer(seed, { type: "add-board", boardId: "ytd", firmId: "echelon", title: "Nope" }) !== seed) {
  throw new Error("reserved board id accepted")
}
if (reducer(seed, { type: "add-board", boardId: "board-blank", firmId: "echelon", title: "  " }) !== seed) {
  throw new Error("blank board title accepted")
}
if (reducer(seed, { type: "add-board", boardId: "board-missing", firmId: "missing", title: "Nope" }) !== seed) {
  throw new Error("unknown firm accepted a board")
}
const ytdGroups = must(custom.boards.find((board) => board.id === "ytd"), "ytd before firm").groups.length
custom = reducer(custom, { type: "add-company", name: "Northwind" })
if (must(custom.boards.find((board) => board.id === "board-pipeline"), "pipeline after firm").groups.length !== 1) {
  throw new Error("new firm was copied onto a custom board")
}
if (must(custom.boards.find((board) => board.id === "ytd"), "ytd after firm").groups.length !== ytdGroups + 1) {
  throw new Error("new firm missing from ytd")
}
if (!reducer(custom, { type: "delete-board", boardId: "ytd" }).boards.some((board) => board.id === "ytd")) {
  throw new Error("ytd was deleted")
}
if (reducer(custom, { type: "rename-board", boardId: "ytd", title: "Nope" }).boards.find((board) => board.id === "ytd")?.title === "Nope") {
  throw new Error("ytd was renamed")
}
const renamed = reducer(custom, { type: "rename-board", boardId: "board-pipeline", title: "Hiring" })
if (renamed.boards.find((board) => board.id === "board-pipeline")?.title !== "Hiring") throw new Error("custom board was not renamed")
if (pipeline.subtitle !== "") throw new Error("custom board should start without a description")
const described = reducer(custom, { type: "set-board-subtitle", boardId: "board-pipeline", subtitle: "  Open roles  " })
if (described.boards.find((board) => board.id === "board-pipeline")?.subtitle !== "Open roles") {
  throw new Error("custom board description was not saved")
}
const cleared = reducer(described, { type: "set-board-subtitle", boardId: "board-pipeline", subtitle: "   " })
if (cleared.boards.find((board) => board.id === "board-pipeline")?.subtitle !== "") {
  throw new Error("custom board description was not cleared")
}
if (
  reducer(custom, { type: "set-board-subtitle", boardId: "ytd", subtitle: "Nope" }).boards.find((board) => board.id === "ytd")
    ?.subtitle === "Nope"
) {
  throw new Error("ytd description was edited")
}
if (
  reducer(custom, { type: "set-board-subtitle", boardId: "board-pipeline", subtitle: "x".repeat(401) }).boards.find(
    (board) => board.id === "board-pipeline",
  )?.subtitle !== ""
) {
  throw new Error("an overlong board description was saved")
}
if (pipelineGroup.name !== "Table") throw new Error("custom board should start with one titled table")
if (reducer(seed, { type: "add-table", boardId: "ytd", groupId: "extra", title: "Nope" }) !== seed) {
  throw new Error("portfolio board accepted a table")
}
if (reducer(custom, { type: "add-table", boardId: "board-pipeline", groupId: "table-ratios", title: "  " }) !== custom) {
  throw new Error("blank table title accepted")
}
const withTable = reducer(custom, { type: "add-table", boardId: "board-pipeline", groupId: "table-ratios", title: "  Ratios " })
const ratioTable = must(withTable.boards.find((board) => board.id === "board-pipeline")?.groups[1], "ratios table")
if (ratioTable.name !== "Ratios" || ratioTable.rows.length !== 3) throw new Error("table was not added")
if (ratioTable.columns?.length !== 2 || ratioTable.columns[0]?.id !== LABEL_COLUMN_ID) throw new Error("new table columns")
const ratioColumn = must(ratioTable.columns?.[1], "ratio column")
const ratioRow = must(ratioTable.rows[0], "ratio row")
const ratioFilled = reducer(withTable, {
  type: "set-cell",
  boardId: "board-pipeline",
  groupId: ratioTable.id,
  rowId: ratioRow.id,
  columnId: ratioColumn.id,
  value: "41%",
})
if (
  ratioFilled.boards.find((board) => board.id === "board-pipeline")?.groups[1]?.rows[0]?.cells[ratioColumn.id] !== "41%"
) {
  throw new Error("cell on the new table did not save")
}
const widened = reducer(withTable, {
  type: "add-column",
  boardId: "board-pipeline",
  groupId: "table-ratios",
  name: "Target",
  kind: "percent",
})
const widenedBoard = must(widened.boards.find((board) => board.id === "board-pipeline"), "widened board")
if (widenedBoard.groups[1]?.columns?.some((column) => column.name === "Target") !== true) {
  throw new Error("column was not added to the new table")
}
if ((widenedBoard.groups[0]?.columns ?? widenedBoard.columns).some((column) => column.name === "Target")) {
  throw new Error("new table column landed on the first table")
}
const namedTable = reducer(withTable, { type: "rename-table", boardId: "board-pipeline", groupId: "table-ratios", title: "Margins" })
if (namedTable.boards.find((board) => board.id === "board-pipeline")?.groups[1]?.name !== "Margins") {
  throw new Error("table was not renamed")
}
if (reducer(custom, { type: "delete-table", boardId: "board-pipeline", groupId: pipelineGroup.id }) !== custom) {
  throw new Error("the last table was deleted")
}
const droppedTable = reducer(withTable, { type: "delete-table", boardId: "board-pipeline", groupId: "table-ratios" })
if (droppedTable.boards.find((board) => board.id === "board-pipeline")?.groups.length !== 1) {
  throw new Error("table was not deleted")
}
const parsedTables = parseWorkspace(JSON.parse(JSON.stringify(widened)) as unknown)
if (parsedTables?.boards.find((board) => board.id === "board-pipeline")?.groups[1]?.columns?.some((column) => column.name === "Target") !== true) {
  throw new Error("table columns did not round trip")
}
const sized = reducer(custom, {
  type: "set-column-width",
  boardId: "board-pipeline",
  groupId: pipelineGroup.id,
  columnId: notes.id,
  width: 320.4,
})
const sizedBoard = must(sized.boards.find((board) => board.id === "board-pipeline"), "sized board")
if (sizedBoard.columns.find((column) => column.id === notes.id)?.width !== 320) throw new Error("column width was not saved")
if (reducer(sized, { type: "set-column-width", boardId: "board-pipeline", groupId: pipelineGroup.id, columnId: notes.id, width: 320 }) !== sized) {
  throw new Error("an unchanged column width was rewritten")
}
if (reducer(custom, { type: "set-column-width", boardId: "board-pipeline", groupId: pipelineGroup.id, columnId: notes.id, width: 20 }) !== custom) {
  throw new Error("a tiny column width was saved")
}
const sizedTable = reducer(withTable, {
  type: "set-column-width",
  boardId: "board-pipeline",
  groupId: "table-ratios",
  columnId: ratioColumn.id,
  width: 96,
})
const sizedTables = must(sizedTable.boards.find((board) => board.id === "board-pipeline"), "sized tables")
if (sizedTables.groups[1]?.columns?.find((column) => column.id === ratioColumn.id)?.width !== 96) {
  throw new Error("table column width was not saved")
}
if (sizedTables.groups[0]?.columns?.find((column) => column.id === notes.id)?.width === 96) {
  throw new Error("table column width changed the first table")
}
const wideRevenue = reducer(seed, { type: "set-column-width", boardId: "revenue", columnId: "q3", width: 200 })
if (wideRevenue.boards.find((board) => board.id === "revenue")?.columns.find((column) => column.id === "q3")?.width !== 200) {
  throw new Error("portfolio column width was not saved")
}
if (wideRevenue.boards.find((board) => board.id === "ytd")?.columns.find((column) => column.id === "q3")?.width !== undefined) {
  throw new Error("portfolio column width changed another board")
}
const parsedWidth = parseWorkspace(JSON.parse(JSON.stringify(sized)) as unknown)
if (parsedWidth?.boards.find((board) => board.id === "board-pipeline")?.columns.find((column) => column.id === notes.id)?.width !== 320) {
  throw new Error("column width did not round trip")
}
const screenWide = reducer(withTable, {
  type: "set-column-width",
  boardId: "board-pipeline",
  groupId: "table-ratios",
  columnId: ratioColumn.id,
  width: 1600,
})
const screenWideTable = must(screenWide.boards.find((board) => board.id === "board-pipeline")?.groups[1], "screen-wide table")
if (screenWideTable.columns?.find((column) => column.id === ratioColumn.id)?.width !== 1600) {
  throw new Error("a lone column could not fill the screen")
}
if (
  reducer(withTable, {
    type: "set-column-width",
    boardId: "board-pipeline",
    groupId: "table-ratios",
    columnId: LABEL_COLUMN_ID,
    width: 1600,
  }) !== withTable
) {
  throw new Error("the title grew past the usual limit beside another column")
}
if (
  reducer(widened, {
    type: "set-column-width",
    boardId: "board-pipeline",
    groupId: "table-ratios",
    columnId: ratioColumn.id,
    width: 1600,
  }) !== widened
) {
  throw new Error("a column grew past the usual limit beside other columns")
}
if (
  reducer(withTable, {
    type: "set-column-width",
    boardId: "board-pipeline",
    groupId: "table-ratios",
    columnId: ratioColumn.id,
    width: 4000,
  }) !== withTable
) {
  throw new Error("a column wider than a screen was saved")
}
const onlyTitle = reducer(withTable, {
  type: "delete-column",
  boardId: "board-pipeline",
  groupId: "table-ratios",
  columnId: ratioColumn.id,
})
const titleWide = reducer(onlyTitle, {
  type: "set-column-width",
  boardId: "board-pipeline",
  groupId: "table-ratios",
  columnId: LABEL_COLUMN_ID,
  width: 1600,
})
if (titleWide.boards.find((board) => board.id === "board-pipeline")?.groups[1]?.columns?.[0]?.width !== 1600) {
  throw new Error("the only column could not fill the screen")
}
const parsedScreen = parseWorkspace(JSON.parse(JSON.stringify(screenWide)) as unknown)
if (
  parsedScreen?.boards.find((board) => board.id === "board-pipeline")?.groups[1]?.columns?.find((column) => column.id === ratioColumn.id)
    ?.width !== 1600
) {
  throw new Error("a full-width column did not round trip")
}
if (reducer(seed, { type: "set-column-width", boardId: "revenue", columnId: "q3", width: 1600 }) !== seed) {
  throw new Error("a portfolio column grew past the usual limit")
}
const lonePair: Column[] = [
  { id: LABEL_COLUMN_ID, name: "Title", kind: "text" },
  { id: "notes", name: "Column", kind: "text" },
]
const lone = must(lonePair[1], "lone column")
if (resizeCeiling(lone, lonePair, 1400, true, () => 256) !== 1400 - 256 - 48) {
  throw new Error("a lone column cannot reach the screen edge")
}
const title = must(lonePair[0], "title column")
if (resizeCeiling(title, lonePair, 1400, true, () => 256) !== MAX_COLUMN_WIDTH) {
  throw new Error("the title column ignored its usual limit")
}
const pipelineRow = must(pipelineGroup.rows[0], "pipeline row")
const titled = reducer(custom, {
  type: "set-cell",
  boardId: "board-pipeline",
  groupId: pipelineGroup.id,
  rowId: pipelineRow.id,
  columnId: notes.id,
  value: "Owner",
})
const titledCell = titled.boards
  .find((board) => board.id === "board-pipeline")
  ?.groups[0]?.rows.find((row) => row.id === pipelineRow.id)?.cells[notes.id]
if (titledCell !== "Owner") throw new Error("cell title did not save")
if (reducer(seed, { type: "add-subrow", boardId: "ytd", groupId: "echelon", rowId: pipelineRow.id }) !== seed) {
  throw new Error("portfolio board accepted a sub-row")
}
if (reducer(custom, { type: "add-subrow", boardId: "board-pipeline", groupId: pipelineGroup.id, rowId: "missing" }) !== custom) {
  throw new Error("unknown row accepted a sub-row")
}
const withSub = reducer(custom, { type: "add-subrow", boardId: "board-pipeline", groupId: pipelineGroup.id, rowId: pipelineRow.id })
const subrow = must(
  withSub.boards.find((board) => board.id === "board-pipeline")?.groups[0]?.rows.find((row) => row.id === pipelineRow.id)?.subrows?.[0],
  "sub-row",
)
if (subrow.cells[LABEL_COLUMN_ID] !== "") throw new Error("sub-row should start untitled")
const subFilled = reducer(withSub, {
  type: "set-cell",
  boardId: "board-pipeline",
  groupId: pipelineGroup.id,
  rowId: subrow.id,
  columnId: notes.id,
  value: "Detail",
})
const savedSub = subFilled.boards
  .find((board) => board.id === "board-pipeline")
  ?.groups[0]?.rows.find((row) => row.id === pipelineRow.id)
  ?.subrows?.[0]
if (savedSub?.cells[notes.id] !== "Detail") throw new Error("sub-row cell did not save")
const droppedSub = reducer(subFilled, {
  type: "delete-subrow",
  boardId: "board-pipeline",
  groupId: pipelineGroup.id,
  rowId: pipelineRow.id,
  subrowId: subrow.id,
})
if (droppedSub.boards.find((board) => board.id === "board-pipeline")?.groups[0]?.rows.find((row) => row.id === pipelineRow.id)?.subrows) {
  throw new Error("sub-row was not deleted")
}
const parsedSub = parseWorkspace(JSON.parse(JSON.stringify(subFilled)) as unknown)
if (
  parsedSub?.boards.find((board) => board.id === "board-pipeline")?.groups[0]?.rows.find((row) => row.id === pipelineRow.id)?.subrows?.[0]
    ?.cells[notes.id] !== "Detail"
) {
  throw new Error("sub-row did not round trip")
}
const removedParent = reducer(withSub, { type: "delete-row", boardId: "board-pipeline", groupId: pipelineGroup.id, rowId: pipelineRow.id })
if (removedParent.boards.find((board) => board.id === "board-pipeline")?.groups[0]?.rows.some((row) => row.id === pipelineRow.id)) {
  throw new Error("deleting a row left its sub-rows")
}
const addedRow = reducer(custom, { type: "add-row", boardId: "board-pipeline", groupId: pipelineGroup.id })
const newest = addedRow.boards.find((board) => board.id === "board-pipeline")?.groups[0]?.rows.at(-1)
if (newest?.cells[LABEL_COLUMN_ID] !== "") throw new Error("custom row should start untitled")
const roundCustom = parseWorkspace(JSON.parse(JSON.stringify(custom)) as unknown)
if (roundCustom?.boards.find((board) => board.id === "board-pipeline")?.firmId !== "echelon") {
  throw new Error("custom board did not round trip")
}
const expectedCustom = withExpectedColumn(custom)
if (expectedCustom.boards.find((board) => board.id === "board-pipeline")?.columns.some((column) => column.id === EXPECTED_COLUMN_ID)) {
  throw new Error("custom board gained expected")
}
const droppedFirm = reducer(custom, { type: "delete-company", groupId: "echelon" })
if (droppedFirm.boards.some((board) => board.id === "board-pipeline")) throw new Error("firm delete left its board")
if (droppedFirm.boards.find((board) => board.id === "ytd")?.groups.some((group) => group.id === "echelon")) {
  throw new Error("firm delete left echelon on ytd")
}
const keptBoards = keepFirmBoards(seed, custom)
if (!keptBoards.boards.some((board) => board.id === "board-pipeline")) throw new Error("reset dropped a firm board")
if (keptBoards.boards.filter((board) => board.id === "ytd").length !== 1) throw new Error("reset duplicated ytd")
const northwind = must(
  custom.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.name === "Northwind"),
  "northwind",
)
const northBoard = reducer(custom, { type: "add-board", boardId: "board-north", firmId: northwind.id, title: "North" })
if (keepFirmBoards(seed, northBoard).boards.some((board) => board.firmId && !listCompanies(seed).some((company) => company.id === board.firmId))) {
  throw new Error("reset kept a board for a removed firm")
}
const numericFirm = JSON.parse(JSON.stringify(seed)) as { boards: { firmId?: unknown }[] }
const numericBoard = must(numericFirm.boards[0], "numeric firm board")
numericBoard.firmId = 1
if (parseWorkspace(numericFirm) !== null) throw new Error("numeric firm id accepted")
numericBoard.firmId = "  "
if (parseWorkspace(numericFirm) !== null) throw new Error("blank firm id accepted")

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
      if (row.measure) continue
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

const improvGroup = must(ytd.groups.find((group) => group.id === "improv"), "improv ytd")
const improvRevenue = must(
  improvGroup.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue"),
  "improv revenue",
)
if (improvRevenue.cells[EXPECTED_COLUMN_ID] !== "3600000") throw new Error("improv revenue expected should be $3.6M")
if (cellNumber(ytdColumn, improvRevenue, ytd.columns) !== 3_400_000) throw new Error("improv revenue YTD should be $3.4M")
if (improvRevenue.cells.status !== "Watch") throw new Error("improv revenue is about 5.6% under the $3.6M comparison")
const improvGross = must(
  improvGroup.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Gross profit"),
  "improv gross profit",
)
if (cellNumber(ytdColumn, improvGross, ytd.columns) !== 1_300_000) throw new Error("improv gross profit YTD should be $1.3M")
const improvNet = must(
  improvGroup.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Net income"),
  "improv net income",
)
if (cellNumber(ytdColumn, improvNet, ytd.columns) !== 198_000) throw new Error("improv net income YTD should be $198k")
if (improvGroup.operatingResults !== IMPROV_OPERATING_RESULTS) throw new Error("improv operating results missing")

const ratioNames = [
  "Gross profit margin",
  "Non-billable travel expense margin",
  "SG&A expense ratio",
  "Net profit margin",
  "Revenue growth rate",
  "Working capital ratio",
]
const improvRatioLabels = (improvGroup.ratios ?? []).map((row) => row.cells[LABEL_COLUMN_ID])
ratioNames.forEach((name, offset) => {
  if (improvRatioLabels[offset] !== name) throw new Error(`${name} should be in the ratio table`)
})
if (improvGroup.rows.some((row) => ratioNames.includes(row.cells[LABEL_COLUMN_ID] ?? ""))) {
  throw new Error("ratios should stay off the income statement")
}
if (ytd.columns.some((column) => column.scope === "firm" || column.id === "gpm")) throw new Error("ratio columns should be gone")
if (headcount.columns.some((column) => column.scope === "firm")) throw new Error("headcount should not carry firm ratios")
if (defaultBarColumnIds(ytd).join() !== "q3,q4") throw new Error("firm ratios should stay off the default chart")
if (defaultPieColumnId(ytd) !== "q4" || defaultScatterColumnIds(ytd).join() !== "q3,q4") {
  throw new Error("YTD charts should stay on the quarter columns")
}
if (defaultChartGrain(ytd) !== "company" || defaultChartGrain(headcount) !== "company") {
  throw new Error("headcount and YTD charts should stay on firm totals")
}
if (defaultPieColumnId(headcount) !== "q4") throw new Error("headcount pie should plot forecast headcount")
if (defaultScatterColumnIds(headcount).join() !== "q3,q4") throw new Error("headcount scatter should plot headcount, not pay")
const headcountPlot = must(
  plotRows(headcount, "echelon", "company", "").find((row) => row.groupId === "echelon"),
  "echelon headcount plot",
)
if (headcountPlot.values.q4 !== 113) throw new Error(`headcount chart plotted ${headcountPlot.values.q4 ?? "nothing"}`)
const revenueBoard = must(seed.boards.find((board) => board.id === "revenue"), "revenue board")
if (defaultChartGrain(revenueBoard) !== "line") throw new Error("revenue goals should chart each row")
if (defaultPieColumnId(revenueBoard) !== "expected") throw new Error("revenue goals pie should plot expected")
if (defaultScatterColumnIds(revenueBoard).join() !== "expected,q4") {
  throw new Error("revenue goals scatter should plot expected against the forecast")
}
const revenueLines = plotRows(revenueBoard, "all", "line", "")
const chartPlan = revenueLines.find((row) => row.label.includes("2026 revenue"))
if (!chartPlan || chartPlan.values.expected !== 8_100_000) throw new Error("revenue goals chart dropped the Improv plan")
if (!revenueLines.some((row) => row.groupId === "echelon" && row.label.includes("New logos"))) {
  throw new Error("revenue goals chart dropped motions")
}
const ytdRevenue = must(
  ytd.groups.find((group) => group.id === "echelon")?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue"),
  "echelon revenue line",
)
if (headcountPlot.values.q4 === Number(ytdRevenue.cells.q4)) throw new Error("headcount chart used YTD revenue")
if (ytd.subtitle !== "") throw new Error("YTD financial results should have no subtitle")
const noted = structuredClone(seed)
const notedYtd = must(noted.boards.find((board) => board.id === "ytd"), "noted ytd")
notedYtd.subtitle = "Firm ratios sit to the right of status."
if (withoutYtdSubtitle(noted).boards.find((board) => board.id === "ytd")?.subtitle !== "") {
  throw new Error("a saved YTD subtitle should be cleared")
}
if (withoutYtdSubtitle(seed) !== seed) throw new Error("an empty YTD subtitle was rewritten")
const echelonMargins = must(profitMarginChart(ytd, "echelon"), "echelon margins")
const echelonQ3 = must(echelonMargins.points.find((point) => point.key.endsWith("-q3")), "echelon q3 margin")
if (echelonQ3.gross === null || Math.abs(echelonQ3.gross - 0.58) > 0.0001) throw new Error("echelon gross margin")
if (echelonQ3.net === null || Math.abs(echelonQ3.net - 0.17) > 0.0001) throw new Error("echelon profit margin")
if (echelonMargins.netLabel !== "EBITDA margin") throw new Error("echelon uses EBITDA for the profit line")
const improvMargins = must(profitMarginChart(ytd, "improv"), "improv margins")
if (improvMargins.netLabel !== "Net margin") throw new Error("improv uses net income for the profit line")
const improvQ1 = must(improvMargins.points.find((point) => point.label === "Q1"), "improv q1 margin")
if (improvQ1.gross === null || Math.abs(improvQ1.gross - 433_333 / 1_133_333) > 0.0001) throw new Error("improv gross margin")
const allMargins = must(profitMarginChart(ytd, "all"), "all margins")
if (allMargins.points.length !== ytd.groups.length) throw new Error("profit margins should include every firm")
if (allMargins.netLabel !== "Profit margin") throw new Error("mixed profit lines need one series name")
const grossMargin = must(
  improvGroup.ratios?.find((row) => row.cells[LABEL_COLUMN_ID] === "Gross profit margin"),
  "gross margin row",
)
if (grossMargin.measure !== "percent" || !grossMargin.omitFromRollup) throw new Error("gross margin should be a ratio row")
if (grossMargin.cells.ytd !== "0.38" || grossMargin.cells.q3 !== "0.41" || grossMargin.cells[EXPECTED_COLUMN_ID] !== "0.50") {
  throw new Error("improv gross margin should keep the deck periods")
}
if (cellNumber(ytdColumn, grossMargin, ytd.columns) !== 0.38) throw new Error("gross margin YTD was summed from the quarters")
if (formatColumnValue({ id: "gpm", name: "Gross profit margin", kind: "percent", decimals: 0 }, 0.38) !== "38%") {
  throw new Error("gross margin should display as a whole percent")
}
const workingCapital = must(
  improvGroup.ratios?.find((row) => row.cells[LABEL_COLUMN_ID] === "Working capital ratio"),
  "working capital row",
)
if (workingCapital.measure !== "number" || workingCapital.cells.ytd !== "0.75" || workingCapital.cells.q3 !== "1.38") {
  throw new Error("working capital should keep the deck periods")
}
if (formatColumnValue({ id: "wkr", name: "Working capital ratio", kind: "number", decimals: 2 }, 0.75) !== "0.75") {
  throw new Error("working capital should keep hundredths")
}
if (formatColumnValue({ id: "wkr", name: "Working capital ratio", kind: "number", decimals: 2 }, 1.5) !== "1.50") {
  throw new Error("working capital should show two digits")
}
const echelonMargin = must(
  echelon.ratios?.find((row) => row.cells[LABEL_COLUMN_ID] === "Gross profit margin"),
  "echelon gross margin",
)
const echelonCapital = must(
  echelon.ratios?.find((row) => row.cells[LABEL_COLUMN_ID] === "Working capital ratio"),
  "echelon working capital",
)
if (echelonMargin.cells.ytd !== "0.58" || echelonCapital.cells.ytd !== "1.62") throw new Error("echelon starter ratios")
if (!ytd.groups.every((group) => ratioNames.every((name) => group.ratios?.some((row) => row.cells[LABEL_COLUMN_ID] === name)))) {
  throw new Error("every firm should have the six ratios")
}
if (uniqueLabels(ytd).some((label) => ratioNames.includes(label))) throw new Error("ratio rows should stay off the chart")

if (withFirmRatios(seed) !== seed) throw new Error("current firm ratios were rewritten")
const legacyRatios = structuredClone(seed)
const legacyYtd = must(legacyRatios.boards.find((board) => board.id === "ytd"), "legacy ytd")
delete legacyYtd.ratioTable
legacyYtd.ratioRows = true
for (const group of legacyYtd.groups) {
  const moved = group.ratios ?? []
  delete group.ratios
  group.rows = [...group.rows, ...moved]
  if (group.id === "improv") {
    const margin = group.rows.find((row) => row.id === "improv-gpm")
    const travel = group.rows.find((row) => row.id === "improv-nbtem")
    if (margin) margin.cells = { ...margin.cells, ytd: "0.41" }
    if (travel) travel.cells = { ...travel.cells, ytd: "" }
  }
}
const restoredRatios = withFirmRatios(legacyRatios)
const restoredYtd = must(restoredRatios.boards.find((board) => board.id === "ytd"), "restored ytd")
if (!restoredYtd.ratioTable || restoredYtd.ratioRows) throw new Error("restored board kept ratios on the income statement")
const restoredImprov = must(restoredYtd.groups.find((group) => group.id === "improv"), "restored improv")
if (restoredImprov.rows.some((row) => row.measure)) throw new Error("restored ratios stayed on the income statement")
const restoredMargin = restoredImprov.ratios?.find((row) => row.id === "improv-gpm")
const restoredTravel = restoredImprov.ratios?.find((row) => row.id === "improv-nbtem")
const restoredCapital = restoredImprov.ratios?.find((row) => row.id === "improv-wkr")
if (restoredMargin?.cells.ytd !== "0.41" || restoredMargin.cells.q3 !== "0.41") throw new Error("saved gross margin was overwritten")
if (restoredTravel?.cells.ytd) throw new Error("a cleared ratio was filled back in")
if (restoredCapital?.cells.ytd !== "0.75") throw new Error("a missing ratio was not filled from the deck")
if (restoredImprov.ratios?.[0]?.cells[LABEL_COLUMN_ID] !== "Gross profit margin") throw new Error("restored ratio table lost its order")
if (withFirmRatios(restoredRatios) !== restoredRatios) throw new Error("restored ratios were rewritten")
const editedRatio = reducer(seed, {
  type: "set-cell",
  boardId: "ytd",
  groupId: "improv",
  rowId: "improv-gpm",
  columnId: "ytd",
  value: "0.4",
})
if (editedRatio.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv")?.ratios?.find((row) => row.id === "improv-gpm")?.cells.ytd !== "0.4") {
  throw new Error("a ratio YTD edit did not save")
}
const addedFirm = reducer(seed, { type: "add-company", name: "Northwind Ratios" })
const addedYtd = must(addedFirm.boards.find((board) => board.id === "ytd"), "ytd with a new firm")
const addedGroup = must(addedYtd.groups.find((group) => group.name === "Northwind Ratios"), "new firm")
if (addedGroup.ratios?.length !== ratioNames.length) throw new Error("a new firm did not get a ratio table")
if (addedFirm.boards.find((board) => board.id === "headcount")?.groups.find((group) => group.name === "Northwind Ratios")?.ratios) {
  throw new Error("headcount received a ratio table")
}

const droppedRatios = structuredClone(seed)
const droppedImprov = must(
  droppedRatios.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv"),
  "dropped improv",
)
droppedImprov.ratios = droppedImprov.ratios?.filter((row) => row.id !== "improv-gpm")
if (withFirmRatios(droppedRatios) !== droppedRatios) throw new Error("a deleted ratio row was put back")

const improvHeads = computeKpis(headcount, "improv").find((kpi) => kpi.id === "q3-heads")
if (!improvHeads || improvHeads.value !== "32") throw new Error(`improv headcount ${improvHeads?.value ?? "missing"}`)
const aug = must(
  headcount.groups.find((group) => group.id === "improv")?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Aug 2025"),
  "aug 2025",
)
if (aug.cells.q3 !== "30" || !aug.omitFromRollup) throw new Error("aug 2025 should stay out of the headcount total")

const improvPlan = must(
  seed.boards.find((board) => board.id === "revenue")?.groups.find((group) => group.id === "improv"),
  "improv plan",
)
const plan2026 = must(
  improvPlan.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "2026 revenue"),
  "2026 revenue",
)
if (plan2026.cells[EXPECTED_COLUMN_ID] !== "8100000") throw new Error("2026 revenue target")
const plan2028 = must(
  improvPlan.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "2028 gross margin (50%)"),
  "2028 gross margin",
)
if (plan2028.cells[EXPECTED_COLUMN_ID] !== "9000000" || !plan2028.omitFromRollup) throw new Error("2028 gross margin target")

const roundTrip = must(parseWorkspace(JSON.parse(JSON.stringify(seed)) as unknown), "round trip")
const roundNote = roundTrip.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv")?.operatingResults
if (roundNote !== IMPROV_OPERATING_RESULTS) throw new Error("operating results dropped on save")
const roundYtd = must(roundTrip.boards.find((board) => board.id === "ytd"), "round trip ytd")
if (!roundYtd.ratioTable) throw new Error("ratio table flag dropped on save")
const roundMargin = roundYtd.groups
  .find((group) => group.id === "improv")
  ?.ratios?.find((row) => row.id === "improv-gpm")
if (roundMargin?.measure !== "percent" || roundMargin.cells.ytd !== "0.38") throw new Error("gross margin row dropped on save")
const roundCapital = roundYtd.groups
  .find((group) => group.id === "improv")
  ?.ratios?.find((row) => row.id === "improv-wkr")
if (roundCapital?.measure !== "number" || roundCapital.cells.ytd !== "0.75") throw new Error("working capital row dropped on save")
const corruptRatios = JSON.parse(JSON.stringify(seed)) as { boards: { groups: { metrics?: Record<string, unknown> }[] }[] }
const corruptGroup = corruptRatios.boards[0]?.groups[0]
if (!corruptGroup) throw new Error("corrupt fixture")
corruptGroup.metrics = { gpm: 0.38 }
if (parseWorkspace(corruptRatios) !== null) throw new Error("numeric firm ratio accepted")
const roundAug = roundTrip.boards
  .find((board) => board.id === "headcount")
  ?.groups.find((group) => group.id === "improv")
  ?.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Aug 2025")
if (!roundAug?.omitFromRollup) throw new Error("rollup flag dropped on save")

const editedNote = reducer(seed, { type: "set-operating-results", groupId: "improv", value: "Backlog moved." })
const savedNote = editedNote.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv")?.operatingResults
if (savedNote !== "Backlog moved.") throw new Error("operating results did not save")
for (const group of ytd.groups) {
  if (group.id !== "improv" && group.operatingResults !== undefined) {
    throw new Error(`${group.id} should start without operating results`)
  }
}
const echelonNote = reducer(seed, {
  type: "set-operating-results",
  groupId: "echelon",
  value: "<h1>Quarter</h1><p><strong>Ahead</strong></p>",
})
const echelonSaved = echelonNote.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "echelon")?.operatingResults
if (echelonSaved !== "<h1>Quarter</h1><p><strong>Ahead</strong></p>") throw new Error("firm operating results did not save")
const improvUntouched = echelonNote.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv")?.operatingResults
if (improvUntouched !== IMPROV_OPERATING_RESULTS) throw new Error("another firm's note changed Improv")
const hostile = parseWorkspace({
  version: 1,
  boards: [
    {
      id: "ytd",
      title: "YTD",
      subtitle: "",
      sumRows: false,
      columns: [{ id: "label", name: "Line", kind: "text" }],
      kpis: [],
      groups: [
        {
          id: "echelon",
          name: "Echelon",
          operatingResults: "<script>alert(1)</script><p onclick=\"x\">Hi <b>there</b></p>",
          rows: [{ id: "row", cells: { label: "Revenue" } }],
        },
      ],
    },
  ],
})
const cleaned = hostile?.boards[0]?.groups[0]?.operatingResults
if (cleaned !== "<p>Hi <strong>there</strong></p>") throw new Error(`hostile note was not cleaned: ${cleaned ?? "missing"}`)
if (editorHtml("a\n\nb") !== "<p>a</p><p><br></p><p>b</p>") throw new Error("plain notes should keep blank lines")
if (editorHtml("a < b & c") !== "<p>a &lt; b &amp; c</p>") throw new Error("plain notes should escape")
if (editorHtml(IMPROV_OPERATING_RESULTS).includes("<script")) throw new Error("improv note was treated as markup")
const formatted = "<h1>Title</h1><p>Body <b>bold</b> <i>lean</i></p><ul><li>One</li><li>Two</li></ul>"
const safe = sanitizeRichText(formatted)
if (safe !== "<h1>Title</h1><p>Body <strong>bold</strong> <em>lean</em></p><ul><li>One</li><li>Two</li></ul>") {
  throw new Error(`formatted note changed: ${safe}`)
}
if (sanitizeRichText(safe) !== safe) throw new Error("sanitizer should be stable")
if (sanitizeRichText("<img src=x onerror=alert(1)>") !== "") throw new Error("image markup should be dropped")
if (sanitizeRichText("<h1><script>alert(1)</script>Hi</h1>") !== "<h1>Hi</h1>") throw new Error("script inside a heading should be dropped")
if (sanitizeRichText('<p><a href="javascript:alert(1)">x</a></p>') !== "<p>x</p>") throw new Error("links should be unwrapped")
if (commitHtml("<p><br></p>") !== "") throw new Error("an empty note should save as blank")
if (sanitizeRichText("<div>Line</div>") !== "<p>Line</p>") throw new Error("divs should become paragraphs")
if (sanitizeRichText("<p>Hi<br>there</p><h2>Next</h2><p><u>Under</u></p>") !== "<p>Hi<br>there</p><h2>Next</h2><p><u>Under</u></p>") {
  throw new Error("breaks, headings, and underline should stay")
}

const stale = structuredClone(seed)
const staleImprov = must(stale.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv"), "stale improv")
delete staleImprov.operatingResults
const staleRevenue = must(staleImprov.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Net income"), "stale net income")
staleRevenue.cells[LABEL_COLUMN_ID] = "EBITDA"
const upgraded = withImprovDeck(stale)
if (upgraded === stale) throw new Error("old improv board was left in place")
const upgradedImprov = must(upgraded.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv"), "upgraded improv")
if (upgradedImprov.operatingResults !== IMPROV_OPERATING_RESULTS) throw new Error("saved board did not pick up operating results")
if (!upgradedImprov.rows.some((row) => row.cells[LABEL_COLUMN_ID] === "Net income")) throw new Error("saved board did not pick up net income")
if (withImprovDeck(seed) !== seed) throw new Error("current improv deck was rewritten")
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
if (varianceStatus(91, 100) !== "Watch") throw new Error("past 8% below is watch")
if (varianceStatus(0, 0) !== "On track") throw new Error("zero expected match")
if (varianceStatus(1, 0) !== "Ahead") throw new Error("positive against zero expected")
if (varianceStatus(-1, 0) !== "Watch") throw new Error("negative against zero expected")
const retired = structuredClone(seed)
const retiredRow = must(retired.boards[0]?.groups[0]?.rows[0], "retired status row")
retiredRow.cells.status = "Behind"
if (withoutRetiredStatuses(retired).boards[0]?.groups[0]?.rows[0]?.cells.status !== "Watch") {
  throw new Error("behind should become watch")
}
if (withoutRetiredStatuses(seed) !== seed) throw new Error("current statuses were rewritten")

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
  if (!live || live.savedBy !== "kaylee.scanlin@thelaunchbox.com") throw new Error("the newest save should stay")
  const kept = readLiveSnapshot(dir, savedAt + hour + SNAPSHOT_TTL_MS)
  if (!kept || kept.savedBy !== "kaylee.scanlin@thelaunchbox.com") throw new Error("the current save should stay after 24 hours")
  if (!fs.existsSync(path.join(dir, "current.json"))) throw new Error("the current save file should stay")
  if (fs.readdirSync(path.join(dir, "history")).length !== 0) throw new Error("the previous save should be removed after 24 hours")

  saveSnapshot(dir, { savedBy: "daniel.bernasconi@thelaunchbox.com", workspace: seed }, savedAt)
  const bad = publishWorkspace(dir, { admin: true, email: "karla.oros@thelaunchbox.com" }, { version: 1, boards: [] }, savedAt + hour)
  if (bad.ok) throw new Error("invalid boards should be rejected")
  const still = readLiveSnapshot(dir, savedAt + hour)
  if (!still || still.savedBy !== "daniel.bernasconi@thelaunchbox.com") throw new Error("a rejected save should leave the current copy")
} finally {
  fs.rmSync(dir, { recursive: true, force: true })
}

const chartColumns = [
  { id: LABEL_COLUMN_ID, name: "Title", kind: "text" as const },
  { id: "n", name: "Count", kind: "number" as const },
  { id: "m", name: "Rate", kind: "number" as const },
]
const chartMarks = firmTableMarks(
  {
    id: "g",
    name: "Table",
    rows: [
      {
        id: "a",
        cells: { [LABEL_COLUMN_ID]: "Alpha", n: "10", m: "2" },
        subrows: [{ id: "a1", cells: { [LABEL_COLUMN_ID]: "Part", n: "4", m: "1" } }],
      },
      { id: "b", cells: { [LABEL_COLUMN_ID]: "", n: "", m: "" } },
    ],
  },
  chartColumns,
)
if (chartMarks.length !== 2) throw new Error("blank rows should stay off the graph")
if (chartMarks[0]?.label !== "Alpha" || chartMarks[0]?.values.n !== 10) throw new Error("table row was not plotted")
if (chartMarks[1]?.label !== "Alpha · Part" || chartMarks[1]?.values.n !== 4) throw new Error("sub-row was not plotted")
const rising = trendSegment([
  { x: 0, y: 1 },
  { x: 2, y: 5 },
])
if (!rising || rising[0].y !== 1 || rising[1].y !== 5) throw new Error("trendline was not a straight fit")
const midway = trendValue(rising, 0.5)
if (midway.x !== 1 || midway.y !== 3) throw new Error("trendline midpoint was not the expected value")
if (trendValue(rising, 2).y !== 5) throw new Error("trendline hover ran past the line")
if (trendSegment([{ x: 1, y: 1 }]) !== null) throw new Error("one point drew a trendline")
if (trendSegment([{ x: 1, y: 1 }, { x: 1, y: 4 }]) !== null) throw new Error("a vertical cloud drew a trendline")

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
