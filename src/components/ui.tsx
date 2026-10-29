import { useEffect, useId, useRef, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { X } from "lucide-react"

import { cn } from "@/lib/cn"

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "outline" | "ghost" | "danger"
  size?: "md" | "sm" | "icon"
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors duration-fast",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:opacity-40",
        "[&_svg]:size-4",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-accent-soft",
        variant === "outline" && "border border-border bg-transparent hover:bg-bg-raised",
        variant === "ghost" && "text-muted-foreground hover:bg-bg-raised hover:text-foreground",
        variant === "danger" && "bg-destructive text-destructive-foreground hover:brightness-110",
        size === "md" && "h-9 px-3",
        size === "sm" && "h-8 px-2.5",
        size === "icon" && "size-8",
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-border bg-bg-raised px-3 text-sm text-foreground",
        "outline-none placeholder:text-fg-faint focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

export function Select({
  id,
  value,
  onChange,
  options,
  className,
  label,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  label?: string
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-9 rounded-md border border-border bg-bg-raised px-2 text-sm text-foreground",
        "outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: LucideIcon }[]
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-md border border-border bg-bg-raised p-0.5">
      {options.map((option) => {
        const Icon = option.icon
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
              selected && "bg-accent-wash text-foreground",
            )}
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="relative p-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </Button>
        <div className="pr-8">
          <h2 id={titleId} className="text-2xl leading-none">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function KpiCard({
  label,
  value,
  delta,
  compareLabel,
}: {
  label: string
  value: string
  delta?: number
  compareLabel?: string
}) {
  return (
    <article className="rounded-lg border border-border bg-card px-4 py-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl leading-none tabular-nums">{value}</p>
      {delta !== undefined ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Delta value={delta} />
          {compareLabel ? <span className="text-muted-foreground">vs {compareLabel}</span> : null}
        </p>
      ) : (
        <p className="mt-3 text-xs text-fg-faint">Live from the board</p>
      )}
    </article>
  )
}

export function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="font-mono text-muted-foreground tabular-nums">0.0%</span>
  const up = value > 0
  const body = Math.abs(value).toFixed(1)
  return (
    <span className={cn("font-mono tabular-nums", up ? "text-positive" : "text-negative")}>
      {up ? "▲" : "▼"} {up ? "+" : "−"}
      {body}%
    </span>
  )
}

export function BrandMark() {
  return (
    <span className="inline-grid size-9 place-items-center overflow-hidden rounded-sm bg-black">
      <img src={`${import.meta.env.BASE_URL}tlb-logo.svg`} alt="The Launch Box" className="size-full object-contain" />
    </span>
  )
}
