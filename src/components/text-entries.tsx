import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"

import { FormattedNote } from "@/components/operating-results"
import { Button, ConfirmDialog, Field, Input, Modal } from "@/components/ui"
import { useWorkspace } from "@/data/store"
import type { Board } from "@/data/types"

export function BoardTextEntries({ board, companyId }: { board: Board; companyId: string }) {
  const { dispatch, canEdit } = useWorkspace()
  const entries = board.textEntries ?? []
  const [pending, setPending] = useState<{ id: string; title: string } | null>(null)
  if (entries.length === 0) return null

  const subjects = textSubjects(board, companyId)
  const showNames = !board.firmId && subjects.length > 1

  function confirmDelete() {
    if (!pending) return
    dispatch({ type: "delete-text-entry", boardId: board.id, entryId: pending.id })
    setPending(null)
  }

  return (
    <div className="space-y-8">
      {entries.map((entry, index) => (
        <section key={entry.id} className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <EntryTitle
              title={entry.title}
              canEdit={canEdit}
              onRename={(title) => dispatch({ type: "rename-text-entry", boardId: board.id, entryId: entry.id, title })}
            />
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                {entries.length > 1 ? (
                  <>
                    <Button
                      variant="outline"
                      disabled={index === 0}
                      aria-label={`Move ${entry.title} up`}
                      onClick={() => dispatch({ type: "move-text-entry", boardId: board.id, entryId: entry.id, direction: "up" })}
                    >
                      <ChevronUp />
                      Move up
                    </Button>
                    <Button
                      variant="outline"
                      disabled={index === entries.length - 1}
                      aria-label={`Move ${entry.title} down`}
                      onClick={() => dispatch({ type: "move-text-entry", boardId: board.id, entryId: entry.id, direction: "down" })}
                    >
                      <ChevronDown />
                      Move down
                    </Button>
                  </>
                ) : null}
                <Button variant="ghost" onClick={() => setPending({ id: entry.id, title: entry.title })}>
                  <Trash2 />
                  Delete text
                </Button>
              </div>
            ) : null}
          </div>
          <div className="space-y-5">
            {subjects.map((subject) => (
              <div key={subject.id} className="space-y-2">
                {showNames ? <h3 className="text-sm font-medium">{subject.name}</h3> : null}
                <FormattedNote
                  label={showNames ? `${entry.title} for ${subject.name}` : entry.title}
                  value={entry.bodies[subject.id] ?? ""}
                  canEdit={canEdit}
                  placeholder="Write here."
                  emptyLabel="Nothing here yet."
                  onCommit={(value) =>
                    dispatch({
                      type: "set-text-entry",
                      boardId: board.id,
                      entryId: entry.id,
                      groupId: subject.id,
                      value,
                    })
                  }
                />
              </div>
            ))}
          </div>
        </section>
      ))}
      <ConfirmDialog
        open={pending !== null}
        title="Delete text?"
        description={pending ? `This removes ${pending.title} from this board.` : ""}
        confirmLabel="Delete text"
        onClose={() => setPending(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export function AddTextEntryDialog({
  boardId,
  open,
  firmWide,
  onClose,
}: {
  boardId: string
  open: boolean
  firmWide: boolean
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title="Add formatted text"
      description={
        firmWide
          ? "Name the note. Each firm keeps its own text, with headings, lists, and emphasis."
          : "Name the note. It keeps headings, lists, and emphasis."
      }
      onClose={onClose}
    >
      {open ? <TextEntryForm boardId={boardId} onDone={onClose} /> : null}
    </Modal>
  )
}

function TextEntryForm({ boardId, onDone }: { boardId: string; onDone: () => void }) {
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
        dispatch({ type: "add-text-entry", boardId, entryId: crypto.randomUUID(), title: next })
        onDone()
      }}
    >
      <Field label="Title" htmlFor="text-entry-name">
        <Input
          id="text-entry-name"
          autoFocus
          maxLength={60}
          value={title}
          placeholder="Notes"
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Add text</Button>
      </div>
    </form>
  )
}

function EntryTitle({ title, canEdit, onRename }: { title: string; canEdit: boolean; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const cancel = useRef(false)
  useEffect(() => setDraft(title), [title])

  if (!editing || !canEdit) {
    return (
      <h2 className="text-2xl leading-none">
        {canEdit ? (
          <button type="button" className="text-left" title="Rename text" onClick={() => setEditing(true)}>
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
      aria-label="Text name"
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

function textSubjects(board: Board, companyId: string): { id: string; name: string }[] {
  if (board.firmId) return [{ id: board.firmId, name: "" }]
  const groups = companyId === "all" ? board.groups : board.groups.filter((group) => group.id === companyId)
  return groups.map((group) => ({ id: group.id, name: group.name }))
}
