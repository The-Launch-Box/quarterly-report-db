import { cellNumber } from "./metrics"
import { LABEL_COLUMN_ID, type Board, type BoardGroup, type BoardRow, type Column } from "./types"

export interface FirmMark {
  key: string
  label: string
  tableId: string
  values: Record<string, number | null>
}

export interface TrendPoint {
  x: number
  y: number
}

export function tableColumns(board: Board, group: BoardGroup): Column[] {
  return group.columns ?? board.columns
}

/** Rows and sub-rows that have at least one number. Blank starter rows are left out. */
export function firmTableMarks(group: BoardGroup, columns: Column[]): FirmMark[] {
  const marks: FirmMark[] = []
  for (const row of group.rows) {
    pushMark(marks, group.id, row, columns, rowTitle(row))
    for (const subrow of row.subrows ?? []) {
      const subTitle = (subrow.cells[LABEL_COLUMN_ID] ?? "").trim()
      const label = subTitle ? `${rowTitle(row)} · ${subTitle}` : `${rowTitle(row)} · Sub-row`
      pushMark(marks, group.id, subrow, columns, label)
    }
  }
  return marks
}

/** Straight line through the points, from the smallest x to the largest. */
export function trendSegment(points: TrendPoint[]): [TrendPoint, TrendPoint] | null {
  if (points.length < 2) return null
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (const point of points) {
    sumX += point.x
    sumY += point.y
    sumXY += point.x * point.y
    sumXX += point.x * point.x
  }
  const count = points.length
  const denom = count * sumXX - sumX * sumX
  if (denom === 0) return null
  const slope = (count * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / count
  let minX = points[0]?.x ?? 0
  let maxX = minX
  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
  }
  return [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept },
  ]
}

function pushMark(marks: FirmMark[], tableId: string, row: BoardRow, columns: Column[], label: string) {
  const values: Record<string, number | null> = {}
  let any = false
  for (const column of columns) {
    if (column.kind !== "number" && column.kind !== "currency" && column.kind !== "percent") continue
    const value = cellNumber(column, row, columns)
    values[column.id] = value
    if (value !== null) any = true
  }
  if (!any) return
  marks.push({ key: row.id, label, tableId, values })
}

function rowTitle(row: BoardRow): string {
  const label = (row.cells[LABEL_COLUMN_ID] ?? "").trim()
  return label || "Untitled"
}
