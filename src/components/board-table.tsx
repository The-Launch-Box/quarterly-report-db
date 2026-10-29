import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"

import { aggregateColumn, cellNumber, formatColumnValue } from "@/data/metrics"
import { formatCurrency, formatNumber, formatPercent, parseNumber, parsePercentInput } from "@/data/format"
import { useWorkspace } from "@/data/store"
import { LABEL_COLUMN_ID, STATUS_VALUES, type Board, type BoardRow, type Column, type ColumnKind, type StatusValue } from "@/data/types"
import { cn } from "@/lib/cn"
import { Button, Input } from "@/components/ui"

interface BoardTableProps {
  board: Board
  companyId: string
  canDeleteCompany: boolean
  onAddColumn: () => void
  onDeleteCompany: (groupId: string, name: string) => void
  onDeleteColumn: (columnId: string, name: string) => void
}

export function BoardTable({
  board,
  companyId,
  canDeleteCompany,
  onAddColumn,
  onDeleteCompany,
  onDeleteColumn,
}: BoardTableProps) {
  const { dispatch, canEdit } = useWorkspace()
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [flash, setFlash] = useState<{ rowId: string; token: number } | null>(null)
  const flashCount = useRef(0)
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)

  function commitCell(groupId: string, rowId: string, columnId: string, value: string, previous: string) {
    if (value === previous) return
    dispatch({ type: "set-cell", boardId: board.id, groupId, rowId, columnId, value })
    flashCount.current += 1
    setFlash({ rowId, token: flashCount.current })
  }

  function commitFirmMetric(groupId: string, columnId: string, value: string) {
    dispatch({ type: "set-firm-metric", boardId: board.id, groupId, columnId, value })
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
        No firms on this board. Add a firm to start a table.
      </div>
    )
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{board.title}</caption>
        <thead>
          <tr>
            {board.columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "group/col sticky top-0 z-20 border-b border-border bg-card px-2 py-2 text-left align-bottom text-[11px] font-medium tracking-widest text-muted-foreground uppercase",
                  column.id === LABEL_COLUMN_ID && "left-0 z-30 min-w-56 border-r border-border-soft",
                  column.kind === "status" && "min-w-36",
                  isNumeric(column.kind) && "min-w-36 text-right",
                  column.scope === "firm" && "min-w-32 max-w-36 whitespace-normal",
                  column.emphasis && "text-primary shadow-[inset_0_2px_0_var(--color-primary)]",
                )}
              >
                <div className={cn("flex items-center gap-1", isNumeric(column.kind) && "justify-end")} title={column.hint}>
                  <HeaderLabel
                    column={column}
                    onRename={
                      canEdit
                        ? (name) => dispatch({ type: "rename-column", boardId: board.id, columnId: column.id, name })
                        : undefined
                    }
                  />
                  {canEdit && column.id !== LABEL_COLUMN_ID ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover/col:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete ${column.name}`}
                      onClick={() => onDeleteColumn(column.id, column.name)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </th>
            ))}
            {canEdit ? (
              <th scope="col" className="sticky top-0 z-20 w-12 border-b border-border bg-card px-1">
                <Button variant="ghost" size="icon" aria-label="Add column" onClick={onAddColumn}>
                  <Plus />
                </Button>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows
              key={group.id}
              board={board}
              groupId={group.id}
              groupName={group.name}
              collapsed={collapsed.has(group.id)}
              canEdit={canEdit}
              canDeleteCompany={canDeleteCompany}
              showSum={board.aggregateRows}
              flash={flash}
              onToggle={() =>
                setCollapsed((current) => {
                  const next = new Set(current)
                  if (next.has(group.id)) next.delete(group.id)
                  else next.add(group.id)
                  return next
                })
              }
              onCommit={commitCell}
              onCommitMetric={commitFirmMetric}
              onRename={(name) => dispatch({ type: "rename-company", groupId: group.id, name })}
              onAddRow={() => dispatch({ type: "add-row", boardId: board.id, groupId: group.id })}
              onDeleteRow={(rowId) => dispatch({ type: "delete-row", boardId: board.id, groupId: group.id, rowId })}
              onDeleteCompany={() => onDeleteCompany(group.id, group.name)}
            />
          ))}
          {board.aggregateRows && groups.length > 1 ? (
            <SummaryRow
              label="Total"
              board={board}
              rows={groups.flatMap((group) => group.rows).filter((row) => !row.omitFromRollup)}
              trailing={canEdit}
            />
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({
  board,
  groupId,
  groupName,
  collapsed,
  canEdit,
  canDeleteCompany,
  showSum,
  flash,
  onToggle,
  onCommit,
  onCommitMetric,
  onRename,
  onAddRow,
  onDeleteRow,
  onDeleteCompany,
}: {
  board: Board
  groupId: string
  groupName: string
  collapsed: boolean
  canEdit: boolean
  canDeleteCompany: boolean
  showSum: boolean
  flash: { rowId: string; token: number } | null
  onToggle: () => void
  onCommit: (groupId: string, rowId: string, columnId: string, value: string, previous: string) => void
  onCommitMetric: (groupId: string, columnId: string, value: string) => void
  onRename: (name: string) => void
  onAddRow: () => void
  onDeleteRow: (rowId: string) => void
  onDeleteCompany: () => void
}) {
  const group = board.groups.find((item) => item.id === groupId)
  if (!group) return null
  const firmAt = board.columns.findIndex((column) => column.scope === "firm")
  const prefix = firmAt === -1 ? board.columns.length : firmAt
  const tail = firmAt === -1 ? [] : board.columns.slice(firmAt)

  return (
    <>
      <tr>
        <td colSpan={prefix} className="group-rule border-b border-border-soft bg-bg-raised p-0" data-brand={groupId}>
          <div className="sticky left-0 flex w-fit items-center gap-2 px-2 py-1.5">
            <Button variant="ghost" size="icon" aria-expanded={!collapsed} aria-label={`${collapsed ? "Expand" : "Collapse"} ${groupName}`} onClick={onToggle}>
              {collapsed ? <ChevronRight /> : <ChevronDown />}
            </Button>
            <span className="swatch size-2.5 shrink-0 rounded-sm" data-brand={groupId} aria-hidden="true" />
            <CompanyName name={groupName} brandId={groupId} onCommit={canEdit ? onRename : undefined} />
            <span className="text-xs text-muted-foreground">
              {group.rows.length} {group.rows.length === 1 ? "row" : "rows"}
            </span>
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={onAddRow}>
                <Plus />
                Add row
              </Button>
            ) : null}
            {canEdit && canDeleteCompany ? (
              <Button variant="ghost" size="icon" aria-label={`Delete ${groupName}`} onClick={onDeleteCompany}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </td>
        {tail.map((column) => {
          const raw = group.metrics?.[column.id] ?? ""
          return (
            <td key={column.id} className="border-b border-border-soft bg-bg-raised px-1 py-1">
              {column.scope === "firm" ? (
                        <EditableCell
                          column={column}
                          columns={board.columns}
                          row={{ id: group.id, cells: {} }}
                          raw={raw}
                          editable={canEdit}
                          ariaLabel={`${column.name} for ${groupName}`}
                          onCommit={(value) => onCommitMetric(groupId, column.id, value)}
                        />
              ) : null}
            </td>
          )
        })}
        {canEdit ? <td className="border-b border-border-soft bg-bg-raised" /> : null}
      </tr>
      {collapsed
        ? null
        : group.rows.map((row) => {
            const rowLabel = row.cells[LABEL_COLUMN_ID] || "row"
            const token = flash?.rowId === row.id ? flash.token : null
            return (
              <tr key={row.id} className="group">
                {board.columns.map((column) => {
                  const previous = row.cells[column.id] ?? ""
                  return (
                    <td
                      key={column.id}
                      className={cn(
                        "relative border-b border-border-soft bg-card px-1 py-1 group-hover:bg-bg-raised",
                        column.id === LABEL_COLUMN_ID && "sticky left-0 z-10 min-w-56 border-r border-border-soft",
                        column.emphasis && "bg-accent-wash group-hover:bg-accent-wash",
                      )}
                    >
                      {token !== null ? <span key={token} className="cell-flash pointer-events-none absolute inset-0" /> : null}
                      {column.scope === "firm" ? (
                        <span className="block h-8" />
                      ) : (
                        <EditableCell
                          column={column}
                          columns={board.columns}
                          row={row}
                          raw={previous}
                          editable={canEdit}
                          ariaLabel={`${column.name} for ${rowLabel} at ${groupName}`}
                          onCommit={(value) => onCommit(groupId, row.id, column.id, value, previous)}
                        />
                      )}
                    </td>
                  )
                })}
                {canEdit ? (
                  <td className="border-b border-border-soft bg-card px-1 group-hover:bg-bg-raised">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete ${rowLabel} at ${groupName}`}
                      onClick={() => onDeleteRow(row.id)}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                ) : null}
              </tr>
            )
          })}
      {!collapsed && showSum && group.rows.some((row) => !row.omitFromRollup) ? (
        <SummaryRow label="Sum" board={board} rows={group.rows.filter((row) => !row.omitFromRollup)} trailing={canEdit} />
      ) : null}
    </>
  )
}

