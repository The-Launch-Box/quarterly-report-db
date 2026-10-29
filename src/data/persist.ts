import { commitHtml, looksLikeHtml } from "./rich-text"
import {
  LABEL_COLUMN_ID,
  MIN_COLUMN_WIDTH,
  SOLO_COLUMN_WIDTH,
  type Board,
  type BoardGroup,
  type BoardRow,
  type Column,
  type ColumnKind,
  type Formula,
  type KpiDef,
  type Workspace,
  type YtdCustomTable,
} from "./types"
import { RATIOS_TABLE_ID, STATEMENT_TABLE_ID } from "./ytd-tables"

const COLUMN_KINDS = new Set<ColumnKind>(["text", "number", "currency", "percent", "status"])

export function parseWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.boards)) return null
  const boards: Board[] = []
  for (const entry of value.boards) {
    const board = readBoard(entry)
    if (!board) return null
    boards.push(board)
  }
  if (boards.length === 0) return null
  return { version: 1, boards }
}

function readBoard(value: unknown): Board | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== "string" || typeof value.title !== "string" || typeof value.subtitle !== "string") return null
  if (!Array.isArray(value.columns) || !Array.isArray(value.groups)) return null
  const columns: Column[] = []
  for (const entry of value.columns) {
    const column = readColumn(entry)
    if (!column) return null
    columns.push(column)
  }
  if (!columns.some((column) => column.id === LABEL_COLUMN_ID && column.kind === "text")) return null
  const groups: BoardGroup[] = []
  for (const entry of value.groups) {
    const group = readGroup(entry)
    if (!group) return null
    groups.push(group)
  }
  const kpis: KpiDef[] = []
  if (value.kpis !== undefined) {
    if (!Array.isArray(value.kpis)) return null
    for (const entry of value.kpis) {
      const kpi = readKpi(entry)
      if (!kpi) return null
      kpis.push(kpi)
    }
  }
  if (value.firmId !== undefined && (typeof value.firmId !== "string" || value.firmId.trim() === "")) return null
  let ytdCustomTables: YtdCustomTable[] | undefined
  if (value.ytdCustomTables !== undefined) {
    const tables = readYtdCustomTables(value.ytdCustomTables)
    if (!tables) return null
    if (tables.length > 0) ytdCustomTables = tables
  }
  let ytdTableOrder: string[] | undefined
  if (value.ytdTableOrder !== undefined) {
    if (!Array.isArray(value.ytdTableOrder)) return null
    const order: string[] = []
    for (const id of value.ytdTableOrder) {
      if (typeof id !== "string" || id.trim() === "" || id.length > 80) return null
      order.push(id)
    }
    if (order.length > 0) ytdTableOrder = order
  }
  return {
    id: value.id,
    title: value.title,
    subtitle: value.subtitle,
    aggregateRows: value.aggregateRows === true,
    columns,
    groups,
    kpis,
    ...(value.ratioTable === true ? { ratioTable: true as const } : {}),
    ...(value.ratioRows === true ? { ratioRows: true as const } : {}),
    ...(value.firmRatios === true ? { firmRatios: true as const } : {}),
    ...(typeof value.firmId === "string" ? { firmId: value.firmId.trim() } : {}),
    ...(ytdCustomTables ? { ytdCustomTables } : {}),
    ...(ytdTableOrder ? { ytdTableOrder } : {}),
  }
}

function readYtdCustomTables(value: unknown): YtdCustomTable[] | null {
  if (!Array.isArray(value)) return null
  const tables: YtdCustomTable[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.title !== "string") return null
    const title = entry.title.trim()
    if (!title || title.length > 60 || entry.id.trim() === "" || entry.id.length > 80) return null
    if (entry.id === STATEMENT_TABLE_ID || entry.id === RATIOS_TABLE_ID || seen.has(entry.id)) return null
    if (!Array.isArray(entry.columns)) return null
    const columns: Column[] = []
    for (const columnEntry of entry.columns) {
      const column = readColumn(columnEntry)
      if (!column) return null
      columns.push(column)
    }
    if (!columns.some((column) => column.id === LABEL_COLUMN_ID && column.kind === "text")) return null
    seen.add(entry.id)
    tables.push({ id: entry.id, title, columns })
  }
  return tables
}

function readColumn(value: unknown): Column | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== "string" || typeof value.name !== "string") return null
  if (typeof value.kind !== "string" || !COLUMN_KINDS.has(value.kind as ColumnKind)) return null
  const column: Column = { id: value.id, name: value.name, kind: value.kind as ColumnKind }
  if (value.emphasis === true) column.emphasis = true
  if (value.rollup === "skip") column.rollup = "skip"
  if (value.scope === "firm") column.scope = "firm"
  if (isDecimalPlaces(value.decimals)) column.decimals = value.decimals
  if (typeof value.hint === "string") column.hint = value.hint
  if (isColumnWidth(value.width)) column.width = value.width
  if (value.formula !== undefined) {
    const formula = readFormula(value.formula)
    if (!formula) return null
    column.formula = formula
  }
  return column
}

