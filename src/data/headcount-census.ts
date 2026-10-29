/** Portfolio firms, in board order, matched to the BambooHR division name. */
export const CENSUS_FIRMS = [
  { id: "echelon", name: "Echelon Risk + Cyber", division: "Echelon" },
  { id: "improv", name: "Improv", division: "Improvizations" },
  { id: "hyperscayle", name: "Hyperscayle", division: "Hyperscayle" },
  { id: "vescape", name: "VEscape", division: "VEscape Labs" },
  { id: "bluetrail", name: "Blue Trail Digital", division: "Blue Trail Digital" },
  { id: "dxfoundation", name: "DX Foundation", division: "DX Foundation" },
] as const

export const CENSUS_YEAR = 2025

/** Last day of each month in the census year. February 2025 has 28 days. */
export const MONTH_ENDS = [
  "2025-01-31",
  "2025-02-28",
  "2025-03-31",
  "2025-04-30",
  "2025-05-31",
  "2025-06-30",
  "2025-07-31",
  "2025-08-31",
  "2025-09-30",
  "2025-10-31",
  "2025-11-30",
  "2025-12-31",
] as const

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

/** Deck order. Involuntary is the termination type itself, so it wins over a regrettable flag. */
export const TERMINATION_LABELS = [
  "Involuntary Termination",
  "Voluntary Unspecified",
  "Non-Regrettable",
  "Regrettable",
  "Unclassified",
] as const

/** Deck order, plus the people who had already worked three years. */
export const TENURE_LABELS = ["1-3 years", "6 months - 1 year", "< 6 months", "3+ years"] as const

export interface CensusSlice {
  label: string
  count: number
  share: number
}

export interface FirmCensus {
  id: string
  name: string
  months: { label: string; headcount: number }[]
  termination: CensusSlice[]
  tenure: CensusSlice[]
}

export interface HeadcountCensus {
  year: number
  asOf: string
  source: "live" | "snapshot"
  firms: FirmCensus[]
}

export interface MonthCount {
  division: string
  month: string
  headcount: number
}

export interface TenureCount {
  division: string
  label: string
  count: number
}

export interface TurnoverCount {
  division: string
  termType: string | null
  regrettable: string | null
  count: number
}

export function terminationLabel(termType: string | null, regrettable: string | null): string {
  const type = (termType ?? "").trim()
  const regret = (regrettable ?? "").trim()
  if (/involuntary/i.test(type) || /^termination\b/i.test(type)) return "Involuntary Termination"
  if (/non-?regrettable/i.test(regret)) return "Non-Regrettable"
  if (/^regrettable$/i.test(regret)) return "Regrettable"
  if (/resignation/i.test(type) || /voluntary/i.test(type)) return "Voluntary Unspecified"
  return "Unclassified"
}

export function buildCensus(
  input: {
    months: readonly MonthCount[]
    tenure: readonly TenureCount[]
    turnover: readonly TurnoverCount[]
  },
  asOf: string,
  source: HeadcountCensus["source"],
): HeadcountCensus {
  return {
    year: CENSUS_YEAR,
    asOf,
    source,
    firms: CENSUS_FIRMS.map((firm) => ({
      id: firm.id,
      name: firm.name,
      months: MONTH_ENDS.map((monthEnd, index) => ({
        label: MONTH_LABELS[index] ?? monthEnd,
        headcount: countFor(input.months, firm.division, monthEnd.slice(0, 7)),
      })),
      termination: slices(
        TERMINATION_LABELS,
        countsByLabel(
          input.turnover
            .filter((row) => row.division === firm.division)
            .map((row) => ({ label: terminationLabel(row.termType, row.regrettable), count: row.count })),
        ),
      ),
      tenure: slices(
        TENURE_LABELS,
        countsByLabel(input.tenure.filter((row) => row.division === firm.division)),
      ),
    })),
  }
}

export function parseHeadcountCensus(value: unknown): HeadcountCensus | null {
  if (!isRecord(value) || value.year !== CENSUS_YEAR) return null
  if (value.source !== "live" && value.source !== "snapshot") return null
  if (typeof value.asOf !== "string" || !value.asOf) return null
  if (!Array.isArray(value.firms)) return null
  const firms: FirmCensus[] = []
  for (const entry of value.firms) {
    const firm = parseFirm(entry)
    if (!firm) return null
    firms.push(firm)
  }
  return { year: CENSUS_YEAR, asOf: value.asOf, source: value.source, firms }
}

function parseFirm(value: unknown): FirmCensus | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null
  if (!Array.isArray(value.months) || value.months.length !== MONTH_LABELS.length) return null
  const months: { label: string; headcount: number }[] = []
  for (let index = 0; index < value.months.length; index += 1) {
    const month = value.months[index]
    if (!isRecord(month) || month.label !== MONTH_LABELS[index] || !isWhole(month.headcount)) return null
    months.push({ label: MONTH_LABELS[index] ?? "", headcount: month.headcount })
  }
  const termination = parseSlices(value.termination)
  const tenure = parseSlices(value.tenure)
  if (!termination || !tenure) return null
  return { id: value.id, name: value.name, months, termination, tenure }
}

function parseSlices(value: unknown): CensusSlice[] | null {
  if (!Array.isArray(value)) return null
  const slices: CensusSlice[] = []
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.label !== "string" || !entry.label) return null
    if (!isWhole(entry.count) || entry.count <= 0 || !isWhole(entry.share) || entry.share <= 0) return null
    slices.push({ label: entry.label, count: entry.count, share: entry.share })
  }
  return slices
}

function countFor(rows: readonly MonthCount[], division: string, month: string): number {
  const found = rows.find((row) => row.division === division && row.month === month)
  return found ? whole(found.headcount) : 0
}

function countsByLabel(rows: readonly { label: string; count: number }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.label, (counts.get(row.label) ?? 0) + whole(row.count))
  return counts
}

/** Largest-remainder percents so the slices of one pie add to 100. */
function slices(order: readonly string[], counts: Map<string, number>): CensusSlice[] {
  const rows = order.flatMap((label) => {
    const count = counts.get(label) ?? 0
    return count > 0 ? [{ label, count }] : []
  })
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  if (total === 0) return []
  const parts = rows.map((row) => {
    const raw = (row.count / total) * 100
    return { ...row, share: Math.floor(raw), remainder: raw - Math.floor(raw) }
  })
  let left = 100 - parts.reduce((sum, row) => sum + row.share, 0)
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || b.count - a.count)
  for (const row of byRemainder) {
    if (left <= 0) break
    row.share += 1
    left -= 1
  }
  return parts.map((row) => ({ label: row.label, count: row.count, share: row.share }))
}

function whole(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

function isWhole(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
