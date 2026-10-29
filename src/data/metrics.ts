import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from "./format"
import { EXPECTED_COLUMN_ID, LABEL_COLUMN_ID, type Board, type BoardGroup, type BoardRow, type Column, type Workspace } from "./types"

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
  if (column.scope === "firm") return false
  return column.kind === "number" || column.kind === "currency" || column.kind === "percent"
}

export function listCompanies(workspace: Workspace): { id: string; name: string }[] {
  const names = new Map<string, string>()
  for (const board of workspace.boards) {
    if (board.firmId) continue
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
      if (row.measure) continue
      const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
      if (!label || seen.has(label)) continue
      seen.add(label)
      labels.push(label)
    }
  }
  return labels
}

/** A ratio row keeps its own figures in the currency columns. */
export function measuredColumn(column: Column, row: BoardRow): Column {
  if (!row.measure) return column
  if (column.kind !== "currency" && column.kind !== "percent" && column.kind !== "number") return column
  const decimals = row.measure === "percent" ? 0 : 2
  if (column.kind === row.measure && column.decimals === decimals && !column.formula) return column
  return { ...column, kind: row.measure, decimals, formula: undefined }
}

export function cellNumber(column: Column, row: BoardRow, columns: Column[], depth = 0): number | null {
  if (depth > 4) return null
  const shown = measuredColumn(column, row)
  if (shown !== column) return storedNumber(shown, row.cells[column.id])
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
  const counted = rows.filter((row) => !row.omitFromRollup)
  if (column.rollup === "skip" && counted.length > 1) return null
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
  for (const row of counted) {
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
  if (column.kind === "percent") return formatPercent(value, column.decimals ?? 1)
  if (column.kind === "number") return formatNumber(value, column.decimals ?? 0)
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
      if (row.measure) continue
      const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
      if (lineFilter && label.toLowerCase() !== lineFilter.toLowerCase()) continue
      const values: Record<string, number | null> = {}
      for (const column of columns) values[column.id] = cellNumber(column, row, board.columns)
      plots.push({
        key: row.id,
        groupId: group.id,
        label: lineItemLabel(group.name, label, groups.length, Boolean(lineFilter)),
        values,
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

export function defaultChartGrain(board: Board): "company" | "line" {
  // Firm totals of revenue goals collapse to the same dollars as YTD revenue.
  if (board.id === "revenue") return "line"
  return "company"
}

export function defaultPieColumnId(board: Board): string {
  const columns = valueColumns(board)
  if (board.id === "headcount") {
    const forecast = columns.find((column) => column.id === "q4" && column.kind === "number")
    if (forecast) return forecast.id
    const count = columns.find((column) => column.kind === "number" && !column.formula)
    if (count) return count.id
  }
  if (board.id === "revenue") {
    const expected = columns.find((column) => column.id === EXPECTED_COLUMN_ID)
    if (expected) return expected.id
  }
  const q4 = columns.find((column) => column.id === "q4")
  if (q4) return q4.id
  return columns[0]?.id ?? ""
}

export function defaultScatterColumnIds(board: Board): [string, string] {
  const columns = valueColumns(board).filter((column) => !column.formula)
  if (board.id === "headcount") {
    const counts = columns.filter((column) => column.kind === "number")
    const closed = counts.find((column) => column.id === "q3")?.id
    const forecast = counts.find((column) => column.id === "q4")?.id
    if (closed && forecast) return [closed, forecast]
    return [counts[0]?.id ?? "", counts[1]?.id ?? counts[0]?.id ?? ""]
  }
  if (board.id === "revenue") {
    const expected = columns.find((column) => column.id === EXPECTED_COLUMN_ID)?.id
    const forecast = columns.find((column) => column.id === "q4")?.id
    if (expected && forecast) return [expected, forecast]
  }
  const q3 = columns.find((column) => column.id === "q3")?.id
  const q4 = columns.find((column) => column.id === "q4")?.id
  if (q3 && q4) return [q3, q4]
  return [columns[0]?.id ?? "", columns[1]?.id ?? columns[0]?.id ?? ""]
}

export interface ProfitMarginPoint {
  key: string
  label: string
  gross: number | null
  net: number | null
}

export interface ProfitMarginChart {
  netLabel: string
  points: ProfitMarginPoint[]
}

const MARGIN_PERIODS = [
  { id: "q1", label: "Q1" },
  { id: "q2", label: "Q2" },
  { id: "q3", label: "Q3" },
  { id: "q4", label: "Q4" },
] as const

/** Gross margin and profit margin. One firm is plotted by quarter. All companies uses each firm's year-to-date margin. */
export function profitMarginChart(board: Board, companyId: string): ProfitMarginChart | null {
  if (board.id !== "ytd") return null
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)
  if (groups.length === 0) return null
  if (!groups.some((group) => rowByLabel(group, "Revenue") && rowByLabel(group, "Gross profit"))) return null

  if (companyId === "all") {
    return {
      netLabel: netSeriesLabel(groups),
      points: groups.map((group) => marginPoint(group, board.columns, "ytd", group.name)),
    }
  }

  const group = groups[0]
  if (!group) return null
  return {
    netLabel: netSeriesLabel([group]),
    points: MARGIN_PERIODS.map((period) => marginPoint(group, board.columns, period.id, period.label)),
  }
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

function marginPoint(group: BoardGroup, columns: Column[], columnId: string, label: string): ProfitMarginPoint {
  const revenue = labeledValue(group, columns, columnId, "Revenue")
  const profitLine = rowByLabel(group, "Net income") ? "Net income" : "EBITDA"
  return {
    key: `${group.id}-${columnId}`,
    label,
    gross: marginRatio(labeledValue(group, columns, columnId, "Gross profit"), revenue),
    net: marginRatio(labeledValue(group, columns, columnId, profitLine), revenue),
  }
}

function netSeriesLabel(groups: BoardGroup[]): string {
  const sources = new Set(groups.map((group) => (rowByLabel(group, "Net income") ? "net" : "ebitda")))
  if (sources.size === 1 && sources.has("net")) return "Net margin"
  if (sources.size === 1 && sources.has("ebitda")) return "EBITDA margin"
  return "Profit margin"
}

function labeledValue(group: BoardGroup, columns: Column[], columnId: string, label: string): number | null {
  const row = rowByLabel(group, label)
  const column = columns.find((item) => item.id === columnId)
  if (!row || !column) return null
  return cellNumber(column, row, columns)
}

function marginRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null
  return numerator / denominator
}

function rowByLabel(group: BoardGroup, label: string): BoardRow | undefined {
  return group.rows.find((row) => labelsMatch(row, label))
}

/** Deck colors for a headcount mix, in table order: green, red, orange, blue. */
const MIX_COLORS = ["#70ad47", "#e04b4b", "#ed7d31", "#5b9bd5"] as const

export interface MixSlice {
  id: string
  label: string
  value: number
  color: string
}

export interface HeadcountMix {
  termination: MixSlice[]
  tenure: MixSlice[]
}

/** Termination type and length of service from the headcount table. All firms uses Improv. */
export function headcountMix(board: Board, companyId: string): HeadcountMix | null {
  if (board.id !== "headcount") return null
  const group = board.groups.find((item) => item.id === (companyId === "all" ? "improv" : companyId))
  if (!group) return null
  const termination = mixSlices(group, "termination")
  const tenure = mixSlices(group, "tenure")
  if (termination.length === 0 && tenure.length === 0) return null
  return { termination, tenure }
}

function mixSlices(group: BoardGroup, mix: "termination" | "tenure"): MixSlice[] {
  let index = 0
  return group.rows.flatMap((row) => {
    if (row.mix !== mix) return []
    const raw = row.cells.q3 || row.cells[EXPECTED_COLUMN_ID] || ""
    const stored = Number(raw)
    if (!Number.isFinite(stored) || stored <= 0) return []
    const value = row.measure === "percent" ? Math.round(stored * 100) : stored
    const color = MIX_COLORS[index] ?? MIX_COLORS[0]
    index += 1
    const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim() || "Untitled"
    return [{ id: row.id, label, value, color }]
  })
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
