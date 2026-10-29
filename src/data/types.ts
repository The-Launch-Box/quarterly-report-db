export const LABEL_COLUMN_ID = "label"

/** Plan column. On the YTD board it sits directly beside Q1. */
export const EXPECTED_COLUMN_ID = "expected"

export const STATUS_VALUES = ["On track", "Watch", "Behind"] as const

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
}

export interface BoardRow {
  id: string
  cells: Record<string, string>
}

export interface BoardGroup {
  id: string
  name: string
  rows: BoardRow[]
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
}

export interface Workspace {
  version: 1
  boards: Board[]
}
