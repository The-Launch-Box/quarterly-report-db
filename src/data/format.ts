export function parseNumber(raw: string): number | null {
  let source = raw.trim().replace(/[$,\s]/g, "").replace("−", "-")
  if (!source) return null

  let multiplier = 1
  const suffix = source.slice(-1).toLowerCase()
  if (suffix === "m") {
    multiplier = 1_000_000
    source = source.slice(0, -1)
  } else if (suffix === "k") {
    multiplier = 1_000
    source = source.slice(0, -1)
  }
  if (source.endsWith("%")) source = source.slice(0, -1)
  if (!source || source === "-" || source === "." || source === "-.") return null

  const value = Number(source)
  if (!Number.isFinite(value)) return null
  return value * multiplier
}

/** Stores a ratio. 86 and 86% become 0.86. 0.86 stays 0.86. */
export function parsePercentInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = parseNumber(trimmed)
  if (value === null) return null
  if (trimmed.includes("%") || Math.abs(value) > 1) return value / 100
  return value
}

export function formatNumber(value: number, digits = 0): string {
  const body = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value))
  return value < 0 ? `−${body}` : body
}

export function formatCurrency(value: number): string {
  const body = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value))
  return value < 0 ? `−${body}` : body
}

export function formatCompactCurrency(value: number): string {
  const sign = value < 0 ? "−" : ""
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`
  if (absolute >= 10_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`
  return formatCurrency(value)
}

export function formatPercent(value: number, digits = 1): string {
  const points = value * 100
  const sign = points < 0 ? "−" : ""
  return `${sign}${Math.abs(points).toFixed(digits)}%`
}

export function shortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 18) return trimmed
  const head = trimmed.split("+")[0]?.trim() ?? trimmed
  if (head.length > 0 && head.length <= 18) return head
  return `${trimmed.slice(0, 16)}…`
}