function SummaryRow({ label, board, rows, trailing }: { label: string; board: Board; rows: BoardRow[]; trailing: boolean }) {
  return (
    <tr>
      {board.columns.map((column) => (
        <td
          key={column.id}
          className={cn(
            "border-b border-border bg-bg-overlay px-3 py-2 font-medium",
            column.id === LABEL_COLUMN_ID && "sticky left-0 z-10 border-r border-border-soft",
            isNumeric(column.kind) && "text-right font-mono text-sm tabular-nums",
          )}
        >
          {column.id === LABEL_COLUMN_ID
            ? label
            : isNumeric(column.kind)
              ? formatColumnValue(column, aggregateColumn(column, rows, board.columns))
              : ""}
        </td>
      ))}
      {trailing ? <td className="border-b border-border bg-bg-overlay" /> : null}
    </tr>
  )
}

function HeaderLabel({ column, onRename }: { column: Column; onRename?: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(column.name)
  const cancel = useRef(false)

  useEffect(() => setDraft(column.name), [column.name])

  if (!editing || !onRename) {
    const label = (
      <span
        className={cn(
          "px-1",
          column.scope === "firm" ? "whitespace-normal text-[10px] leading-tight tracking-wide normal-case" : "truncate",
          isNumeric(column.kind) && "text-right",
        )}
      >
        <span className={cn(column.scope === "firm" ? "normal-case" : "uppercase tracking-widest")}>{column.name}</span>
        {column.formula ? <span className="ml-2 text-[10px] tracking-widest text-fg-faint">Calc</span> : null}
      </span>
    )
    if (!onRename) return label
    return (
      <button
        type="button"
        className={cn(
          "rounded px-1 text-left normal-case",
          column.scope === "firm" ? "whitespace-normal" : "truncate",
          isNumeric(column.kind) && "text-right",
        )}
        onClick={() => setEditing(true)}
      >
        {label}
      </button>
    )
  }

  return (
    <input
      autoFocus
      aria-label={`Rename ${column.name}`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false)
        if (cancel.current) {
          cancel.current = false
          setDraft(column.name)
          return
        }
        const next = draft.trim()
        if (next && next !== column.name) onRename(next)
        else setDraft(column.name)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          cancel.current = true
          event.currentTarget.blur()
        }
      }}
      className="h-7 w-full min-w-24 rounded-md border border-ring bg-bg-raised px-2 font-sans text-xs tracking-normal text-foreground normal-case outline-none"
    />
  )
}

