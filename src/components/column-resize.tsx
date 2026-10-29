import { useState, type PointerEvent as ReactPointerEvent } from "react"

import { LABEL_COLUMN_ID, MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, type Column } from "@/data/types"

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

export function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)))
}

export function tablePixelWidth(columns: Column[], trailing: boolean, widthOf: (column: Column) => number): number {
  const columnsWidth = columns.reduce((sum, column) => sum + widthOf(column), 0)
  return columnsWidth + (trailing ? ACTION_COLUMN_WIDTH : 0)
}

export function useColumnWidths(onCommit: (columnId: string, width: number) => void) {
  const [live, setLive] = useState<{ id: string; width: number } | null>(null)

  function widthOf(column: Column): number {
    if (live?.id === column.id) return live.width
    return storedColumnWidth(column)
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
      setLive({ id: column.id, width: clampColumnWidth(start + moveEvent.clientX - startX) })
    }

    function up(upEvent: PointerEvent) {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      const next = clampColumnWidth(start + upEvent.clientX - startX)
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
  onPointerDown,
  onResize,
}: {
  label: string
  width: number
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  onResize: (width: number) => void
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      aria-valuemin={MIN_COLUMN_WIDTH}
      aria-valuemax={MAX_COLUMN_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize"
      className="absolute top-0 -right-px z-40 h-full w-2 cursor-col-resize touch-none hover:bg-primary/50 focus-visible:bg-primary/50"
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const delta = event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0
        if (delta === 0) return
        event.preventDefault()
        onResize(clampColumnWidth(width + delta))
      }}
    />
  )
}
