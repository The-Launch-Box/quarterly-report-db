import { commitHtml, looksLikeHtml } from "./rich-text"
import {
  LABEL_COLUMN_ID,
  type Board,
  type BoardGroup,
  type BoardRow,
  type Column,
  type ColumnKind,
  type Formula,
  type KpiDef,
  type Workspace,
} from "./types"

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
  return {
    id: value.id,
    title: value.title,
    subtitle: value.subtitle,
    aggregateRows: value.aggregateRows === true,
    columns,
    groups,
    kpis,
    ...(value.firmRatios === true ? { firmRatios: true as const } : {}),
    ...(typeof value.firmId === "string" ? { firmId: value.firmId.trim() } : {}),
  }
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
    const row = readRow(entry)
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
  return group
}

function readRow(value: unknown): BoardRow | null {
  if (!isRecord(value) || typeof value.id !== "string") return null
  const cells = readCells(value.cells)
  if (!cells) return null
  if (value.omitFromRollup !== undefined && value.omitFromRollup !== true) return null
  const row: BoardRow = { id: value.id, cells }
  if (value.omitFromRollup === true) row.omitFromRollup = true
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
