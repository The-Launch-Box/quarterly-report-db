import { useState } from "react"
import { useNavigate } from "react-router"
import { Plus } from "lucide-react"

import { Button, Field, Input, Modal, Select } from "@/components/ui"
import { listCompanies } from "@/data/metrics"
import { useWorkspace } from "@/data/store"

export function CreateBoardButton() {
  const { canEdit } = useWorkspace()
  const [open, setOpen] = useState(false)
  if (!canEdit) return null

  return (
    <>
      <button
        type="button"
        aria-label="Create a new board"
        title="Create a new board"
        onClick={() => setOpen(true)}
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground outline-none hover:bg-bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
      <CreateBoardDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function CreateBoardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace, companyId } = useWorkspace()
  const firm = listCompanies(workspace).find((company) => company.id === companyId)
  const description =
    companyId === "all"
      ? "Choose a firm. The board shows in the sidebar once that firm is open."
      : `Adds a board for ${firm?.name ?? "this firm"}. It is listed with a circle under the other boards.`

  return (
    <Modal open={open} title="Create a new board" description={description} onClose={onClose}>
      {open ? <CreateBoardForm onDone={onClose} /> : null}
    </Modal>
  )
}

function CreateBoardForm({ onDone }: { onDone: () => void }) {
  const { workspace, companyId, dispatch, setCompanyId } = useWorkspace()
  const navigate = useNavigate()
  const companies = listCompanies(workspace)
  const [firmId, setFirmId] = useState(companyId === "all" ? (companies[0]?.id ?? "") : companyId)
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
        if (!companies.some((company) => company.id === firmId)) {
          setError("Choose a firm.")
          return
        }
        const boardId = crypto.randomUUID()
        dispatch({ type: "add-board", boardId, firmId, title: next })
        setCompanyId(firmId)
        onDone()
        navigate(`/${boardId}`)
      }}
    >
      {companyId === "all" ? (
        <Field label="Firm" htmlFor="board-firm">
          <Select
            id="board-firm"
            value={firmId}
            onChange={setFirmId}
            options={companies.map((company) => ({ value: company.id, label: company.name }))}
            className="w-full"
          />
        </Field>
      ) : null}
      <Field label="Name" htmlFor="board-name">
        <Input
          id="board-name"
          autoFocus
          maxLength={60}
          value={name}
          placeholder="Pipeline"
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Create board</Button>
      </div>
    </form>
  )
}
