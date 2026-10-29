import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from "./format"
import { HEADCOUNT_MONTH_TABLE_ID, HEADCOUNT_TERMINATION_TABLE_ID, HEADCOUNT_TENURE_TABLE_ID } from "./seed"
import { EXPECTED_COLUMN_ID, LABEL_COLUMN_ID, type Board, type BoardGroup, type BoardRow, type Column, type Workspace } from "./types"
import { RATIO_COLUMNS, RATIOS_TABLE_ID, STATEMENT_TABLE_ID, ytdSectionOrder, ytdSectionTitle } from "./ytd-tables"

/** The board's own table, when it is not the YTD income statement. */
export const MAIN_CHART_TABLE_ID = "main"

export interface ChartTable {
  id: string
  title: string
  columns: Column[]
}

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

/** Tables a graph can plot: the board table, YTD ratios, and any added table. */
export function chartTables(board: Board): ChartTable[] {
  if (board.firmId) return []
  const tables: ChartTable[] = []
  if (board.id === "ytd") {
    tables.push({ id: STATEMENT_TABLE_ID, title: ytdSectionTitle(board, STATEMENT_TABLE_ID), columns: board.columns })
    tables.push({ id: RATIOS_TABLE_ID, title: ytdSectionTitle(board, RATIOS_TABLE_ID), columns: RATIO_COLUMNS })
  } else {
    tables.push({ id: MAIN_CHART_TABLE_ID, title: board.title, columns: board.columns })
  }
  for (const tableId of ytdSectionOrder(board)) {
    if (tableId === STATEMENT_TABLE_ID || tableId === RATIOS_TABLE_ID) continue
    const custom = board.ytdCustomTables?.find((table) => table.id === tableId)
    if (!custom) continue
    tables.push({ id: custom.id, title: custom.title, columns: custom.columns })
  }
  return tables
}

/** Firm totals sum the main table only when that board already rolls its rows up. */
export function tableAggregates(board: Board, tableId: string): boolean {
  if (tableId !== MAIN_CHART_TABLE_ID && tableId !== STATEMENT_TABLE_ID) return false
  return board.aggregateRows
}

export function tableLabels(board: Board, tableId: string): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  const skipMeasure = tableId === MAIN_CHART_TABLE_ID || tableId === STATEMENT_TABLE_ID
  for (const group of board.groups) {
    for (const row of rowsForTable(group, tableId)) {
      if (skipMeasure && row.measure) continue
      const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
      if (!label || seen.has(label)) continue
      seen.add(label)
      labels.push(label)
    }
  }
  return labels
}

export function plotRows(board: Board, companyId: string, grain: "company" | "line", lineFilter: string): PlotRow[] {
  const table = chartTables(board).find((item) => item.id === (board.id === "ytd" ? STATEMENT_TABLE_ID : MAIN_CHART_TABLE_ID))
  if (!table) return []
  return plotTable(board, table, companyId, grain, lineFilter)
}

