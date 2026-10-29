export const LABEL_COLUMN_ID = "label"

/** Smallest and largest column a drag can leave behind, in pixels. */
export const MIN_COLUMN_WIDTH = 72
export const MAX_COLUMN_WIDTH = 720
/** A lone column may grow until it fills a wide display. */
export const SOLO_COLUMN_WIDTH = 3840

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
  /** Dragged width in pixels. Unset columns use a default for their type. */
  width?: number
}

/** The column that may grow to the screen: the only column, or the only one beside the title. */
export function screenWideColumn(columns: readonly Column[]): Column | undefined {
  if (columns.length === 1) return columns[0]
  if (columns.length !== 2) return undefined
  const title = columns.find((column) => column.id === LABEL_COLUMN_ID)
  const other = columns.find((column) => column.id !== LABEL_COLUMN_ID)
  return title && other ? other : undefined
}

export interface BoardRow {
  id: string
  cells: Record<string, string>
  /** Leave this row out of company sums, portfolio totals, and KPI rollups. */
  omitFromRollup?: boolean
  /** Show the money columns as a percent or a plain number, and keep YTD as its own figure. */
  measure?: "percent" | "number"
  /** One level of nested rows on a firm board. Hidden until that row is expanded. */
  subrows?: BoardRow[]
}

export interface BoardGroup {
  id: string
  name: string
  rows: BoardRow[]
  /** Columns for one titled table on a firm board. Portfolio groups use the board columns. */
  columns?: Column[]
  /** Commentary on the YTD board. Plain text, or a small set of formatted HTML. */
  operatingResults?: string
  /** The firm's ratio table. Kept apart from the income-statement lines. */
  ratios?: BoardRow[]
  /** Rows for extra YTD tables, keyed by table id. */
  customRows?: Record<string, BoardRow[]>
  /** Firm-level ratios, keyed by column id. Older saves used this; the ratio table replaces it. */
  metrics?: Record<string, string>
}

/** A table added on YTD. Every firm shares the columns and keeps its own rows. */
export interface YtdCustomTable {
  id: string
  title: string
  columns: Column[]
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
  /** Each firm on YTD has its ratio table. A later delete of one of those rows stays deleted. */
  ratioTable?: boolean
  /** The ratios were briefly stored as income-statement rows. Those saves still load, then move into the table. */
  ratioRows?: boolean
  /** Older saves stored the ratios as columns. Those saves still load, then the table replaces the columns. */
  firmRatios?: boolean
  /** Set on a board created for one firm. Portfolio boards leave this unset. */
  firmId?: string
  /** Tables added on YTD, after Financial results and Ratios. */
  ytdCustomTables?: YtdCustomTable[]
  /** Order of the YTD tables. Built-in ids are "statement" and "ratios". */
  ytdTableOrder?: string[]
}

export interface Workspace {
  version: 1
  boards: Board[]
}
