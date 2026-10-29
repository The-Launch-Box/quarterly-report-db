import { memo, useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react"
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react"

import { Button } from "@/components/ui"
import { commitHtml, editorHtml } from "@/data/rich-text"
import type { BoardGroup } from "@/data/types"
import { cn } from "@/lib/cn"

export function YtdOperatingResults({
  groups,
  canEdit,
  onCommit,
}: {
  groups: BoardGroup[]
  canEdit: boolean
  onCommit: (groupId: string, value: string) => void
}) {
  if (groups.length === 0) return null
  const showName = groups.length > 1
  return (
    <section className="space-y-4">
      <h2 className="text-2xl leading-none">YTD operating results</h2>
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.id} className="space-y-2">
            {showName ? <h3 className="text-sm font-medium">{group.name}</h3> : null}
            <OperatingNote
              label={showName ? `YTD operating results for ${group.name}` : "YTD operating results"}
              value={group.operatingResults ?? ""}
              canEdit={canEdit}
              onCommit={(value) => onCommit(group.id, value)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function OperatingNote({
  label,
  value,
  canEdit,
  onCommit,
}: {
  label: string
  value: string
  canEdit: boolean
  onCommit: (value: string) => void
}) {
  const editor = useRef<HTMLDivElement>(null)
  const saved = useRef(value)
  const initialHtml = useRef<string | null>(null)
  const dirty = useRef(false)
  const cancel = useRef(false)
  const commit = useRef(onCommit)
  if (initialHtml.current === null) initialHtml.current = editorHtml(value)
  const [focused, setFocused] = useState(false)
  const [marks, setMarks] = useState<Marks>(EMPTY_MARKS)
  saved.current = value
  commit.current = onCommit

  const syncMarks = useCallback(() => {
    const root = editor.current
    const next: Marks = {
      bold: commandState("bold"),
      italic: commandState("italic"),
      underline: commandState("underline"),
      block: currentBlock(root),
      bullets: insideList(root, "UL"),
      numbers: insideList(root, "OL"),
    }
    setMarks((current) => (sameMarks(current, next) ? current : next))
  }, [])

  useEffect(() => {
    if (focused) return
    const node = editor.current
    if (!node) return
    const next = editorHtml(value)
    if (node.innerHTML !== next) node.innerHTML = next
  }, [value, focused])

  const onFocus = useCallback(() => {
    setFocused(true)
    syncMarks()
  }, [syncMarks])

  const onBlur = useCallback(() => {
    setFocused(false)
    const node = editor.current
    if (!node) return
    if (cancel.current) {
      cancel.current = false
      dirty.current = false
      node.innerHTML = editorHtml(saved.current)
      return
    }
    if (!dirty.current) return
    const next = commitHtml(node.innerHTML)
    dirty.current = false
    node.innerHTML = editorHtml(next)
    if (next !== saved.current) commit.current(next)
  }, [])

  const onInput = useCallback(() => {
    dirty.current = true
    syncMarks()
  }, [syncMarks])

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return
    cancel.current = true
    event.currentTarget.blur()
  }, [])

  const onPaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const html = event.clipboardData.getData("text/html")
    const text = event.clipboardData.getData("text/plain")
    const fragment = (html ? commitHtml(html) : "") || editorHtml(text)
    if (fragment) document.execCommand("insertHTML", false, fragment)
    dirty.current = true
    syncMarks()
  }, [syncMarks])

  function run(command: string, commandValue?: string) {
    editor.current?.focus()
    document.execCommand(command, false, commandValue)
    dirty.current = true
    syncMarks()
  }

  function applyHeading(tag: "H1" | "H2" | "H3") {
    const next = currentBlock(editor.current) === tag ? "P" : tag
    run("formatBlock", `<${next.toLowerCase()}>`)
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-bg-raised",
        focused && canEdit && "border-ring ring-[3px] ring-ring/40",
      )}
    >
      {focused && canEdit ? (
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-1"
          onMouseDown={(event) => event.preventDefault()}
        >
          <FormatButton label="Bold" pressed={marks.bold} onClick={() => run("bold")}>
            <Bold />
          </FormatButton>
          <FormatButton label="Italic" pressed={marks.italic} onClick={() => run("italic")}>
            <Italic />
          </FormatButton>
          <FormatButton label="Underline" pressed={marks.underline} onClick={() => run("underline")}>
            <Underline />
          </FormatButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <FormatButton label="Heading 1" pressed={marks.block === "H1"} onClick={() => applyHeading("H1")}>
            H1
          </FormatButton>
          <FormatButton label="Heading 2" pressed={marks.block === "H2"} onClick={() => applyHeading("H2")}>
            H2
          </FormatButton>
          <FormatButton label="Heading 3" pressed={marks.block === "H3"} onClick={() => applyHeading("H3")}>
            H3
          </FormatButton>
          <span className="mx-1 h-5 w-px bg-border" />
          <FormatButton label="Bulleted list" pressed={marks.bullets} onClick={() => run("insertUnorderedList")}>
            <List />
          </FormatButton>
          <FormatButton label="Numbered list" pressed={marks.numbers} onClick={() => run("insertOrderedList")}>
            <ListOrdered />
          </FormatButton>
        </div>
      ) : null}
      <NoteField
        editor={editor}
        initialHtml={initialHtml.current}
        label={label}
        canEdit={canEdit}
        placeholder={canEdit ? "Add operating results." : "No operating results yet."}
        onFocus={onFocus}
        onBlur={onBlur}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onKeyUp={syncMarks}
        onMouseUp={syncMarks}
        onPaste={onPaste}
      />
    </div>
  )
}

