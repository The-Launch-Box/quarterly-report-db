import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { BarChart3, PieChart as PieIcon, ScatterChart as ScatterIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatColumnValue, isValueColumn } from "@/data/metrics"
import { firmTableMarks, tableColumns, trendSegment, trendValue, type FirmMark } from "@/data/firm-chart"
import { formatNumber, shortName } from "@/data/format"
import type { Board, BoardGroup, Column, ColumnKind } from "@/data/types"
import { Field, Segmented, Select } from "@/components/ui"

const SERIES_COLORS = [
  "var(--color-tlb-orange)",
  "var(--color-tlb-info)",
  "var(--color-tlb-warning)",
  "var(--color-tlb-orange-soft)",
  "var(--color-chart-4)",
  "var(--color-chart-3)",
] as const

type ChartKind = "bar" | "pie" | "scatter"

interface Axes {
  x: string
  y: string
  value: string
  bars: string[]
}

export function FirmChart({ board }: { board: Board }) {
  const [kind, setKind] = useState<ChartKind>("bar")
  const [picked, setPicked] = useState<string[]>(() => (board.groups[0] ? [board.groups[0].id] : []))
  const [savedAxes, setSavedAxes] = useState<Record<string, Axes>>({})
  const [trend, setTrend] = useState(false)

  const selected = board.groups.filter((group) => picked.includes(group.id))
  const tables = selected.length > 0 ? selected : board.groups.slice(0, 1)
  const alone = tables.length === 1

  function toggleTable(groupId: string) {
    setPicked((current) => {
      const present = current.filter((id) => board.groups.some((group) => group.id === id))
      const active = present.length > 0 ? present : tables.map((group) => group.id)
      if (active.includes(groupId)) {
        if (active.length === 1) return active
        return active.filter((id) => id !== groupId)
      }
      return [...active, groupId]
    })
  }

  function updateAxes(groupId: string, next: Axes) {
    setSavedAxes((current) => ({ ...current, [groupId]: next }))
  }

  return (
    <section className="rounded-lg border border-border bg-card px-5 py-5" aria-label="Graph">
      <h2 className="text-xl">{kind === "bar" ? "Bar" : kind === "pie" ? "Pie" : "Scatterplot"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{chartDescription(kind, alone, trend)}</p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Segmented
          label="Graph type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "bar", label: "Bar", icon: BarChart3 },
            { value: "pie", label: "Pie", icon: PieIcon },
            { value: "scatter", label: "Scatterplot", icon: ScatterIcon },
          ]}
        />
        {kind === "scatter" ? (
          <Segmented
            label="Trendline"
            value={trend ? "on" : "off"}
            onChange={(value) => setTrend(value === "on")}
            options={[
              { value: "off", label: "No trendline" },
              { value: "on", label: "Trendline" },
            ]}
          />
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <p className="basis-full text-[11px] uppercase tracking-widest text-muted-foreground">Tables</p>
        {board.groups.map((group) => {
          const checked = tables.some((item) => item.id === group.id)
          return (
            <label key={group.id} htmlFor={`chart-table-${group.id}`} className="inline-flex items-center gap-2 text-sm">
              <input
                id={`chart-table-${group.id}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={checked}
                onChange={() => toggleTable(group.id)}
              />
              {group.name}
            </label>
          )
        })}
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {tables.map((group) => {
          const columns = numericColumns(tableColumns(board, group))
          const axes = resolveAxes(columns, savedAxes[group.id])
          return (
            <TableAxes
              key={group.id}
              kind={kind}
              alone={alone}
              group={group}
              columns={columns}
              axes={axes}
              onChange={(next) => updateAxes(group.id, next)}
            />
          )
        })}
      </div>
      <div className="mt-4 h-[340px] w-full min-w-0">
        <FirmPlot board={board} tables={tables} kind={kind} savedAxes={savedAxes} trend={trend} />
      </div>
    </section>
  )
}

function FirmPlot({
  board,
  tables,
  kind,
  savedAxes,
  trend,
}: {
  board: Board
  tables: BoardGroup[]
  kind: ChartKind
  savedAxes: Record<string, Axes>
  trend: boolean
}) {
  const prepared = tables.map((group, index) => {
    const columns = tableColumns(board, group)
    const numeric = numericColumns(columns)
    const axes = resolveAxes(numeric, savedAxes[group.id])
    return {
      group,
      columns,
      numeric,
      axes,
      marks: firmTableMarks(group, columns),
      color: SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0],
    }
  })

  if (prepared.every((item) => item.numeric.length === 0)) {
    return <EmptyPlot message="Add a number, currency, or percent column to graph a table." />
  }
  if (kind === "bar") return <FirmBars alone={prepared.length === 1} prepared={prepared} />
  if (kind === "pie") return <FirmPie many={prepared.length > 1} prepared={prepared} />
  return <FirmScatter trend={trend} prepared={prepared} />
}

function FirmBars({
  alone,
  prepared,
}: {
  alone: boolean
  prepared: Prepared[]
}) {
  if (alone) {
    const table = prepared[0]
    if (!table) return <EmptyPlot message="Choose a table." />
    const series = table.numeric.filter((column) => table.axes.bars.includes(column.id))
    if (series.length === 0) return <EmptyPlot message="Choose at least one column." />
    const rows = table.marks.filter((mark) => series.some((column) => mark.values[column.id] !== null))
    if (rows.length === 0) return <EmptyPlot message="Enter numbers in the chosen columns." />
    const data = rows.map((mark) => {
      const point: Record<string, string | number> = { label: mark.label }
      for (const column of series) point[column.id] = mark.values[column.id] ?? 0
      return point
    })
    return (
      <BarFrame
        data={data}
        kind={series[0]?.kind ?? "number"}
        series={series.map((column, index) => ({
          key: column.id,
          name: column.name,
          fill: series.length === 1 ? (SERIES_COLORS[index] ?? SERIES_COLORS[0]) : (SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0]),
          column,
        }))}
      />
    )
  }

  const series = prepared.flatMap((item) => {
    const column = item.numeric.find((entry) => entry.id === item.axes.value)
    if (!column) return []
    return [{ id: item.group.id, name: item.group.name, column, marks: item.marks, color: item.color }]
  })
  if (series.length === 0) return <EmptyPlot message="Choose a column for each table." />
  const labels: string[] = []
  for (const item of series) {
    for (const mark of item.marks) {
      if (mark.values[item.column.id] === null) continue
      if (!labels.includes(mark.label)) labels.push(mark.label)
    }
  }
  if (labels.length === 0) return <EmptyPlot message="Enter numbers in the chosen columns." />
  const data = labels.map((label) => {
    const point: Record<string, string | number | null> = { label }
    for (const item of series) {
      const numbers = item.marks
        .filter((mark) => mark.label === label)
        .map((mark) => mark.values[item.column.id])
        .filter((value): value is number => value !== null)
      point[item.id] = numbers.length > 0 ? numbers.reduce((sum, value) => sum + value, 0) : null
    }
    return point
  })
  const kind = sharedKind(series.map((item) => item.column.kind))
  return (
    <BarFrame
      data={data}
      kind={kind}
      series={series.map((item) => ({ key: item.id, name: `${item.name} · ${item.column.name}`, fill: item.color, column: item.column }))}
    />
  )
}

function BarFrame({
  data,
  kind,
  series,
}: {
  data: Record<string, string | number | null>[]
  kind: ColumnKind
  series: { key: string; name: string; fill: string; column: Column }[]
}) {
  const tilt = data.some((row) => String(row.label).length > 14)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          interval={0}
          angle={tilt ? -28 : 0}
          textAnchor={tilt ? "end" : "middle"}
          height={tilt ? 72 : 32}
          tickFormatter={(value: string | number) => shortName(String(value))}
          stroke="var(--color-muted-foreground)"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
        />
        <YAxis
          width={72}
          stroke="var(--color-muted-foreground)"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => axisTick(kind, value)}
        />
        <Tooltip content={<ValueTooltip series={series} />} />
        {series.length > 1 ? <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{String(value)}</span>} /> : null}
        {series.map((item) => (
          <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.fill} radius={[4, 4, 0, 0]} maxBarSize={42} animationDuration={180} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function FirmPie({ many, prepared }: { many: boolean; prepared: Prepared[] }) {
  const slices = prepared.flatMap((item) => {
    const column = item.numeric.find((entry) => entry.id === item.axes.value)
    if (!column) return []
    return item.marks.flatMap((mark) => {
      const value = mark.values[column.id]
      if (typeof value !== "number" || value <= 0) return []
      const label = many ? `${item.group.name}: ${mark.label}` : mark.label
      return [{ key: `${item.group.id}-${mark.key}`, label, value, column }]
    })
  })
  if (slices.length === 0) {
    return <EmptyPlot message="No positive values to graph. Pie slices skip zero and negative numbers." />
  }
  const shown = slices.slice(0, 24)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={shown} dataKey="value" nameKey="label" stroke="var(--color-bg-surface)" animationDuration={180}>
          {shown.map((slice, index) => (
            <Cell key={slice.key} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={
            <ValueTooltip
              series={shown.map((slice) => ({ key: slice.label, name: slice.label, fill: "", column: slice.column }))}
            />
          }
        />
        <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{shortName(String(value))}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function FirmScatter({ trend, prepared }: { trend: boolean; prepared: Prepared[] }) {
  const frame = useRef<HTMLDivElement>(null)
  const [trendHover, setTrendHover] = useState<{ x: number; y: number; left: number; top: number } | null>(null)
  const clouds = prepared.flatMap((item) => {
    const xColumn = item.numeric.find((entry) => entry.id === item.axes.x)
    const yColumn = item.numeric.find((entry) => entry.id === item.axes.y)
    if (!xColumn || !yColumn) return []
    const points = item.marks.flatMap((mark) => {
      const x = mark.values[xColumn.id]
      const y = mark.values[yColumn.id]
      if (typeof x !== "number" || typeof y !== "number") return []
      return [{ key: mark.key, label: mark.label, x, y }]
    })
    return [{ name: item.group.name, color: item.color, xColumn, yColumn, points }]
  })
  const plotted = clouds.reduce((sum, cloud) => sum + cloud.points.length, 0)
  if (plotted === 0) return <EmptyPlot message="Scatter needs both values on each row." />
  const xKind = sharedKind(clouds.map((cloud) => cloud.xColumn.kind))
  const yKind = sharedKind(clouds.map((cloud) => cloud.yColumn.kind))
  const trendPoints = trend ? trendSegment(clouds.flatMap((cloud) => cloud.points)) : null

  function showTrend(t: number, clientX: number, clientY: number) {
    const node = frame.current
    if (!node || !trendPoints) return
    const bounds = node.getBoundingClientRect()
    const expected = trendValue(trendPoints, t)
    let left = clientX - bounds.left + 12
    let top = clientY - bounds.top + 12
    if (left > bounds.width - 196) left = clientX - bounds.left - 196
    if (top > bounds.height - 78) top = clientY - bounds.top - 78
    setTrendHover({ x: expected.x, y: expected.y, left: Math.max(8, left), top: Math.max(8, top) })
  }

  return (
    <div ref={frame} className="relative h-full w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          type="number"
          stroke="var(--color-muted-foreground)"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => axisTick(xKind, value)}
        />
        <YAxis
          dataKey="y"
          type="number"
          width={72}
          stroke="var(--color-muted-foreground)"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => axisTick(yKind, value)}
        />
        <Tooltip content={<ScatterTip clouds={clouds} />} />
        {clouds.length > 1 || trendPoints ? (
          <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{String(value)}</span>} />
        ) : null}
        {clouds.map((cloud) => (
          <Scatter key={cloud.name} name={cloud.name} data={cloud.points} fill={cloud.color} animationDuration={180} />
        ))}
        {trendPoints ? (
          <Scatter
            name="Trendline"
            data={trendPoints}
            line={(props: { points?: PixelPoint[] }) => (
              <TrendStroke points={props.points} onMove={showTrend} onLeave={() => setTrendHover(null)} />
            )}
            shape={HiddenDot}
            legendType="line"
            fill="var(--color-foreground)"
          />
        ) : null}
      </ScatterChart>
    </ResponsiveContainer>
    {trendHover ? (
      <div
        className="pointer-events-none absolute z-20 rounded-md border border-border bg-background px-3 py-2 font-mono"
        style={{ left: trendHover.left, top: trendHover.top }}
      >
        <div className="mb-1 text-[11px] text-muted-foreground">Trendline</div>
        <div className="text-xs text-muted-foreground">
          {axisName(clouds.map((cloud) => cloud.xColumn))}:{" "}
          <span className="font-semibold text-foreground">
            {formatShared(clouds.map((cloud) => cloud.xColumn), xKind, trendHover.x)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Expected {axisName(clouds.map((cloud) => cloud.yColumn))}:{" "}
          <span className="font-semibold text-foreground">
            {formatShared(clouds.map((cloud) => cloud.yColumn), yKind, trendHover.y)}
          </span>
        </div>
      </div>
    ) : null}
    </div>
  )
}

function TableAxes({
  kind,
  alone,
  group,
  columns,
  axes,
  onChange,
}: {
  kind: ChartKind
  alone: boolean
  group: BoardGroup
  columns: Column[]
  axes: Axes
  onChange: (axes: Axes) => void
}) {
  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">{group.name} has no numeric columns yet.</p>
  }
  return (
    <div className="flex flex-wrap items-end gap-4">
      {alone ? null : <p className="min-w-28 text-sm font-medium">{group.name}</p>}
      {kind === "bar" && alone ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {columns.map((column) => (
            <label key={column.id} htmlFor={`bar-${group.id}-${column.id}`} className="inline-flex items-center gap-2 text-sm">
              <input
                id={`bar-${group.id}-${column.id}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={axes.bars.includes(column.id)}
                onChange={(event) => onChange({ ...axes, bars: nextBars(columns, axes.bars, column, event.target.checked) })}
              />
              {column.name}
            </label>
          ))}
          <p className="basis-full text-xs text-muted-foreground">A bar graph uses one column type. The row title is the horizontal axis.</p>
        </div>
      ) : null}
      {kind === "bar" && !alone ? (
        <ColumnSelect
          id={`bar-value-${group.id}`}
          label="Value"
          columns={columns}
          value={axes.value}
          onChange={(value) => onChange({ ...axes, value })}
        />
      ) : null}
      {kind === "pie" ? (
        <ColumnSelect
          id={`pie-value-${group.id}`}
          label="Value"
          columns={columns}
          value={axes.value}
          onChange={(value) => onChange({ ...axes, value })}
        />
      ) : null}
      {kind === "scatter" ? (
        <>
          <ColumnSelect id={`scatter-x-${group.id}`} label="X axis" columns={columns} value={axes.x} onChange={(x) => onChange({ ...axes, x })} />
          <ColumnSelect id={`scatter-y-${group.id}`} label="Y axis" columns={columns} value={axes.y} onChange={(y) => onChange({ ...axes, y })} />
        </>
      ) : null}
    </div>
  )
}

function ColumnSelect({
  id,
  label,
  columns,
  value,
  onChange,
}: {
  id: string
  label: string
  columns: Column[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={onChange} options={columns.map((column) => ({ value: column.id, label: column.name }))} className="w-44" />
    </Field>
  )
}

function ValueTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; dataKey?: string | number }>
  label?: string | number
  series: { key: string; name: string; column: Column }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 font-mono">
      {label !== undefined && label !== "" ? <div className="mb-1 text-[11px] text-muted-foreground">{String(label)}</div> : null}
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? item.name ?? index)
        const match = series.find((entry) => entry.key === key || entry.name === item.name)
        const numeric = typeof item.value === "number" ? item.value : Number(item.value)
        if (!Number.isFinite(numeric)) return null
        return (
          <div key={`${key}-${index}`} className="text-xs text-muted-foreground">
            {item.name ? `${item.name}: ` : null}
            <span className="font-semibold text-foreground">{match ? formatColumnValue(match.column, numeric) : formatNumber(numeric)}</span>
          </div>
        )
      })}
    </div>
  )
}

