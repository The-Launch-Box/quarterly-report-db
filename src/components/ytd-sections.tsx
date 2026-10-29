import { Fragment, useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"

import { BoardTable, EditableCell, FirmRatioTables } from "@/components/board-table"
import { ColumnResizeHandle, resizeCeiling, storedColumnWidth, tablePixelWidth, useColumnWidths, useFrameWidth } from "@/components/column-resize"
import { Button, ConfirmDialog, Field, Input, Modal, Select } from "@/components/ui"
import { useWorkspace } from "@/data/store"
import { LABEL_COLUMN_ID, type Board, type BoardGroup, type Column, type ColumnKind, type YtdCustomTable } from "@/data/types"
import { RATIOS_TABLE_ID, STATEMENT_TABLE_ID, ytdSectionOrder, ytdSectionTitle } from "@/data/ytd-tables"
import { cn } from "@/lib/cn"

const COLUMN_KINDS: { value: ColumnKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "status", label: "Status" },
]

export function ExtraTables({ board, companyId }: { board: Board; companyId: string }) {
  const { dispatch } = useWorkspace()
  const tables = board.ytdCustomTables ?? []
  if (tables.length === 0 || board.id === "ytd") return null
  const order = ytdSectionOrder(board)

  return (
    <div className="space-y-8">
      {order.map((tableId, index) => {
        const table = tables.find((item) => item.id === tableId)
        if (!table) return null
        return (
          <CustomYtdTable
            key={table.id}
            board={board}
            table={table}
            companyId={companyId}
            index={index}
            count={order.length}
            onMove={(direction) => dispatch({ type: "move-ytd-table", boardId: board.id, tableId, direction })}
          />
        )
      })}
    </div>
  )
}