const NoteField = memo(function NoteField({
  editor,
  initialHtml,
  label,
  canEdit,
  placeholder,
  onFocus,
  onBlur,
  onInput,
  onKeyDown,
  onKeyUp,
  onMouseUp,
  onPaste,
}: {
  editor: RefObject<HTMLDivElement | null>
  initialHtml: string
  label: string
  canEdit: boolean
  placeholder: string
  onFocus: () => void
  onBlur: () => void
  onInput: () => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onKeyUp: () => void
  onMouseUp: () => void
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      ref={(node) => {
        editor.current = node
        if (!node || node.dataset.ready === "true") return
        node.innerHTML = initialHtml
        node.dataset.ready = "true"
      }}
      role={canEdit ? "textbox" : undefined}
      aria-label={label}
      aria-multiline={canEdit ? true : undefined}
      aria-readonly={canEdit ? undefined : true}
      contentEditable={canEdit}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      spellCheck={canEdit}
      onFocus={canEdit ? onFocus : undefined}
      onBlur={canEdit ? onBlur : undefined}
      onInput={canEdit ? onInput : undefined}
      onKeyDown={canEdit ? onKeyDown : undefined}
      onKeyUp={canEdit ? onKeyUp : undefined}
      onMouseUp={canEdit ? onMouseUp : undefined}
      onPaste={canEdit ? onPaste : undefined}
      className="operating-note min-h-28 px-3 py-2 text-sm text-foreground outline-none"
    />
  )
})

function FormatButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("h-8 min-w-8 px-1.5", pressed && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  )
}

type Marks = {
  bold: boolean
  italic: boolean
  underline: boolean
  block: string
  bullets: boolean
  numbers: boolean
}

const EMPTY_MARKS: Marks = {
  bold: false,
  italic: false,
  underline: false,
  block: "",
  bullets: false,
  numbers: false,
}

function sameMarks(left: Marks, right: Marks): boolean {
  return (
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline &&
    left.block === right.block &&
    left.bullets === right.bullets &&
    left.numbers === right.numbers
  )
}

function commandState(command: string): boolean {
  try {
    return document.queryCommandState(command)
  } catch {
    return false
  }
}

function currentBlock(root: HTMLElement | null): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || !root) return ""
  let node: Node | null = selection.anchorNode
  if (!node || !root.contains(node)) return ""
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const tag = node.tagName
      if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "P" || tag === "DIV") return tag
    }
    node = node.parentNode
  }
  return "P"
}

function insideList(root: HTMLElement | null, tag: "UL" | "OL"): boolean {
  const selection = window.getSelection()
  if (!selection || !root) return false
  let node: Node | null = selection.anchorNode
  if (!node || !root.contains(node)) return false
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.tagName === tag) return true
    node = node.parentNode
  }
  return false
}