function ScatterTip({
  active,
  payload,
  clouds,
}: {
  active?: boolean
  payload?: unknown
  clouds: { name: string; xColumn: Column; yColumn: Column; points: { key: string; label: string; x: number; y: number }[] }[]
}) {
  const point = readPoint(payload)
  if (!active || !point) return null
  const cloud = clouds.find((item) => item.points.some((entry) => entry.key === point.key)) ?? clouds[0]
  if (!cloud) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 font-mono">
      <div className="mb-1 text-[11px] text-muted-foreground">
        {clouds.length > 1 ? `${cloud.name} · ` : ""}
        {point.label}
      </div>
      <div className="text-xs text-muted-foreground">
        {cloud.xColumn.name}: <span className="font-semibold text-foreground">{formatColumnValue(cloud.xColumn, point.x)}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {cloud.yColumn.name}: <span className="font-semibold text-foreground">{formatColumnValue(cloud.yColumn, point.y)}</span>
      </div>
    </div>
  )
}

interface PixelPoint {
  x: number
  y: number
}

function TrendStroke({
  points,
  onMove,
  onLeave,
}: {
  points?: PixelPoint[]
  onMove: (t: number, clientX: number, clientY: number) => void
  onLeave: () => void
}) {
  const start = points?.[0]
  const end = points?.[1]
  if (!start || !end) return null
  const d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        strokeLinecap="round"
        style={{ cursor: "crosshair" }}
        onMouseMove={(event) => {
          const local = pointerInSvg(event)
          if (!local) return
          onMove(segmentT(local, start, end), event.clientX, event.clientY)
        }}
        onMouseLeave={onLeave}
      />
      <path d={d} fill="none" stroke="var(--color-foreground)" strokeWidth={2} pointerEvents="none" />
    </g>
  )
}

