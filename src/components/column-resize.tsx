import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import {
  LABEL_COLUMN_ID,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  SOLO_COLUMN_WIDTH,
  screenWideColumn,
  type Column,
} from "@/data/types"

const ACTION_COLUMN_WIDTH = 48

export function storedColumnWidth(column: Column): number {
  if (column.width !== undefined) return column.width
  if (column.id === LABEL_COLUMN_ID) return 256
  if (column.scope === "firm") return 144
  if (column.kind === "status" || column.kind === "number" || column.kind === "currency" || column.kind === "percent") {
    return 160
  }
  return 240
}

export function clampColumnWidth(width: number, limit = MAX_COLUMN_WIDTH): number {
  return Math.min(limit, Math.max(MIN_COLUMN_WIDTH, Math.round(width)))
}

/** How far a column may be dragged. A lone column can grow until the table fills its frame. */
export function resizeCeiling(
  column: Column,
  columns: readonly Column[],
  frameWidth: number,
  trailing: boolean,
  widthOf: (column: Column) => number,
): number {
  if (screenWideColumn(columns)?.id !== column.id) return MAX_COLUMN_WIDTH
  const siblings = columns.reduce((sum, item) => (item.id === column.id ? sum : sum + widthOf(item)), 0)
  const room = Math.round(frameWidth - siblings - (trailing ? ACTION_COLUMN_WIDTH : 0))
  if (room <= MAX_COLUMN_WIDTH) return MAX_COLUMN_WIDTH
  return Math.min(SOLO_COLUMN_WIDTH, room)
}

export function useFrameWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

export function tablePixelWidth(columns: Column[], trailing: boolean, widthOf: (column: Column) => number): number {
  const columnsWidth = columns.reduce((sum, column) => sum + widthOf(column), 0)
  return columnsWidth + (trailing ? ACTION_COLUMN_WIDTH : 0)
}

export function useColumnWidths(
  onCommit: (columnId: string, width: number) => void,
  ceiling: (column: Column) => number = () => MAX_COLUMN_WIDTH,
) {
  const [live, setLive] = useState<{ id: string; width: number } | null>(null)
  const ceilingRef = useRef(ceiling)
  ceilingRef.current = ceiling

  function widthOf(column: Column): number {
    if (live?.id === column.id) return live.width
    return storedColumnWidth(column)
  }

  function clamp(column: Column, width: number): number {
    return clampColumnWidth(width, ceilingRef.current(column))
  }

  function onPointerDown(column: Column, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const start = widthOf(column)
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    function move(moveEvent: PointerEvent) {
      setLive({ id: column.id, width: clamp(column, start + moveEvent.clientX - startX) })
    }

    function up(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      const next = clamp(column, start + upEvent.clientX - startX)
      setLive(null)
      if (next !== start) onCommit(column.id, next)
    }

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return { widthOf, onPointerDown }
}

export function ColumnResizeHandle({
  label,
  width,
  max = MAX_COLUMN_WIDTH,
  onPointerDown,
  onResize,
}: {
  label: string
  width: number
  max?: number
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onResize: (width: number) => void
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      aria-valuemin={MIN_COLUMN_WIDTH}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize"
      className="absolute inset-y-0 right-0 z-50 w-3 cursor-col-resize touch-none before:absolute before:inset-y-0 before:right-0 before:w-0.5 before:bg-border hover:before:bg-primary focus-visible:before:bg-primary"
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const delta = event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0
        if (delta === 0) return
        event.preventDefault()
        onResize(clampColumnWidth(width + delta, max))
      }}
    />
  )
}
