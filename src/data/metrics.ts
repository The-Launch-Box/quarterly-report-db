import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from "./format"
import { LABEL_COLUMN_ID, type Board, type BoardRow, type Column, type Workspace } from "./types"

export interface KpiResult {
  id: string
  label: string
  value: string
  deltaPct?: number
  compareLabel?: string
}

export interface PlotRow {
  key: string
  groupId: string
  label: string
  values: Record<string, number | null>
}

export function isValueColumn(column: Column): boolean {
  return column.kind === "number" || column.kind === "currency" || column.kind === "percent"
}

export function listCompanies(workspace: Workspace): { id: string; name: string }[] {
  const names = new Map<string, string>()
  for (const board of workspace.boards) {
    for (const group of board.groups) {
      if (!names.has(group.id)) names.set(group.id, group.name)
    }
  }
  return [...names.entries()].map(([id, name]) => ({ id, name }))
}

export function uniqueLabels(board: Board): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const group of board.groups) {
    for (const row of group.rows) {
      const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
      if (!label || seen.has(label)) continue
      seen.add(label)
      labels.push(label)
    }
  }
  return labels
}

export function cellNumber(column: Column, row: BoardRow, columns: Column[], depth = 0): number | null {
  if (depth > 4) return null
  const formula = column.formula
  if (formula?.op === "sum") {
    let total = 0
    let any = false
    for (const sourceId of formula.columnIds) {
      const source = columns.find((item) => item.id === sourceId)
      if (!source) continue
      const value = cellNumber(source, row, columns, depth + 1)
      if (value === null) continue
      total += value
      any = true
    }
    return any ? total : null
  }
  if (formula?.op === "product") {
    if (formula.columnIds.length === 0) return null
    let total = 1
    for (const sourceId of formula.columnIds) {
      const source = columns.find((item) => item.id === sourceId)
      if (!source) return null
      const value = cellNumber(source, row, columns, depth + 1)
      if (value === null) return null
      total *= value
    }
    return total
  }
  if (formula?.op === "ratio") {
    const numerator = columns.find((item) => item.id === formula.numeratorId)
    const denominator = columns.find((item) => item.id === formula.denominatorId)
    if (!numerator || !denominator) return null
    const num = cellNumber(numerator, row, columns, depth + 1)
    const den = cellNumber(denominator, row, columns, depth + 1)
    if (num === null || den === null || den === 0) return null
    return num / den
  }
  return storedNumber(column, row.cells[column.id])
}

export function aggregateColumn(column: Column, rows: BoardRow[], columns: Column[], depth = 0): number | null {
  if (depth > 4) return null
  if (column.rollup === "skip" && rows.length > 1) return null
  const formula = column.formula
  if (formula?.op === "ratio") {
    const numerator = columns.find((item) => item.id === formula.numeratorId)
    const denominator = columns.find((item) => item.id === formula.denominatorId)
    if (!numerator || !denominator) return null
    const num = aggregateColumn(numerator, rows, columns, depth + 1)
    const den = aggregateColumn(denominator, rows, columns, depth + 1)
    if (num === null || den === null || den === 0) return null
    return num / den
  }

  let total = 0
  let count = 0
  for (const row of rows) {
    const value = cellNumber(column, row, columns)
    if (value === null) continue
    total += value
    count += 1
  }
  if (count === 0) return null
  if (!formula && column.kind === "percent") return total / count
  return total
}

export function formatColumnValue(column: Column, value: number | null): string {
  if (value === null) return ""
  if (column.kind === "currency") return formatCurrency(value)
  if (column.kind === "percent") return formatPercent(value)
  if (column.kind === "number") return formatNumber(value)
  return String(value)
}

export function computeKpis(board: Board, companyId: string): KpiResult[] {
  const rows = visibleRows(board, companyId)
  const results: KpiResult[] = []
  for (const kpi of board.kpis) {
    const column = board.columns.find((item) => item.id === kpi.columnId)
    if (!column) continue
    const matched = filterLabel(rows, kpi.labelEquals)
    const current = aggregateColumn(column, matched, board.columns)
    if (current === null) {
      results.push({ id: kpi.id, label: kpi.label, value: "n/a" })
      continue
    }
    const result: KpiResult = {
      id: kpi.id,
      label: kpi.label,
      value: formatKpiValue(column, current),
    }
    if (kpi.compareColumnId) {
      const compare = board.columns.find((item) => item.id === kpi.compareColumnId)
      if (compare) {
        const base = aggregateColumn(compare, filterLabel(rows, kpi.labelEquals), board.columns)
        if (base !== null && base !== 0) {
          result.deltaPct = ((current - base) / Math.abs(base)) * 100
          result.compareLabel = compare.name
        }
      }
    }
    results.push(result)
  }
  return results
}