function pointerInSvg(event: ReactMouseEvent<SVGPathElement>): PixelPoint | null {
  const svg = event.currentTarget.ownerSVGElement
  const matrix = svg?.getScreenCTM()
  if (!svg || !matrix) return null
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const local = point.matrixTransform(matrix.inverse())
  return { x: local.x, y: local.y }
}

function segmentT(point: PixelPoint, start: PixelPoint, end: PixelPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = dx * dx + dy * dy
  if (length === 0) return 0
  return Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length))
}

function axisName(columns: Column[]): string {
  const first = columns[0]
  if (!first) return "Value"
  return columns.every((column) => column.name === first.name) ? first.name : "Value"
}

function formatShared(columns: Column[], kind: ColumnKind, value: number): string {
  const first = columns[0]
  if (first && columns.every((column) => column.kind === first.kind)) return formatColumnValue(first, value)
  return axisTick(kind, value)
}

function HiddenDot() {
  return <g />
}

function EmptyPlot({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">{message}</div>
}

interface Prepared {
  group: BoardGroup
  columns: Column[]
  numeric: Column[]
  axes: Axes
  marks: FirmMark[]
  color: string
}

function numericColumns(columns: Column[]): Column[] {
  return columns.filter(isValueColumn)
}

function resolveAxes(columns: Column[], saved: Axes | undefined): Axes {
  const ids = new Set(columns.map((column) => column.id))
  const first = columns[0]?.id ?? ""
  const second = columns[1]?.id ?? first
  const bars = (saved?.bars ?? [first]).filter((id) => ids.has(id))
  const kind = columns.find((column) => column.id === bars[0])?.kind
  const sameKind = kind ? bars.filter((id) => columns.find((column) => column.id === id)?.kind === kind) : []
  return {
    x: saved && ids.has(saved.x) ? saved.x : first,
    y: saved && ids.has(saved.y) ? saved.y : second,
    value: saved && ids.has(saved.value) ? saved.value : first,
    bars: sameKind.length > 0 ? sameKind : first ? [first] : [],
  }
}

function nextBars(columns: Column[], current: string[], column: Column, checked: boolean): string[] {
  if (!checked) return current.filter((id) => id !== column.id)
  const sameKind = current.filter((id) => columns.find((item) => item.id === id)?.kind === column.kind)
  return sameKind.includes(column.id) ? sameKind : [...sameKind, column.id]
}

function sharedKind(kinds: ColumnKind[]): ColumnKind {
  const first = kinds[0] ?? "number"
  return kinds.every((kind) => kind === first) ? first : "number"
}

function axisTick(kind: ColumnKind, value: number): string {
  if (!Number.isFinite(value)) return ""
  if (kind === "currency") {
    const sign = value < 0 ? "−" : ""
    const absolute = Math.abs(value)
    if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`
    if (absolute >= 1_000) return `${sign}$${Math.round(absolute / 1_000)}K`
    return `${sign}$${Math.round(absolute)}`
  }
  if (kind === "percent") return `${Math.round(value * 100)}%`
  return formatNumber(value)
}

function chartDescription(kind: ChartKind, alone: boolean, trend: boolean): string {
  if (kind === "pie") return "Each slice is a row. Zero and negative values are left out. Sub-rows are included."
  if (kind === "scatter") {
    const line = trend ? " A trendline runs through the points." : ""
    return alone
      ? `Each point is a row. Choose both axes from this table.${line}`
      : `Each point is a row. Choose both axes for each table.${line}`
  }
  return alone
    ? "Each bar is a row. The row title is the horizontal axis."
    : "Each series is a table. Rows with the same title line up."
}

function readPoint(payload: unknown): { key?: string; label?: string; x: number; y: number } | null {
  if (!Array.isArray(payload) || payload.length === 0) return null
  const first: unknown = payload[0]
  if (!isRecord(first)) return null
  const point: unknown = first.payload
  if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") return null
  return {
    key: typeof point.key === "string" ? point.key : undefined,
    label: typeof point.label === "string" ? point.label : undefined,
    x: point.x,
    y: point.y,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
