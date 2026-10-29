import { useState } from "react"
import { BarChart3, LineChart as LineChartIcon, PieChart as PieIcon, ScatterChart as ScatterIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { BRAND_MARK, BRAND_SERIES, portcoId } from "@/data/brands"
import { formatNumber, shortName } from "@/data/format"
import {
  defaultBarColumnIds,
  defaultChartGrain,
  defaultLineFilter,
  defaultPieColumnId,
  defaultScatterColumnIds,
  formatColumnValue,
  headcountMix,
  plotRows,
  profitMarginChart,
  uniqueLabels,
  valueColumns,
  type MixSlice,
  type PlotRow,
} from "@/data/metrics"
import type { Board, Column, ColumnKind } from "@/data/types"
import { Field, Segmented, Select } from "@/components/ui"

const SERIES_COLORS = [
  "var(--color-tlb-orange)",
  "var(--color-tlb-info)",
  "var(--color-tlb-warning)",
  "var(--color-tlb-orange-soft)",
  "var(--color-chart-4)",
  "var(--color-chart-3)",
] as const

type ChartType = "bar" | "pie" | "scatter" | "margins"
type Grain = "company" | "line"

export function BoardChart({ board, companyId }: { board: Board; companyId: string }) {
  const columns = valueColumns(board).filter((column) => column.scope !== "firm")
  const marginsAvailable = board.id === "ytd"
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [grain, setGrain] = useState<Grain>(() => defaultChartGrain(board))
  const [lineFilter, setLineFilter] = useState(() => defaultLineFilter(board))
  const [barSelection, setBarSelection] = useState<string[]>(() => defaultBarColumnIds(board))
  const [pieId, setPieId] = useState(() => defaultPieColumnId(board))
  const [axes, setAxes] = useState(() => {
    const [x, y] = defaultScatterColumnIds(board)
    return { x, y }
  })

  if (columns.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card px-5 py-6">
        <h2 className="text-xl">Graph</h2>
        <p className="mt-2 text-sm text-muted-foreground">Add a numeric column to plot this board.</p>
      </section>
    )
  }

  const labels = uniqueLabels(board)
  const lineRequired = grain === "company" && !board.aggregateRows
  const activeLine = lineRequired ? (labels.includes(lineFilter) ? lineFilter : labels[0] ?? "") : lineFilter && labels.includes(lineFilter) ? lineFilter : ""
  const known = new Set(columns.map((column) => column.id))
  const barIds = barSelection.filter((id) => known.has(id))
  const activePie = known.has(pieId) ? pieId : columns[0]?.id ?? ""
  const xId = known.has(axes.x) ? axes.x : columns[0]?.id ?? ""
  const yId = known.has(axes.y) ? axes.y : columns[1]?.id ?? columns[0]?.id ?? ""
  const allPlots = plotRows(board, companyId, grain, activeLine)
  const plots = allPlots.slice(0, 40)
  const hidden = allPlots.length - plots.length
  const headcountPies = chartType === "pie" && board.id === "headcount"

  return (
    <section className="rounded-lg border border-border bg-card px-5 py-5" aria-label="Graph">
      <h2 className="text-xl">{chartTitle(chartType)}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {chartDescription(chartType, grain, board.aggregateRows, activeLine, companyId, board.id)}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Segmented
          label="Graph type"
          value={chartType}
          onChange={setChartType}
          options={[
            { value: "bar", label: "Bar", icon: BarChart3 },
            { value: "pie", label: "Pie", icon: PieIcon },
            { value: "scatter", label: "Scatterplot", icon: ScatterIcon },
            ...(marginsAvailable ? [{ value: "margins" as const, label: "Profit margins", icon: LineChartIcon }] : []),
          ]}
        />
        {headcountPies || chartType === "margins" ? null : (
        <Field label="Rows" htmlFor="chart-grain">
          <Select
            id="chart-grain"
            value={grain}
            onChange={(value) => setGrain(value === "line" ? "line" : "company")}
            options={[
              { value: "company", label: "Firms" },
              { value: "line", label: "Line items" },
            ]}
            className="w-40"
          />
        </Field>
        )}
        {headcountPies || chartType === "margins" ? null : lineRequired || grain === "line" ? (
          <Field label="Line" htmlFor="chart-line">
            <Select
              id="chart-line"
              value={lineRequired ? activeLine : activeLine || "all"}
              onChange={(value) => setLineFilter(value === "all" ? "" : value)}
              options={[
                ...(lineRequired ? [] : [{ value: "all", label: "All lines" }]),
                ...labels.map((label) => ({ value: label, label })),
              ]}
              className="w-44"
            />
          </Field>
        ) : null}
        {headcountPies || chartType !== "pie" ? null : (
          <ColumnSelect id="chart-pie" label="Value" columns={columns} value={activePie} onChange={setPieId} />
        )}
        {chartType === "scatter" ? (
          <>
            <ColumnSelect id="chart-x" label="X axis" columns={columns} value={xId} onChange={(id) => setAxes((current) => ({ ...current, x: id }))} />
            <ColumnSelect id="chart-y" label="Y axis" columns={columns} value={yId} onChange={(id) => setAxes((current) => ({ ...current, y: id }))} />
          </>
        ) : null}
      </div>
      {chartType === "bar" ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {columns.map((column) => (
            <label key={column.id} htmlFor={`series-${column.id}`} className="inline-flex items-center gap-2 text-sm">
              <input
                id={`series-${column.id}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={barIds.includes(column.id)}
                onChange={(event) => {
                  const checked = event.target.checked
                  setBarSelection((current) => {
                    const present = current.filter((id) => known.has(id))
                    if (!checked) return present.filter((id) => id !== column.id)
                    const sameKind = present.filter((id) => columns.find((item) => item.id === id)?.kind === column.kind)
                    return sameKind.includes(column.id) ? sameKind : [...sameKind, column.id]
                  })
                }}
              />
              {column.name}
            </label>
          ))}
          <p className="basis-full text-xs text-muted-foreground">A bar graph uses one column type.</p>
        </div>
      ) : null}
      <div className={headcountPies ? "mt-4 w-full min-w-0" : "mt-4 h-[340px] w-full min-w-0"}>
        {chartType === "bar" ? (
          <BarView companyId={companyId} plots={plots} columns={columns} barIds={barIds} />
        ) : headcountPies ? (
          <HeadcountMixView board={board} companyId={companyId} />
        ) : chartType === "pie" ? (
          <PieView companyId={companyId} plots={plots} column={columns.find((column) => column.id === activePie)} />
        ) : chartType === "margins" ? (
          <MarginView board={board} companyId={companyId} />
        ) : (
          <ScatterView
            companyId={companyId}
            plots={plots}
            xColumn={columns.find((column) => column.id === xId)}
            yColumn={columns.find((column) => column.id === yId)}
          />
        )}
      </div>
      {!headcountPies && chartType !== "margins" && hidden > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Showing 40 marks. {hidden} more are hidden.</p>
      ) : null}
    </section>
  )
}

function BarView({
  companyId,
  plots,
  columns,
  barIds,
}: {
  companyId: string
  plots: PlotRow[]
  columns: Column[]
  barIds: string[]
}) {
  const series = columns.filter((column) => barIds.includes(column.id))
  if (series.length === 0) return <EmptyPlot message="Choose at least one column." />
  const data = plots.map((row) => {
    const point: { label: string; key: string; groupId: string; [key: string]: string | number } = {
      label: row.label,
      key: row.key,
      groupId: row.groupId,
    }
    for (const column of series) point[column.id] = row.values[column.id] ?? 0
    return point
  })
  const tilt = data.some((row) => row.label.length > 14)
  const kind = series[0]?.kind ?? "number"

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
        <Tooltip content={<SeriesTooltip columns={columns} />} />
        {series.length > 1 ? <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{String(value)}</span>} /> : null}
        {series.map((column, index) => (
          <Bar
            key={column.id}
            dataKey={column.id}
            name={column.name}
            fill={seriesColor(column, index, companyId)}
            radius={[4, 4, 0, 0]}
            maxBarSize={42}
            animationDuration={180}
          >
            {series.length === 1
              ? data.map((entry, entryIndex) => (
                  <Cell key={`${entry.key}-${entryIndex}`} fill={markColor(entry.groupId, entryIndex, companyId)} />
                ))
              : null}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function HeadcountMixView({ board, companyId }: { board: Board; companyId: string }) {
  const mix = headcountMix(board, companyId)
  if (!mix) {
    return (
      <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
        This firm has no termination or tenure mix.
      </div>
    )
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <MixDonut title="Termination Type" slices={mix.termination} />
      <MixDonut title="Length of Service" slices={mix.tenure} />
    </div>
  )
}

function MixDonut({ title, slices }: { title: string; slices: MixSlice[] }) {
  const [first, second] = centerLines(title)
  if (slices.length === 0) {
    return <p className="text-sm text-muted-foreground">{title} has no figures yet.</p>
  }
  return (
    <div
      className="flex flex-wrap items-center gap-4"
      role="img"
      aria-label={`${title}: ${slices.map((slice) => `${slice.label} ${slice.value}%`).join(", ")}`}
    >
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="96%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--color-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.id} fill={slice.color} />
              ))}
            </Pie>
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
        {slices.map((slice) => (
          <li key={slice.id} className="flex items-start gap-2 text-sm text-foreground">
            <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: slice.color }} />
            <span>
              {slice.label} {slice.value}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function centerLines(title: string): [string, string] {
  const words = title.split(" ")
  const last = words.pop() ?? title
  return [words.join(" ") || title, last]
}

function PieView({ companyId, plots, column }: { companyId: string; plots: PlotRow[]; column: Column | undefined }) {
  if (!column) return <EmptyPlot message="Choose a column." />
  const slices = plots.flatMap((row, index) => {
    const value = row.values[column.id]
    if (value === undefined || value === null || value <= 0) return []
    return [{ key: row.key, label: shortName(row.label), full: row.label, value, fill: markColor(row.groupId, index, companyId) }]
  })
  if (slices.length === 0) {
    return <EmptyPlot message="No positive values to graph. Pie slices skip zero and negative numbers." />
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={slices} dataKey="value" nameKey="label" stroke="var(--color-bg-surface)" animationDuration={180}>
          {slices.map((slice) => (
            <Cell key={slice.key} fill={slice.fill} />
          ))}
        </Pie>
        <Tooltip content={<SeriesTooltip columns={[column]} valueColumn={column} />} />
        <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{String(value)}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function MarginView({ board, companyId }: { board: Board; companyId: string }) {
  const chart = profitMarginChart(board, companyId)
  if (!chart || chart.points.every((point) => point.gross === null && point.net === null)) {
    return <EmptyPlot message="Profit margins need revenue and gross profit." />
  }
  const portco = companyId === "all" ? null : portcoId(companyId)
  const grossColor = portco ? BRAND_SERIES[portco][0] : "var(--color-tlb-info)"
  const netColor = portco ? (BRAND_SERIES[portco][1] ?? BRAND_MARK[portco]) : "var(--color-primary)"
  const tilt = chart.points.some((point) => point.label.length > 12)
  const columns: Column[] = [
    { id: "gross", name: "Gross margin", kind: "percent" },
    { id: "net", name: chart.netLabel, kind: "percent" },
  ]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chart.points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
          width={56}
          stroke="var(--color-muted-foreground)"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => axisTick("percent", value)}
        />
        <Tooltip content={<SeriesTooltip columns={columns} />} />
        <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{String(value)}</span>} />
        <Line
          type="monotone"
          dataKey="gross"
          name="Gross margin"
          stroke={grossColor}
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
          animationDuration={180}
        />
        <Line
          type="monotone"
          dataKey="net"
          name={chart.netLabel}
          stroke={netColor}
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls={false}
          animationDuration={180}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function ScatterView({
  companyId,
  plots,
  xColumn,
  yColumn,
}: {
  companyId: string
  plots: PlotRow[]
  xColumn: Column | undefined
  yColumn: Column | undefined
}) {
  if (!xColumn || !yColumn) return <EmptyPlot message="Pick two numeric columns." />
  const points = plots.flatMap((row, index) => {
    const x = row.values[xColumn.id]
    const y = row.values[yColumn.id]
    if (x === undefined || y === undefined || x === null || y === null) return []
    return [{ label: row.label, x, y, fill: markColor(row.groupId, index, companyId) }]
  })
  if (points.length === 0) return <EmptyPlot message="Scatter needs both values on each row." />

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="x"
          type="number"
          name={xColumn.name}
          stroke="var(--color-muted-foreground)"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => axisTick(xColumn.kind, value)}
        />
        <YAxis
          dataKey="y"
          type="number"
          name={yColumn.name}
          width={72}
          stroke="var(--color-muted-foreground)"
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          tickFormatter={(value: number) => axisTick(yColumn.kind, value)}
        />
        <Tooltip content={<ScatterTooltip xColumn={xColumn} yColumn={yColumn} />} />
        <Scatter data={points} shape={ScatterDot} fill="var(--color-primary)" animationDuration={180} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

function ScatterDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: { fill?: string } }) {
  if (cx === undefined || cy === undefined) return <g />
  return <circle cx={cx} cy={cy} r={6} fill={payload?.fill ?? "var(--color-primary)"} />
}

function SeriesTooltip({
  active,
  payload,
  label,
  columns,
  valueColumn,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; dataKey?: string | number }>
  label?: string | number
  columns: Column[]
  valueColumn?: Column
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 font-mono">
      {label !== undefined && label !== "" ? <div className="mb-1 text-[11px] text-muted-foreground">{String(label)}</div> : null}
      {payload.map((item, index) => {
        const key = String(item.dataKey ?? index)
        const column = columns.find((entry) => entry.id === key) ?? valueColumn
        const numeric = typeof item.value === "number" ? item.value : Number(item.value)
        if (!Number.isFinite(numeric)) return null
        return (
          <div key={`${key}-${index}`} className="text-xs text-muted-foreground">
            {item.name ? `${item.name}: ` : null}
            <span className="font-semibold text-foreground">
              {column && Number.isFinite(numeric) ? formatColumnValue(column, numeric) : Number.isFinite(numeric) ? formatNumber(numeric) : ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ScatterTooltip({
  active,
  payload,
  xColumn,
  yColumn,
}: {
  active?: boolean
  payload?: unknown
  xColumn: Column
  yColumn: Column
}) {
  const point = readPoint(payload)
  if (!active || !point) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 font-mono">
      {point.label ? <div className="mb-1 text-[11px] text-muted-foreground">{point.label}</div> : null}
      <div className="text-xs text-muted-foreground">
        {xColumn.name}: <span className="font-semibold text-foreground">{point.x === undefined ? "" : formatColumnValue(xColumn, point.x)}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {yColumn.name}: <span className="font-semibold text-foreground">{point.y === undefined ? "" : formatColumnValue(yColumn, point.y)}</span>
      </div>
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
      <Select
        id={id}
        value={value}
        onChange={onChange}
        options={columns.map((column) => ({ value: column.id, label: column.name }))}
        className="w-44"
      />
    </Field>
  )
}

function EmptyPlot({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">{message}</div>
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

function chartTitle(chartType: ChartType): string {
  if (chartType === "bar") return "Bar"
  if (chartType === "pie") return "Pie"
  if (chartType === "margins") return "Profit margins"
  return "Scatterplot"
}

function chartDescription(
  chartType: ChartType,
  grain: Grain,
  aggregateRows: boolean,
  line: string,
  companyId: string,
  boardId: string,
): string {
  if (chartType === "margins") {
    return companyId === "all"
      ? "Year-to-date gross margin and profit margin for each firm."
      : "Gross margin and profit margin for each quarter."
  }
  if (chartType === "pie" && boardId === "headcount") {
    return companyId === "all"
      ? "Improv termination type and length of service, from those rows in the table."
      : "Termination type and length of service, from those rows in the table."
  }
  if (chartType === "pie") return "Share of the selected column. Zero and negative values are omitted."
  if (grain === "company" && aggregateRows) return "Each mark is a firm total. The graph updates when a cell commits."
  if (grain === "company") return `Each mark is ${line || "the selected line"} by firm. The graph updates when a cell commits.`
  return "Each mark is a line item. The graph updates when a cell commits."
}

function seriesColor(column: Column, index: number, companyId: string): string {
  const portco = companyId === "all" ? null : portcoId(companyId)
  if (portco) return BRAND_SERIES[portco][index % BRAND_SERIES[portco].length] ?? BRAND_MARK[portco]
  if (column.emphasis || column.id === "q4") return "var(--color-primary)"
  const palette = SERIES_COLORS.filter((color) => color !== "var(--color-tlb-orange)")
  return palette[index % palette.length] ?? SERIES_COLORS[0]
}

function markColor(groupId: string, index: number, companyId: string): string {
  const owner = portcoId(groupId) ?? (companyId === "all" ? null : portcoId(companyId))
  if (!owner) return SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0]
  if (companyId === "all") return BRAND_MARK[owner]
  return BRAND_SERIES[owner][index % BRAND_SERIES[owner].length] ?? BRAND_MARK[owner]
}

function readPoint(payload: unknown): { label?: string; x?: number; y?: number } | null {
  if (!Array.isArray(payload) || payload.length === 0) return null
  const first: unknown = payload[0]
  if (!isRecord(first)) return null
  const point: unknown = first.payload
  if (!isRecord(point)) return null
  return {
    label: typeof point.label === "string" ? point.label : undefined,
    x: typeof point.x === "number" ? point.x : undefined,
    y: typeof point.y === "number" ? point.y : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