export function plotRows(board: Board, companyId: string, grain: "company" | "line", lineFilter: string): PlotRow[] {
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)
  const columns = board.columns.filter(isValueColumn)

  const valuesFor = (rows: BoardRow[]): Record<string, number | null> => {
    const values: Record<string, number | null> = {}
    for (const column of columns) {
      values[column.id] = aggregateColumn(column, rows, board.columns)
    }
    return values
  }

  if (grain === "company") {
    if (!board.aggregateRows && !lineFilter) return []
    return groups.map((group) => {
      const source = !lineFilter ? group.rows : group.rows.filter((row) => labelsMatch(row, lineFilter))
      return { key: group.id, groupId: group.id, label: group.name, values: valuesFor(source) }
    })
  }

  const plots: PlotRow[] = []
  for (const group of groups) {
    for (const row of group.rows) {
      const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
      if (lineFilter && label.toLowerCase() !== lineFilter.toLowerCase()) continue
      plots.push({
        key: row.id,
        groupId: group.id,
        label: lineItemLabel(group.name, label, groups.length, Boolean(lineFilter)),
        values: valuesFor([row]),
      })
    }
  }
  return plots
}

export function valueColumns(board: Board): Column[] {
  return board.columns.filter(isValueColumn)
}

export function defaultBarColumnIds(board: Board): string[] {
  const columns = valueColumns(board).filter((column) => !column.formula)
  const q3 = columns.find((column) => column.id === "q3")
  const q4 = columns.find((column) => column.id === "q4")
  if (q3 && q4 && q3.kind === q4.kind) return [q3.id, q4.id]
  return columns.slice(0, 2).map((column) => column.id)
}

export function defaultPieColumnId(board: Board): string {
  if (board.id === "headcount") {
    const cost = board.columns.find((column) => column.id === "cost")
    if (cost && isValueColumn(cost)) return cost.id
  }
  const q4 = board.columns.find((column) => column.id === "q4" && isValueColumn(column))
  if (q4) return q4.id
  return valueColumns(board)[0]?.id ?? ""
}

export function defaultScatterColumnIds(board: Board): [string, string] {
  const columns = valueColumns(board).filter((column) => !column.formula)
  const q3 = columns.find((column) => column.id === "q3")?.id
  const q4 = columns.find((column) => column.id === "q4")?.id
  if (q3 && q4) return [q3, q4]
  return [columns[0]?.id ?? "", columns[1]?.id ?? columns[0]?.id ?? ""]
}

export function defaultLineFilter(board: Board): string {
  if (board.aggregateRows) return ""
  const labels = uniqueLabels(board)
  if (labels.includes("Revenue")) return "Revenue"
  return labels[0] ?? ""
}

function formatKpiValue(column: Column, value: number): string {
  if (column.kind === "currency") return formatCompactCurrency(value)
  if (column.kind === "percent") return formatPercent(value)
  return formatNumber(value)
}

function storedNumber(column: Column, raw: string | undefined): number | null {
  if (!isValueColumn(column)) return null
  if (!raw || !raw.trim()) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function visibleRows(board: Board, companyId: string): BoardRow[] {
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)
  return groups.flatMap((group) => group.rows)
}

function filterLabel(rows: BoardRow[], labelEquals: string | undefined): BoardRow[] {
  if (!labelEquals) return rows
  return rows.filter((row) => labelsMatch(row, labelEquals))
}

function labelsMatch(row: BoardRow, label: string): boolean {
  return (row.cells[LABEL_COLUMN_ID] ?? "").trim().toLowerCase() === label.toLowerCase()
}

function lineItemLabel(groupName: string, label: string, groupCount: number, filtered: boolean): string {
  const line = label || "Untitled"
  if (groupCount <= 1) return line
  if (filtered) return groupName
  return `${groupName} · ${line}`
}
