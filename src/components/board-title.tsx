import { useEffect, useRef, useState } from "react"

export function BoardTitle({ title, canEdit, onRename }: { title: string; canEdit: boolean; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const cancel = useRef(false)
  useEffect(() => setDraft(title), [title])

  if (!editing || !canEdit) {
    return (
      <h1 className="mt-1 text-4xl leading-none">
        {canEdit ? (
          <button type="button" className="text-left" title="Double-click to rename" onDoubleClick={() => setEditing(true)}>
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
