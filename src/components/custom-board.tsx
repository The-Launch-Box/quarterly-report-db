import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { Plus, Trash2 } from "lucide-react"

import { EditableCell } from "@/components/board-table"
import { Button, ConfirmDialog, Field, Input, Modal, Select } from "@/components/ui"
import { listCompanies } from "@/data/metrics"
import { useWorkspace } from "@/data/store"
import { LABEL_COLUMN_ID, type BoardGroup, type Column, type ColumnKind } from "@/data/types"
import { cn } from "@/lib/cn"

const COLUMN_KINDS: { value: ColumnKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "percent", label: "Percent" },
  { value: "status", label: "Status" },
]

type Pending =
  | { kind: "board" }
  | { kind: "column"; groupId: string; id: string; name: string }
  | { kind: "table"; id: string; name: string }
  | null

export function CustomBoardScreen({ boardId }: { boardId: string }) {
  const { workspace, dispatch, canEdit } = useWorkspace()
  const navigate = useNavigate()
  const board = workspace.boards.find((item) => item.id === boardId)
  const [columnGroupId, setColumnGroupId] = useState<string | null>(null)
  const [tableOpen, setTableOpen] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [flash, setFlash] = useState<{ rowId: string; token: number } | null>(null)
  const flashCount = useRef(0)
  if (!board?.firmId) return null

  const firmName = listCompanies(workspace).find((company) => company.id === board.firmId)?.name ?? "Firm"
  const pendingCopy = describePending(pending, board.title, firmName)

  function commitCell(groupId: string, rowId: string, columnId: string, value: string, previous: string) {
    if (value === previous) return
    dispatch({ type: "set-cell", boardId, groupId, rowId, columnId, value })
    flashCount.current += 1
    setFlash({ rowId, token: flashCount.current })
  }

  function confirmPending() {
    if (!pending) return
    if (pending.kind === "board") {
      dispatch({ type: "delete-board", boardId })
      navigate("/ytd")
    }
    if (pending.kind === "column") {
      dispatch({ type: "delete-column", boardId, groupId: pending.groupId, columnId: pending.id })
    }
    if (pending.kind === "table") dispatch({ type: "delete-table", boardId, groupId: pending.id })
    setPending(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{firmName}</p>
          <BoardTitle
            title={board.title}
            canEdit={canEdit}
            onRename={(title) => dispatch({ type: "rename-board", boardId, title })}
          />
          <BoardDescription
            subtitle={board.subtitle}
            canEdit={canEdit}
            onChange={(subtitle) => dispatch({ type: "set-board-subtitle", boardId, subtitle })}
          />
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setTableOpen(true)}>
              <Plus />
              Add table
            </Button>
            <Button variant="ghost" onClick={() => setPending({ kind: "board" })}>
              <Trash2 />
              Delete board
            </Button>
          </div>
        ) : null}
      </header>

      <div className="space-y-8">
        {board.groups.map((group) => (
          <FirmTable
            key={group.id}
            boardTitle={board.title}
            group={group}
            columns={group.columns ?? board.columns}
            canEdit={canEdit}
            canDelete={board.groups.length > 1}
            flash={flash}
            onCommit={(rowId, columnId, value, previous) => commitCell(group.id, rowId, columnId, value, previous)}
            onAddRow={() => dispatch({ type: "add-row", boardId, groupId: group.id })}
            onAddColumn={() => setColumnGroupId(group.id)}
            onRename={(title) => dispatch({ type: "rename-table", boardId, groupId: group.id, title })}
            onRenameColumn={(columnId, name) =>
              dispatch({ type: "rename-column", boardId, groupId: group.id, columnId, name })
            }
            onDeleteColumn={(id, name) => setPending({ kind: "column", groupId: group.id, id, name })}
            onDeleteRow={(rowId) => dispatch({ type: "delete-row", boardId, groupId: group.id, rowId })}
            onDelete={() => setPending({ kind: "table", id: group.id, name: group.name })}
          />
        ))}
      </div>

      <AddColumnDialog
        boardId={board.id}
        groupId={columnGroupId}
        open={columnGroupId !== null}
        onClose={() => setColumnGroupId(null)}
      />
      <AddTableDialog boardId={board.id} open={tableOpen} onClose={() => setTableOpen(false)} />
      <ConfirmDialog
        open={pending !== null}
        title={pendingCopy.title}
        description={pendingCopy.description}
        confirmLabel={pendingCopy.confirmLabel}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
      />
    </div>
  )
}