export function YtdSections({
  board,
  companyId,
  canDeleteCompany,
  onAddStatementColumn,
  onDeleteCompany,
  onDeleteStatementColumn,
}: {
  board: Board
  companyId: string
  canDeleteCompany: boolean
  onAddStatementColumn: () => void
  onDeleteCompany: (groupId: string, name: string) => void
  onDeleteStatementColumn: (columnId: string, name: string) => void
}) {
  const { dispatch, canEdit } = useWorkspace()
  const order = ytdSectionOrder(board)

  function move(tableId: string, direction: "up" | "down") {
    dispatch({ type: "move-ytd-table", boardId: board.id, tableId, direction })
  }

  return (
    <div className="space-y-8">
      {order.map((tableId, index) => {
        const title = ytdSectionTitle(board, tableId)
        const custom = board.ytdCustomTables?.find((table) => table.id === tableId)
        return (
          <section key={tableId}>
            {custom ? (
              <CustomYtdTable
                board={board}
                table={custom}
                companyId={companyId}
                index={index}
                count={order.length}
                onMove={(direction) => move(tableId, direction)}
              />
            ) : (
              <div className="space-y-3">
                <SectionBar
                  title={title}
                  index={index}
                  count={order.length}
                  canEdit={canEdit}
                  onMove={(direction) => move(tableId, direction)}
                />
                {tableId === STATEMENT_TABLE_ID ? (
                  <BoardTable
                    board={board}
                    companyId={companyId}
                    canDeleteCompany={canDeleteCompany}
                    onAddColumn={onAddStatementColumn}
                    onDeleteCompany={onDeleteCompany}
                    onDeleteColumn={onDeleteStatementColumn}
                  />
                ) : tableId === RATIOS_TABLE_ID ? (
                  <FirmRatioTables board={board} companyId={companyId} />
                ) : null}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function CustomYtdTable({
  board,
  table,
  companyId,
  index,
  count,
  onMove,
}: {
  board: Board
  table: YtdCustomTable
  companyId: string
  index: number
  count: number
  onMove: (direction: "up" | "down") => void
}) {
  const { dispatch, canEdit } = useWorkspace()
  const [columnOpen, setColumnOpen] = useState(false)
  const [pending, setPending] = useState<{ kind: "table" } | { kind: "column"; id: string; name: string } | null>(null)
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)
  const frame = useFrameWidth()
  const ceiling = (column: Column) => resizeCeiling(column, table.columns, frame.width, canEdit, storedColumnWidth)
  const { widthOf, onPointerDown } = useColumnWidths(
    (columnId, width) => dispatch({ type: "set-ytd-column-width", boardId: board.id, tableId: table.id, columnId, width }),
    ceiling,
  )
  const tableWidth = tablePixelWidth(table.columns, canEdit, widthOf)

  function confirmPending() {
    if (!pending) return
    if (pending.kind === "table") dispatch({ type: "delete-ytd-table", boardId: board.id, tableId: table.id })
    if (pending.kind === "column") {
      dispatch({ type: "delete-ytd-column", boardId: board.id, tableId: table.id, columnId: pending.id })
    }
    setPending(null)
  }

  return (
    <>
      <div className="space-y-3">
      <SectionBar
        title={table.title}
        index={index}
        count={count}
        canEdit={canEdit}
        onRename={(title) => dispatch({ type: "rename-ytd-table", boardId: board.id, tableId: table.id, title })}
        onMove={onMove}
        onDelete={() => setPending({ kind: "table" })}
      >
        <Button onClick={() => setColumnOpen(true)}>
          <Plus />
          Add column
        </Button>
      </SectionBar>
      <div ref={frame.ref} className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="border-separate border-spacing-0 text-sm" style={{ width: tableWidth, tableLayout: "fixed" }}>
          <caption className="sr-only">{table.title}</caption>
          <colgroup>
            {table.columns.map((column) => (
              <col key={column.id} style={{ width: widthOf(column) }} />
            ))}
            {canEdit ? <col style={{ width: 48 }} /> : null}
          </colgroup>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  style={{ width: widthOf(column), maxWidth: widthOf(column) }}
                  className={cn(
                    "group/col relative sticky top-0 z-20 border-b border-border bg-card px-2 py-2 text-left align-bottom text-[11px] font-medium tracking-widest text-muted-foreground uppercase",
                    column.id === LABEL_COLUMN_ID && "left-0 z-30 border-r border-border-soft",
                    isNumeric(column.kind) && "text-right",
                  )}
                >
                  <div className={cn("flex min-w-0 items-center gap-1 overflow-hidden pr-2", isNumeric(column.kind) && "justify-end")}>
                    <ColumnName
                      name={column.name}
                      canEdit={canEdit}
                      onRename={(name) =>
                        dispatch({ type: "rename-ytd-column", boardId: board.id, tableId: table.id, columnId: column.id, name })
                      }
                    />
                    {canEdit && column.id !== LABEL_COLUMN_ID ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover/col:opacity-100 focus-visible:opacity-100"
                        aria-label={`Delete ${column.name}`}
                        onClick={() => setPending({ kind: "column", id: column.id, name: column.name })}
                      >
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <ColumnResizeHandle
                      label={column.name}
                      width={widthOf(column)}
                      max={ceiling(column)}
                      onPointerDown={(event) => onPointerDown(column, event)}
                      onResize={(width) =>
                        dispatch({ type: "set-ytd-column-width", boardId: board.id, tableId: table.id, columnId: column.id, width })
                      }
                    />
                  ) : null}
                </th>
              ))}
              {canEdit ? <th scope="col" className="sticky top-0 z-10 w-12 border-b border-border bg-card" /> : null}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <FirmRows
                key={group.id}
                boardId={board.id}
                table={table}
                group={group}
                canEdit={canEdit}
                widthOf={widthOf}
              />
            ))}
          </tbody>
        </table>
      </div>
      </div>
      <AddColumnDialog
        open={columnOpen}
        onClose={() => setColumnOpen(false)}
        onAdd={(name, kind) =>
          dispatch({
            type: "add-ytd-column",
            boardId: board.id,
            tableId: table.id,
            columnId: crypto.randomUUID(),
            name,
            kind,
          })
        }
      />
      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "column" ? "Delete column?" : "Delete table?"}
        description={
          pending?.kind === "column"
            ? `This removes ${pending.name} from ${table.title} for every firm.`
            : `This removes ${table.title} from every firm.`
        }
        confirmLabel={pending?.kind === "column" ? "Delete column" : "Delete table"}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
      />
    </>
  )
}

function FirmRows({
  boardId,
  table,
  group,
  canEdit,
  widthOf,
}: {
  boardId: string
  table: YtdCustomTable
  group: BoardGroup
  canEdit: boolean
  widthOf: (column: Column) => number
}) {
  const { dispatch } = useWorkspace()
  const rows = group.customRows?.[table.id] ?? []
  const span = table.columns.length + (canEdit ? 1 : 0)

  return (
    <Fragment>
      <tr>
        <td colSpan={span} className="border-b border-border-soft bg-bg-raised px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="swatch size-2.5 shrink-0 rounded-sm" data-brand={group.id} aria-hidden="true" />
              {group.name}
            </span>
            {canEdit ? (
              <Button
                variant="outline"
                onClick={() => dispatch({ type: "add-ytd-row", boardId, tableId: table.id, groupId: group.id })}
              >
                <Plus />
                Add row
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.id} className="group">
          {table.columns.map((column) => {
            const previous = row.cells[column.id] ?? ""
            return (
              <td
                key={column.id}
                style={{ width: widthOf(column), maxWidth: widthOf(column) }}
                className={cn(
                  "border-b border-border-soft bg-card px-1 py-1 group-hover:bg-bg-raised",
                  column.id === LABEL_COLUMN_ID && "border-r border-border-soft",
                )}
              >
                <EditableCell
                  column={column}
                  columns={table.columns}
                  row={row}
                  raw={previous}
                  editable={canEdit}
                  ariaLabel={`${column.name} for ${row.cells[LABEL_COLUMN_ID] || "row"} at ${group.name}`}
                  placeholder={column.id === LABEL_COLUMN_ID ? "Title" : undefined}
                  onCommit={(value) => {
                    if (value === previous) return
                    dispatch({
                      type: "set-cell",
                      boardId,
                      groupId: group.id,
                      rowId: row.id,
                      columnId: column.id,
                      value,
                    })
                  }}
                />
              </td>
            )
          })}
          {canEdit ? (
            <td className="border-b border-border-soft bg-card px-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${row.cells[LABEL_COLUMN_ID] || "row"}`}
                onClick={() => dispatch({ type: "delete-ytd-row", boardId, tableId: table.id, groupId: group.id, rowId: row.id })}
              >
                <Trash2 />
              </Button>
            </td>
          ) : null}
        </tr>
      ))}
    </Fragment>
  )
}