function readFormula(value: unknown): Formula | null {
  if (!isRecord(value)) return null
  if (value.op === "sum" && Array.isArray(value.columnIds) && value.columnIds.every((id) => typeof id === "string")) {
    return { op: "sum", columnIds: value.columnIds }
  }
  if (value.op === "product" && Array.isArray(value.columnIds) && value.columnIds.every((id) => typeof id === "string")) {
    return { op: "product", columnIds: value.columnIds }
  }
  if (value.op === "ratio" && typeof value.numeratorId === "string" && typeof value.denominatorId === "string") {
    return { op: "ratio", numeratorId: value.numeratorId, denominatorId: value.denominatorId }
  }
  return null
}

function readGroup(value: unknown): BoardGroup | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" || !Array.isArray(value.rows)) {
    return null
  }
  const rows: BoardRow[] = []
  for (const entry of value.rows) {
    const row = readRow(entry, false)
    if (!row) return null
    rows.push(row)
  }
  let columns: Column[] | undefined
  if (value.columns !== undefined) {
    if (!Array.isArray(value.columns)) return null
    columns = []
    for (const entry of value.columns) {
      const column = readColumn(entry)
      if (!column) return null
      columns.push(column)
    }
    if (!columns.some((column) => column.id === LABEL_COLUMN_ID && column.kind === "text")) return null
  }
  const group: BoardGroup = { id: value.id, name: value.name, rows, ...(columns ? { columns } : {}) }
  if (value.operatingResults !== undefined) {
    if (typeof value.operatingResults !== "string") return null
    group.operatingResults = looksLikeHtml(value.operatingResults)
      ? commitHtml(value.operatingResults)
      : value.operatingResults
  }
  if (value.metrics !== undefined) {
    const metrics = readCells(value.metrics)
    if (!metrics) return null
    group.metrics = metrics
  }
  if (value.ratios !== undefined) {
    if (!Array.isArray(value.ratios)) return null
    const ratios: BoardRow[] = []
    for (const entry of value.ratios) {
      const row = readRow(entry, false)
      if (!row) return null
      ratios.push(row)
    }
    if (ratios.length > 0) group.ratios = ratios
  }
  if (value.customRows !== undefined) {
    if (!isRecord(value.customRows)) return null
    const customRows: Record<string, BoardRow[]> = {}
    for (const [tableId, rows] of Object.entries(value.customRows)) {
      if (tableId.trim() === "" || tableId.length > 80 || !Array.isArray(rows)) return null
      const parsed: BoardRow[] = []
      for (const entry of rows) {
        const row = readRow(entry, false)
        if (!row) return null
        parsed.push(row)
      }
      customRows[tableId] = parsed
    }
    if (Object.keys(customRows).length > 0) group.customRows = customRows
  }
  return group
}

function readRow(value: unknown, nested: boolean): BoardRow | null {
  if (!isRecord(value) || typeof value.id !== "string") return null
  const cells = readCells(value.cells)
  if (!cells) return null
  if (value.omitFromRollup !== undefined && value.omitFromRollup !== true) return null
  const row: BoardRow = { id: value.id, cells }
  if (value.omitFromRollup === true) row.omitFromRollup = true
  if (value.measure === "percent" || value.measure === "number") row.measure = value.measure
  if (value.subrows !== undefined) {
    if (nested || !Array.isArray(value.subrows)) return null
    const subrows: BoardRow[] = []
    for (const entry of value.subrows) {
      const subrow = readRow(entry, true)
      if (!subrow) return null
      subrows.push(subrow)
    }
    if (subrows.length > 0) row.subrows = subrows
  }
  return row
}

function readCells(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null
  const cells: Record<string, string> = {}
  for (const [key, cell] of Object.entries(value)) {
    if (typeof cell !== "string") return null
    cells[key] = cell
  }
  return cells
}

function readKpi(value: unknown): KpiDef | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== "string" || typeof value.label !== "string" || typeof value.columnId !== "string") return null
  const kpi: KpiDef = { id: value.id, label: value.label, columnId: value.columnId }
  if (typeof value.labelEquals === "string") kpi.labelEquals = value.labelEquals
  if (typeof value.compareColumnId === "string") kpi.compareColumnId = value.compareColumnId
  return kpi
}

function isDecimalPlaces(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6
}

function isColumnWidth(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_COLUMN_WIDTH && value <= SOLO_COLUMN_WIDTH
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