function CompanyName({ name, brandId, onCommit }: { name: string; brandId: string; onCommit?: (name: string) => void }) {
  const [draft, setDraft] = useState(name)
  const cancel = useRef(false)
  useEffect(() => setDraft(name), [name])

  if (!onCommit) return <span className="px-2 font-medium">{name}</span>

  return (
    <Input
      aria-label={`Firm name ${name}`}
      data-brand={brandId}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (cancel.current) {
          cancel.current = false
          setDraft(name)
          return
        }
        const next = draft.trim()
        if (!next || next === name) {
          setDraft(name)
          return
        }
        onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          cancel.current = true
          event.currentTarget.blur()
        }
      }}
      className="company-name h-8 max-w-64 border-transparent bg-transparent px-2 font-medium shadow-none"
    />
  )
}

export function EditableCell({
  column,
  columns,
  row,
  raw,
  editable,
  ariaLabel,
  onCommit,
  placeholder,
}: {
  column: Column
  columns: Column[]
  row: BoardRow
  raw: string
  editable: boolean
  ariaLabel: string
  onCommit: (value: string) => void
  placeholder?: string
}) {
  if (column.formula || !editable) {
    return <ReadOnlyValue column={column} columns={columns} row={row} raw={raw} calculated={Boolean(column.formula)} />
  }
  if (column.kind === "status") return <StatusCell raw={raw} ariaLabel={ariaLabel} onCommit={onCommit} />
  if (column.kind === "text") return <TextCell raw={raw} ariaLabel={ariaLabel} onCommit={onCommit} placeholder={placeholder} />
  return <NumericCell kind={column.kind} decimals={column.decimals} raw={raw} ariaLabel={ariaLabel} onCommit={onCommit} />
}