function SectionBar({
  title,
  index,
  count,
  canEdit,
  onRename,
  onMove,
  onDelete,
  children,
}: {
  title: string
  index: number
  count: number
  canEdit: boolean
  onRename?: (title: string) => void
  onMove: (direction: "up" | "down") => void
  onDelete?: () => void
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      {onRename ? (
        <EditableTitle title={title} canEdit={canEdit} onRename={onRename} />
      ) : (
        <h2 className="text-2xl leading-none">{title}</h2>
      )}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <Button variant="outline" disabled={index === 0} aria-label={`Move ${title} up`} onClick={() => onMove("up")}>
            <ChevronUp />
            Move up
          </Button>
          <Button variant="outline" disabled={index === count - 1} aria-label={`Move ${title} down`} onClick={() => onMove("down")}>
            <ChevronDown />
            Move down
          </Button>
          {onDelete ? (
            <Button variant="ghost" onClick={onDelete}>
              <Trash2 />
              Delete table
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function EditableTitle({ title, canEdit, onRename }: { title: string; canEdit: boolean; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const cancel = useRef(false)
  useEffect(() => setDraft(title), [title])

  if (!editing || !canEdit) {
    return (
      <h2 className="text-2xl leading-none">
        {canEdit ? (
          <button type="button" className="text-left" title="Rename table" onClick={() => setEditing(true)}>
            {title}
          </button>
        ) : (
          title
        )}
      </h2>
    )
  }

  return (
    <input
      autoFocus
      aria-label="Table name"
      maxLength={60}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false)
        if (cancel.current) {
          cancel.current = false
          setDraft(title)
          return
        }
        const next = draft.trim()
        if (next && next !== title) onRename(next)
        else setDraft(title)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          cancel.current = true
          event.currentTarget.blur()
        }
      }}
      className="w-full max-w-xl bg-transparent font-display text-2xl leading-none uppercase text-foreground outline-none"
    />
  )
}

function ColumnName({ name, canEdit, onRename }: { name: string; canEdit: boolean; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const cancel = useRef(false)
  useEffect(() => setDraft(name), [name])

  if (!editing || !canEdit) {
    if (!canEdit) return <span className="truncate px-1">{name}</span>
    return (
      <button type="button" className="min-w-0 truncate px-1 text-left" title="Rename column" onClick={() => setEditing(true)}>
        {name}
      </button>
    )
  }

  return (
    <input
      autoFocus
      aria-label="Column name"
      maxLength={60}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false)
        if (cancel.current) {
          cancel.current = false
          setDraft(name)
          return
        }
        const next = draft.trim()
        if (next && next !== name) onRename(next)
        else setDraft(name)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur()
        if (event.key === "Escape") {
          cancel.current = true
          event.currentTarget.blur()
        }
      }}
      className="w-full min-w-0 bg-transparent px-1 text-[11px] font-medium tracking-widest text-foreground uppercase outline-none"
    />
  )
}

function AddColumnDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (name: string, kind: ColumnKind) => void
}) {
  return (
    <Modal open={open} title="Add column" description="Adds the column for every firm on this table." onClose={onClose}>
      {open ? <ColumnForm onClose={onClose} onAdd={onAdd} /> : null}
    </Modal>
  )
}

function ColumnForm({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, kind: ColumnKind) => void }) {
  const [name, setName] = useState("")
  const [kind, setKind] = useState<ColumnKind>("text")
  const [error, setError] = useState("")

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const next = name.trim()
        if (!next) {
          setError("Enter a name.")
          return
        }
        if (next.length > 60) {
          setError("Use 60 characters or fewer.")
          return
        }
        onAdd(next, kind)
        onClose()
      }}
    >
      <Field label="Name" htmlFor="ytd-column-name">
        <Input id="ytd-column-name" autoFocus value={name} placeholder="Notes" onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Type" htmlFor="ytd-column-kind">
        <Select id="ytd-column-kind" value={kind} onChange={(value) => setKind(readKind(value))} options={COLUMN_KINDS} />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Add column</Button>
      </div>
    </form>
  )
}

function readKind(value: string): ColumnKind {
  if (value === "text" || value === "number" || value === "currency" || value === "percent" || value === "status") return value
  return "text"
}

function isNumeric(kind: ColumnKind): boolean {
  return kind === "number" || kind === "currency" || kind === "percent"
}
