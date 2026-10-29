export const LABEL_COLUMN_ID = "label"

/** Plan column. On the YTD board it sits directly beside Q1. */
export const EXPECTED_COLUMN_ID = "expected"

export const STATUS_VALUES = ["Ahead", "On track", "Watch"] as const

export type StatusValue = (typeof STATUS_VALUES)[number]

export type ColumnKind = "text" | "number" | "currency" | "percent" | "status"

export interface SumFormula {
  op: "sum"
  columnIds: string[]
}

export interface RatioFormula {
  op: "ratio"
  numeratorId: string
  denominatorId: string
}

export interface ProductFormula {
  op: "product"
  columnIds: string[]
}

export type Formula = SumFormula | RatioFormula | ProductFormula

export interface Column {
  id: string
  name: string
  kind: ColumnKind
  formula?: Formula
  /** Working column for the open quarter. */
  emphasis?: boolean
  /** Skip multi-row totals. Used for rates, which do not add across roles. */
  rollup?: "skip"
  /** One reported figure for the firm. Every line in that firm shows the same value. */
  scope?: "firm"
  /** Digits after the decimal. For percents, digits in the percent, not the stored ratio. */
  decimals?: number
  /** Shown on the column header. */
  hint?: string
}

export interface BoardRow {
  id: string
  cells: Record<string, string>
  /** Leave this row out of company sums, portfolio totals, and KPI rollups. */
  omitFromRollup?: boolean
}

export interface BoardGroup {
  id: string
  name: string
  rows: BoardRow[]
  /** Commentary on the YTD board. Plain text, or a small set of formatted HTML. */
  operatingResults?: string
  /** Firm-level ratios, keyed by column id. Shared by every line in the firm. */
  metrics?: Record<string, string>
}

export interface KpiDef {
  id: string
  label: string
  columnId: string
  labelEquals?: string
  compareColumnId?: string
}

export interface Board {
  id: string
  title: string
  subtitle: string
  /**
   * When true, a company mark on the graph sums every row.
   * The P&L board leaves this false so revenue is not added to profit.
   */
  aggregateRows: boolean
  columns: Column[]
  groups: BoardGroup[]
  kpis: KpiDef[]
  /** YTD firm-ratio columns were added. A later delete of one of those columns stays deleted. */
  firmRatios?: boolean
  /** Set on a board created for one firm. Portfolio boards leave this unset. */
  firmId?: string
}

export interface Workspace {
  version: 1
  boards: Board[]
}
