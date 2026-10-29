import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { BarChart3, Columns2, Plus, RotateCcw, Table2 } from "lucide-react"

import { BoardChart } from "@/components/board-chart"
import { BoardTable } from "@/components/board-table"
import { CustomBoardScreen } from "@/components/custom-board"
import { YtdOperatingResults } from "@/components/operating-results"
import { YtdSections } from "@/components/ytd-sections"
import { Button, ConfirmDialog, Field, Input, KpiCard, Modal, Segmented, Select } from "@/components/ui"
import { computeKpis, listCompanies } from "@/data/metrics"
import { useWorkspace } from "@/data/store"
import type { ColumnKind } from "@/data/types"
import { cn } from "@/lib/cn"

type ViewMode = "split" | "table" | "chart"

type Pending =
  | { kind: "reset" }
  | { kind: "company"; id: string; name: string }
  | { kind: "column"; id: string; name: string }
  | null

const COLUMN_KINDS: { value: ColumnKind; label: string }[] = [
  { value: "currency", label: "Currency" },
  { value: "number", label: "Number" },
  { value: "percent", label: "Percent" },
  { value: "text", label: "Text" },
  { value: "status", label: "Status" },
]

export function BoardPage() {
  const { boardId } = useParams()
  const { workspace } = useWorkspace()
  const board = workspace.boards.find((item) => item.id === boardId)

  useEffect(() => {
    document.title = board ? `${board.title} · Quarterly report` : "Board not found · Quarterly report"
  }, [board])

  if (!board) {
    return (
      <header>
        <h1 className="text-4xl leading-none">Board not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">Open a board from the list.</p>
      </header>
    )
  }

  if (board.firmId) return <CustomBoardScreen key={board.id} boardId={board.id} />
  return <BoardScreen key={board.id} boardId={board.id} />
}

function BoardScreen({ boardId }: { boardId: string }) {
  const { workspace, dispatch, companyId, canEdit, resetToSeed } = useWorkspace()
  const board = workspace.boards.find((item) => item.id === boardId)
  const [view, setView] = useState<ViewMode>("split")
  const [columnOpen, setColumnOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [companyOpen, setCompanyOpen] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  if (!board) return null

  const companies = listCompanies(workspace)
  const company = companies.find((item) => item.id === companyId)
  const kpis = computeKpis(board, companyId)

  function confirmPending() {
    if (!pending) return
    if (pending.kind === "reset") void resetToSeed()
    if (pending.kind === "company") dispatch({ type: "delete-company", groupId: pending.id })
    if (pending.kind === "column") dispatch({ type: "delete-column", boardId, columnId: pending.id })
    setPending(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {company ? company.name : "All firms"} · FY2026
          </p>
          <h1 className="mt-1 text-4xl leading-none">{board.title}</h1>
          {board.subtitle ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{board.subtitle}</p> : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {board.id === "ytd" ? (
              <Button onClick={() => setTableOpen(true)}>
                <Plus />
                Add table
              </Button>
            ) : null}
            <Button onClick={() => setColumnOpen(true)}>
              <Plus />
              Add column
            </Button>
            <Button variant="outline" onClick={() => setCompanyOpen(true)}>
              <Plus />
              Add firm
            </Button>
            <Button variant="ghost" onClick={() => setPending({ kind: "reset" })}>
              <RotateCcw />
              Reset boards
            </Button>
          </div>
        ) : null}
      </header>

      <section className={cn("grid gap-3 sm:grid-cols-2", kpis.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} delta={kpi.deltaPct} compareLabel={kpi.compareLabel} />
        ))}
      </section>

      {board.id === "ytd" ? (
        <YtdOperatingResults
          groups={companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)}
          canEdit={canEdit}
          onCommit={(groupId, value) => dispatch({ type: "set-operating-results", groupId, value })}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">View</p>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "split", label: "Split", icon: Columns2 },
            { value: "table", label: "Table", icon: Table2 },
            { value: "chart", label: "Graph", icon: BarChart3 },
          ]}
        />
      </div>

      {view === "chart" ? null : board.id === "ytd" ? (
        <YtdSections
          board={board}
          companyId={companyId}
          canDeleteCompany={companies.length > 1}
          onAddStatementColumn={() => setColumnOpen(true)}
          onDeleteCompany={(id, name) => setPending({ kind: "company", id, name })}
          onDeleteStatementColumn={(id, name) => setPending({ kind: "column", id, name })}
        />
      ) : (
        <BoardTable
          board={board}
          companyId={companyId}
          canDeleteCompany={companies.length > 1}
          onAddColumn={() => setColumnOpen(true)}
          onDeleteCompany={(id, name) => setPending({ kind: "company", id, name })}
          onDeleteColumn={(id, name) => setPending({ kind: "column", id, name })}
        />
      )}
      {view === "table" ? null : <BoardChart key={board.id} board={board} companyId={companyId} />}

      <AddColumnDialog boardId={board.id} open={columnOpen} onClose={() => setColumnOpen(false)} />
      <AddYtdTableDialog boardId={board.id} open={tableOpen} onClose={() => setTableOpen(false)} />
      <AddCompanyDialog open={companyOpen} onClose={() => setCompanyOpen(false)} />
      <ConfirmDialog
        open={pending !== null}
        title={pendingTitle(pending)}
        description={pendingDescription(pending)}
        confirmLabel={pendingLabel(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirmPending}
      />
    </div>
  )
}