function describePending(pending: Pending, boardTitle: string, firmName: string) {
  if (pending?.kind === "column") {
    return {
      title: "Delete column?",
      description: `This removes ${pending.name} and the titles in its cells.`,
      confirmLabel: "Delete column",
    }
  }
  if (pending?.kind === "table") {
    return {
      title: "Delete table?",
      description: `This removes ${pending.name} from ${boardTitle}.`,
      confirmLabel: "Delete table",
    }
  }
  return {
    title: "Delete board?",
    description: `This removes ${boardTitle} from ${firmName}.`,
    confirmLabel: "Delete board",
  }
}

function FirmTable({
  boardTitle,
  group,
  columns,
  canEdit,
  canDelete,
  flash,
  onCommit,
  onAddRow,
  onAddColumn,
  onRename,
  onRenameColumn,
  onDeleteColumn,
  onDeleteRow,
  onDelete,
}: {
  boardTitle: string
  group: BoardGroup
  columns: Column[]
  canEdit: boolean
  canDelete: boolean
  flash: { rowId: string; token: number } | null
  onCommit: (rowId: string, columnId: string, value: string, previous: string) => void
  onAddRow: () => void
  onAddColumn: () => void
  onRename: (title: string) => void
  onRenameColumn: (columnId: string, name: string) => void
  onDeleteColumn: (columnId: string, name: string) => void
  onDeleteRow: (rowId: string) => void
  onDelete: () => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TableTitle title={group.name} canEdit={canEdit} onRename={onRename} />
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onAddColumn}>
              <Plus />
              Add column
            </Button>
            <Button variant="outline" onClick={onAddRow}>
              <Plus />
              Add row
            </Button>
            {canDelete ? (
              <Button variant="ghost" onClick={onDelete}>
                <Trash2 />
                Delete table
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            {group.name} on {boardTitle}
          </caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "group/col sticky top-0 z-20 border-b border-border bg-card px-2 py-2 text-left align-bottom text-[11px] font-medium tracking-widest text-muted-foreground uppercase",
                    column.id === LABEL_COLUMN_ID && "left-0 z-30 min-w-56 border-r border-border-soft",
                    column.kind === "status" && "min-w-36",
                    isNumeric(column.kind) && "min-w-36 text-right",
                    column.kind === "text" && column.id !== LABEL_COLUMN_ID && "min-w-44",
                  )}
                >
                  <div className={cn("flex items-center gap-1", isNumeric(column.kind) && "justify-end")}>
                    <ColumnTitle column={column} onRename={canEdit ? (name) => onRenameColumn(column.id, name) : undefined} />
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
                  <Button variant="ghost" size="icon" aria-label={`Add column to ${group.name}`} onClick={onAddColumn}>
                    <Plus />
                  </Button>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => {
              const rowLabel = row.cells[LABEL_COLUMN_ID]?.trim() || "untitled"
              const token = flash?.rowId === row.id ? flash.token : null
              return (
                <tr key={row.id} className="group">
                  {columns.map((column) => {
                    const previous = row.cells[column.id] ?? ""
                    return (
                      <td
                        key={column.id}
                        className={cn(
                          "relative border-b border-border-soft bg-card px-1 py-1 group-hover:bg-bg-raised",
                          column.id === LABEL_COLUMN_ID && "sticky left-0 z-10 min-w-56 border-r border-border-soft",
                        )}
                      >
                        {token !== null ? <span key={token} className="cell-flash pointer-events-none absolute inset-0" /> : null}
                        <EditableCell
                          column={column}
                          columns={columns}
                          row={row}
                          raw={previous}
                          editable={canEdit}
                          placeholder={column.kind === "text" ? "Title" : undefined}
                          ariaLabel={`${column.name} for ${rowLabel}`}
                          onCommit={(value) => onCommit(row.id, column.id, value, previous)}
                        />
                      </td>
                    )
                  })}
                  {canEdit ? (
                    <td className="border-b border-border-soft bg-card px-1 group-hover:bg-bg-raised">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Delete ${rowLabel}`}
                        onClick={() => onDeleteRow(row.id)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
            {canEdit ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-1">
                  <Button variant="ghost" size="sm" onClick={onAddRow}>
                    <Plus />
                    Add row
                  </Button>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BoardTitle({ title, canEdit, onRename }: { title: string; canEdit: boolean; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const cancel = useRef(false)
  useEffect(() => setDraft(title), [title])

  if (!editing || !canEdit) {
    return (
      <h1 className="mt-1 text-4xl leading-none">
        {canEdit ? (
          <button type="button" className="text-left" title="Rename board" onClick={() => setEditing(true)}>
            {title}
          </button>
        ) : (
          title
        )}
      </h1>
    )
  }

  return (
    <input
      autoFocus
      aria-label="Board name"
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
      className="mt-1 w-full max-w-2xl bg-transparent font-display text-4xl leading-none uppercase text-foreground outline-none"
    />
  )
}

function BoardDescription({
  subtitle,
  canEdit,
  onChange,
}: {
  subtitle: string
  canEdit: boolean
  onChange: (subtitle: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(subtitle)
  const cancel = useRef(false)
  useEffect(() => setDraft(subtitle), [subtitle])

  if (!editing || !canEdit) {
    if (!subtitle && !canEdit) return null
    if (!canEdit) return <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
    return (
      <button
        type="button"
        className={cn("mt-2 max-w-2xl text-left text-sm", subtitle ? "text-muted-foreground" : "text-fg-faint")}
        title={subtitle ? "Edit description" : "Add a description"}
        onClick={() => setEditing(true)}
      >
        {subtitle || "Add a description"}
      </button>
    )
  }

  return (
    <textarea
      autoFocus
      aria-label="Board description"
      maxLength={400}
      rows={2}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false)
        if (cancel.current) {
          cancel.current = false
          setDraft(subtitle)
          return
        }
        const next = draft.trim().replace(/\s+/g, " ")
        if (next !== subtitle) onChange(next)
        else setDraft(subtitle)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === "Escape") {
          cancel.current = true
          event.currentTarget.blur()
        }
      }}
      className="mt-2 w-full max-w-2xl resize-none bg-transparent text-sm text-muted-foreground outline-none"
    />
  )
}

function TableTitle({ title, canEdit, onRename }: { title: string; canEdit: boolean; onRename: (title: string) => void }) {
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

function ColumnTitle({ column, onRename }: { column: Column; onRename?: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(column.name)
  const cancel = useRef(false)
  useEffect(() => setDraft(column.name), [column.name])

  if (!editing || !onRename) {
    if (!onRename) return <span className="truncate px-1">{column.name}</span>
    return (
      <button type="button" className="truncate rounded px-1 text-left" title="Rename column" onClick={() => setEditing(true)}>
        {column.name}
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

function AddColumnDialog({
  boardId,
  groupId,
  open,
  onClose,
}: {
  boardId: string
  groupId: string | null
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal open={open} title="Add column" description="Name the column. Text cells under it can each have a title." onClose={onClose}>
      {open && groupId ? <ColumnForm boardId={boardId} groupId={groupId} onDone={onClose} /> : null}
    </Modal>
  )
}

function ColumnForm({ boardId, groupId, onDone }: { boardId: string; groupId: string; onDone: () => void }) {
  const { dispatch } = useWorkspace()
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
          setError("Enter a title.")
          return
        }
        if (next.length > 60) {
          setError("Use 60 characters or fewer.")
          return
        }
        dispatch({ type: "add-column", boardId, groupId, name: next, kind })
        onDone()
      }}
    >
      <Field label="Title" htmlFor="custom-column-name">
        <Input
          id="custom-column-name"
          autoFocus
          maxLength={60}
          value={name}
          placeholder="Owner"
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Type" htmlFor="custom-column-kind">
        <Select id="custom-column-kind" value={kind} onChange={(value) => setKind(readKind(value))} options={COLUMN_KINDS} />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Add column</Button>
      </div>
    </form>
  )
}

function AddTableDialog({ boardId, open, onClose }: { boardId: string; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Add table" description="Name the table. It starts with a title column and one more column." onClose={onClose}>
      {open ? <TableForm boardId={boardId} onDone={onClose} /> : null}
    </Modal>
  )
}

function TableForm({ boardId, onDone }: { boardId: string; onDone: () => void }) {
  const { dispatch } = useWorkspace()
  const [title, setTitle] = useState("")
  const [error, setError] = useState("")

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const next = title.trim()
        if (!next) {
          setError("Enter a title.")
          return
        }
        if (next.length > 60) {
          setError("Use 60 characters or fewer.")
          return
        }
        dispatch({ type: "add-table", boardId, groupId: crypto.randomUUID(), title: next })
        onDone()
      }}
    >
      <Field label="Title" htmlFor="custom-table-name">
        <Input
          id="custom-table-name"
          autoFocus
          maxLength={60}
          value={title}
          placeholder="Ratios"
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Add table</Button>
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