/** One mark per firm, or one mark per row, from a single table. */
export function plotTable(
  board: Board,
  table: ChartTable,
  companyId: string,
  grain: "company" | "line",
  lineFilter: string,
): PlotRow[] {
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)
  const columns = table.columns.filter(isValueColumn)
  const skipMeasure = table.id === MAIN_CHART_TABLE_ID || table.id === STATEMENT_TABLE_ID

  const valuesFor = (rows: BoardRow[]): Record<string, number | null> => {
    const values: Record<string, number | null> = {}
    for (const column of columns) values[column.id] = aggregateColumn(column, rows, table.columns)
    return values
  }

  if (grain === "company") {
    if (!tableAggregates(board, table.id) && !lineFilter) return []
    return groups.map((group) => {
      const rows = rowsForTable(group, table.id)
      const source = !lineFilter ? rows : rows.filter((row) => labelsMatch(row, lineFilter))
      return { key: group.id, groupId: group.id, label: group.name, values: valuesFor(source) }
    })
  }

  const plots: PlotRow[] = []
  for (const group of groups) {
    for (const row of rowsForTable(group, table.id)) {
      if (skipMeasure && row.measure) continue
      const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
      if (lineFilter && label.toLowerCase() !== lineFilter.toLowerCase()) continue
      const values: Record<string, number | null> = {}
      for (const column of columns) values[column.id] = cellNumber(column, row, table.columns)
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

function rowsForTable(group: BoardGroup, tableId: string): BoardRow[] {
  if (tableId === RATIOS_TABLE_ID) return group.ratios ?? []
  if (tableId === MAIN_CHART_TABLE_ID || tableId === STATEMENT_TABLE_ID) return group.rows
  return group.customRows?.[tableId] ?? []
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

/** The table a board's graph opens on. Headcount opens on Month by Month. */
export function defaultChartTableId(board: Board): string {
  const tables = chartTables(board)
  if (board.id === "headcount") {
    const months = tables.find((table) => table.id === HEADCOUNT_MONTH_TABLE_ID)
    if (months) return months.id
  }
  return tables[0]?.id ?? ""
}

export interface CategoryBarSeries {
  id: string
  name: string
  groupId: string
}

export interface CategoryBars {
  column: Column
  series: CategoryBarSeries[]
  points: { label: string; values: Record<string, number | null> }[]
}

/**
 * Bar chart of one table's rows. One firm uses the checked metrics as series.
 * Several firms use one metric, with a series per firm that has a number.
 */
export function categoryBars(board: Board, table: ChartTable, companyId: string, columnIds: readonly string[]): CategoryBars | null {
  const columns = columnIds.flatMap((id) => {
    const column = table.columns.find((item) => item.id === id && isValueColumn(item))
    return column ? [column] : []
  })
  const column = columns[0]
  if (!column) return null
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)
  const points: CategoryBars["points"] = []
  const indexByLabel = new Map<string, number>()

  function pointFor(label: string): CategoryBars["points"][number] {
    const existing = indexByLabel.get(label)
    if (existing !== undefined) return points[existing] ?? { label, values: {} }
    const created = { label, values: {} }
    indexByLabel.set(label, points.length)
    points.push(created)
    return created
  }

  if (groups.length <= 1) {
    const group = groups[0]
    if (group) {
      for (const row of rowsForTable(group, table.id)) {
        const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
        if (!label) continue
        const point = pointFor(label)
        for (const metric of columns) point.values[metric.id] = cellNumber(metric, row, table.columns)
      }
    }
    const series = columns
      .filter((metric) => points.some((point) => typeof point.values[metric.id] === "number"))
      .map((metric) => ({ id: metric.id, name: metric.name, groupId: group?.id ?? "" }))
    return { column, series, points }
  }

  for (const group of groups) {
    for (const row of rowsForTable(group, table.id)) {
      const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
      if (!label) continue
      const point = pointFor(label)
      const value = cellNumber(column, row, table.columns)
      if (typeof value === "number") point.values[group.id] = value
    }
  }
  const series = groups
    .filter((group) => points.some((point) => typeof point.values[group.id] === "number"))
    .map((group) => ({ id: group.id, name: group.name, groupId: group.id }))
  return { column, series, points }
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

/** Termination type and length of service from those headcount tables. All firms uses Improv. */
export function headcountMix(board: Board, companyId: string): HeadcountMix | null {
  if (board.id !== "headcount") return null
  const group = board.groups.find((item) => item.id === (companyId === "all" ? "improv" : companyId))
  if (!group) return null
  const termination = mixSlices(group, HEADCOUNT_TERMINATION_TABLE_ID)
  const tenure = mixSlices(group, HEADCOUNT_TENURE_TABLE_ID)
  if (termination.length === 0 && tenure.length === 0) return null
  return { termination, tenure }
}

function mixSlices(group: BoardGroup, tableId: string): MixSlice[] {
  let index = 0
  return (group.customRows?.[tableId] ?? []).flatMap((row) => {
    const raw = row.cells.share || row.cells.q3 || ""
    const stored = Number(raw)
    if (!Number.isFinite(stored) || stored <= 0) return []
    const value = stored <= 1 ? Math.round(stored * 100) : Math.round(stored)
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
