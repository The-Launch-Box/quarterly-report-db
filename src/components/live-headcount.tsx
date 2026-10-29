import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { BRAND_MARK, BRAND_SERIES, portcoId } from "@/data/brands"
import { formatNumber } from "@/data/format"
import { parseHeadcountCensus, type CensusSlice, type FirmCensus, type HeadcountCensus } from "@/data/headcount-census"

const SLICE_COLORS = ["#70ad47", "#e04b4b", "#ed7d31", "#5b9bd5", "#7f8c9b"] as const

export function LiveHeadcount({ companyId }: { companyId: string }) {
  const [census, setCensus] = useState<HeadcountCensus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchHeadcountCensus().then(
      (next) => {
        if (active) setCensus(next)
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "The headcount figures could not be loaded.")
      },
    )
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="space-y-4">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">BambooHR</p>
        <h2 className="text-2xl">2025 headcount</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Month-end headcount, and the mix of people who left during 2025. A person counts at month-end when they were
          hired on or before that day and had not left yet. Termination type comes from the BambooHR turnover table,
          which currently records Echelon. Length of service is calculated from hire and termination dates.
        </p>
      </header>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      {!error && !census ? <p className="text-sm text-muted-foreground">Loading BambooHR headcount.</p> : null}
      {census ? <CensusSection companyId={companyId} census={census} /> : null}
    </section>
  )
}

export function CensusSection({ companyId, census }: { companyId: string; census: HeadcountCensus }) {
  const firms = companyId === "all" ? census.firms : census.firms.filter((firm) => firm.id === companyId)
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{sourceLine(census)}</p>
      {firms.length === 0 ? (
        <p className="text-sm text-muted-foreground">BambooHR has no division mapped to this firm.</p>
      ) : (
        firms.map((firm) => <FirmCard key={firm.id} firm={firm} />)
      )}
    </div>
  )
}

function FirmCard({ firm }: { firm: FirmCensus }) {
  const months = firm.months.map((month) => `${month.label} ${month.headcount}`).join(", ")
  return (
    <article className="space-y-6 rounded-lg border border-border bg-card p-4">
      <h3 className="text-xl">{firm.name}</h3>
      <div>
        <h4 className="mb-2 text-base">Headcount by month</h4>
        <div className="h-[300px] w-full min-w-0" role="img" aria-label={`${firm.name} month-end headcount in 2025: ${months}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={firm.months} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                interval={0}
                stroke="var(--color-muted-foreground)"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                width={40}
                allowDecimals={false}
                stroke="var(--color-muted-foreground)"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickFormatter={(value: number) => formatNumber(value)}
              />
              <Tooltip content={<MonthTooltip />} />
              <Bar dataKey="headcount" name="Headcount" radius={[4, 4, 0, 0]} maxBarSize={42} animationDuration={180}>
                {firm.months.map((month, index) => (
                  <Cell key={month.label} fill={barColor(firm.id, index)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <MixDonut
          title="Termination Type"
          slices={firm.termination}
          empty="BambooHR’s turnover table has no 2025 termination type for this firm."
        />
        <MixDonut title="Length of Service" slices={firm.tenure} empty="No one with a hire date left in 2025." />
      </div>
    </article>
  )
}

function MixDonut({ title, slices, empty }: { title: string; slices: CensusSlice[]; empty: string }) {
  const colored = slices.map((slice, index) => ({ ...slice, color: SLICE_COLORS[index] ?? SLICE_COLORS[0] }))
  const [first, second] = centerLines(title)
  if (colored.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div
      className="flex flex-wrap items-center gap-4"
      role="img"
      aria-label={`${title}: ${colored.map((slice) => `${slice.label} ${slice.share}%`).join(", ")}`}
    >
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="96%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--color-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {colored.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-10 text-center text-sm leading-tight font-medium text-foreground">
          <span>
            {first}
            <br />
            {second}
          </span>
        </div>
      </div>
      <ul className="space-y-2">
        {colored.map((slice) => (
          <li key={slice.label} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
            <span>
              {slice.label} {slice.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MonthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number | string }>
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  const numeric = typeof payload[0]?.value === "number" ? payload[0].value : Number(payload[0]?.value)
  if (!Number.isFinite(numeric)) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 font-mono">
      {label !== undefined && label !== "" ? <div className="mb-1 text-[11px] text-muted-foreground">{String(label)}</div> : null}
      <div className="text-xs text-muted-foreground">
        Headcount: <span className="font-semibold text-foreground">{formatNumber(numeric)}</span>
      </div>
    </div>
  )
}

function SliceTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const numeric = typeof item?.value === "number" ? item.value : Number(item?.value)
  if (!item || !Number.isFinite(numeric)) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
      {item.name}: <span className="font-semibold text-foreground">{formatNumber(numeric)}</span>
    </div>
  )
}

function sourceLine(census: HeadcountCensus): string {
  const when = new Date(census.asOf)
  const stamped = Number.isNaN(when.getTime())
    ? census.asOf
    : when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
  if (census.source === "live") return `Live from BambooHR · ${stamped}`
  return `Saved BambooHR extract · ${stamped}`
}

function centerLines(title: string): [string, string] {
  const words = title.split(" ")
  const last = words.pop() ?? title
  return [words.join(" ") || title, last]
}

function barColor(firmId: string, index: number): string {
  const owner = portcoId(firmId)
  if (!owner) return SLICE_COLORS[index % SLICE_COLORS.length] ?? SLICE_COLORS[0]
  return BRAND_SERIES[owner][index % BRAND_SERIES[owner].length] ?? BRAND_MARK[owner]
}

async function fetchHeadcountCensus(): Promise<HeadcountCensus> {
  const { acquireIdToken } = await import("@/auth/msal")
  const token = await acquireIdToken()
  const response = await fetch("/api/headcount", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) {
    const message = await readError(response)
    throw new Error(message)
  }
  const body: unknown = await response.json()
  const census = parseHeadcountCensus(body)
  if (!census) throw new Error("The headcount figures could not be read.")
  return census
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" && body.message) {
      return body.message
    }
  } catch {
    /* use the fallback */
  }
  if (response.status === 401) return "Sign in again."
  return "The headcount figures could not be loaded."
}