function AddColumnDialog({ boardId, open, onClose }: { boardId: string; open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      title="Add column"
      description="Adds a column on this board. Every firm gets the new cells."
      onClose={onClose}
    >
      {open ? <ColumnForm boardId={boardId} onDone={onClose} /> : null}
    </Modal>
  )
}

function ColumnForm({ boardId, onDone }: { boardId: string; onDone: () => void }) {
  const { dispatch } = useWorkspace()
  const [name, setName] = useState("")
  const [kind, setKind] = useState<ColumnKind>("currency")
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
        dispatch({ type: "add-column", boardId, name: next, kind })
        onDone()
      }}
    >
      <Field label="Name" htmlFor="column-name">
        <Input id="column-name" autoFocus value={name} placeholder="Q4 adjustment" onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Type" htmlFor="column-kind">
        <Select id="column-kind" value={kind} onChange={(value) => setKind(readKind(value))} options={COLUMN_KINDS} />
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

function AddYtdTableDialog({ boardId, open, onClose }: { boardId: string; open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      title="Add table"
      description="Name the table. Every firm gets it, with a title column and one more column."
      onClose={onClose}
    >
      {open ? <YtdTableForm boardId={boardId} onDone={onClose} /> : null}
    </Modal>
  )
}

function YtdTableForm({ boardId, onDone }: { boardId: string; onDone: () => void }) {
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
        dispatch({
          type: "add-ytd-table",
          boardId,
          tableId: crypto.randomUUID(),
          columnId: crypto.randomUUID(),
          title: next,
        })
        onDone()
      }}
    >
      <Field label="Title" htmlFor="ytd-table-name">
        <Input id="ytd-table-name" autoFocus maxLength={60} value={title} placeholder="Pipeline" onChange={(event) => setTitle(event.target.value)} />
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

function AddCompanyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      title="Add firm"
      description="Adds the firm to YTD results, headcount, and revenue goals."
      onClose={onClose}
    >
      {open ? <CompanyForm onDone={onClose} /> : null}
    </Modal>
  )
}

function CompanyForm({ onDone }: { onDone: () => void }) {
  const { dispatch } = useWorkspace()
  const [name, setName] = useState("")
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
        dispatch({ type: "add-company", name: next })
        onDone()
      }}
    >
      <Field label="Name" htmlFor="company-name">
        <Input id="company-name" autoFocus value={name} placeholder="Northwind" onChange={(event) => setName(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Add firm</Button>
      </div>
    </form>
  )
}

function readKind(value: string): ColumnKind {
  if (value === "text" || value === "number" || value === "currency" || value === "percent" || value === "status") return value
  return "currency"
}

function pendingTitle(pending: Pending): string {
  if (pending?.kind === "reset") return "Reset boards?"
  if (pending?.kind === "company") return "Delete firm?"
  if (pending?.kind === "column") return "Delete column?"
  return "Confirm"
}

function pendingDescription(pending: Pending): string {
  if (pending?.kind === "reset") {
    return "Restores the starter figures in this view. Boards you created for these firms stay. Save to publish them. The previous save is kept for up to 24 hours."
  }
  if (pending?.kind === "company") {
    return `This removes ${pending.name} from YTD results, headcount, and revenue goals, and deletes boards created for that firm.`
  }
  if (pending?.kind === "column") return `This removes ${pending.name} and its cells from this board.`
  return ""
}

function pendingLabel(pending: Pending): string {
  if (pending?.kind === "reset") return "Reset boards"
  if (pending?.kind === "company") return "Delete firm"
  if (pending?.kind === "column") return "Delete column"
  return "Confirm"
}