function ReadOnlyValue({
  column,
  columns,
  row,
  raw,
  calculated,
}: {
  column: Column
  columns: Column[]
  row: BoardRow
  raw: string
  calculated: boolean
}) {
  if (column.kind === "text" && !calculated) return <span className="block px-2">{raw}</span>
  if (column.kind === "status") {
    return <span className={cn("block px-2 text-center text-xs font-semibold", statusClass(raw))}>{raw}</span>
  }
  const value = calculated ? cellNumber(column, row, columns) : raw ? Number(raw) : null
  const shown = value === null || !Number.isFinite(value) ? "" : formatColumnValue(column, value)
  return (
    <span
      title={calculated ? "Calculated from other columns" : undefined}
      className={cn("block px-2 text-right font-mono text-sm tabular-nums", calculated && "text-muted-foreground")}
    >
      {shown}
    </span>
  )
}

function statusClass(raw: string): string {
  if (raw === "Ahead") return "text-info"
  if (raw === "On track") return "text-positive"
  if (raw === "Watch") return "text-warning"
  return "text-fg-faint"
}

function TextCell({
  raw,
  ariaLabel,
  onCommit,
  placeholder,
}: {
  raw: string
  ariaLabel: string
  onCommit: (value: string) => void
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(raw)
  const cancel = useRef(false)
  useEffect(() => {
    if (!focused) setDraft(raw)
  }, [raw, focused])

  return (
    <Input
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={focused ? draft : raw}
      onFocus={(event) => {
        setDraft(raw)
        setFocused(true)
        event.currentTarget.select()
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setFocused(false)
        if (cancel.current) {
          cancel.current = false
          setDraft(raw)
          return
        }
        onCommit(draft)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          cancel.current = true
          event.currentTarget.blur()
        }
      }}
      className="h-8 border-transparent bg-transparent px-2 shadow-none"
    />
  )
}

function NumericCell({
  kind,
  decimals,
  raw,
  ariaLabel,
  onCommit,
}: {
  kind: ColumnKind
  decimals?: number
  raw: string
  ariaLabel: string
  onCommit: (value: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(raw)
  const cancel = useRef(false)
  useEffect(() => {
    if (!focused) setDraft(raw)
  }, [raw, focused])

  const display = raw ? formatRaw(kind, raw, decimals) : ""

  return (
    <Input
      aria-label={ariaLabel}
      inputMode="decimal"
      autoComplete="off"
      value={focused ? draft : display}
      onFocus={(event) => {
        const next = kind === "percent" ? percentDraft(raw, decimals ?? 1) : raw
        setDraft(next)
        setFocused(true)
        event.currentTarget.select()
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setFocused(false)
        if (cancel.current) {
          cancel.current = false
          setDraft(raw)
          return
        }
        commitNumeric(kind, draft, onCommit, decimals)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          cancel.current = true
          event.currentTarget.blur()
        }
      }}
      className="h-8 border-transparent bg-transparent px-2 text-right font-mono text-sm tabular-nums shadow-none"
    />
  )
}

function StatusCell({ raw, ariaLabel, onCommit }: { raw: string; ariaLabel: string; onCommit: (value: string) => void }) {
  const known = STATUS_VALUES.includes(raw as StatusValue)
  return (
    <select
      aria-label={ariaLabel}
      value={raw}
      onChange={(event) => onCommit(event.target.value)}
      className={cn(
        "h-8 w-full cursor-pointer rounded-md border border-transparent px-2 text-center text-xs font-semibold outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        raw === "Ahead" && "bg-info-dim text-info",
        raw === "On track" && "bg-positive-dim text-positive",
        raw === "Watch" && "bg-warning-dim text-warning",
        !raw && "text-fg-faint",
      )}
    >
      {!raw ? <option value="" hidden /> : null}
      {known || !raw ? null : <option value={raw}>{raw}</option>}
      {STATUS_VALUES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  )
}

function commitNumeric(kind: ColumnKind, draft: string, onCommit: (value: string) => void, decimals?: number) {
  if (!draft.trim()) {
    onCommit("")
    return
  }
  const parsed = kind === "percent" ? parsePercentInput(draft) : parseNumber(draft)
  if (parsed === null) return
  if (kind === "percent") {
    onCommit(String(parsed))
    return
  }
  if (kind === "number" && decimals !== undefined) {
    onCommit(String(Number(parsed.toFixed(decimals))))
    return
  }
  onCommit(String(Math.round(parsed)))
}

function percentDraft(raw: string, digits: number): string {
  if (!raw.trim()) return ""
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  return String(Number((value * 100).toFixed(digits)))
}

function formatRaw(kind: ColumnKind, raw: string, decimals?: number): string {
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  if (kind === "currency") return formatCurrency(value)
  if (kind === "percent") return formatPercent(value, decimals ?? 1)
  return formatNumber(value, decimals ?? 0)
}

function isNumeric(kind: ColumnKind): boolean {
  return kind === "number" || kind === "currency" || kind === "percent"
}
