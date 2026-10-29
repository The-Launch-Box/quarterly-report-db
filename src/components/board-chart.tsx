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
  chartTables,
  defaultBarColumnIds,
  defaultChartGrain,
  defaultLineFilter,
  defaultPieColumnId,
  defaultScatterColumnIds,
  formatColumnValue,
  isValueColumn,
  MAIN_CHART_TABLE_ID,
  plotTable,
  profitMarginChart,
  tableAggregates,
  tableLabels,
  type ChartTable,
  type PlotRow,
} from "@/data/metrics"
import { STATEMENT_TABLE_ID } from "@/data/ytd-tables"
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

interface MetricChoice {
  bars: string[]
  pie: string
  x: string
  y: string
}

const PIE_COLORS = ["#70ad47", "#e04b4b", "#ed7d31", "#5b9bd5"] as const

export function BoardChart({ board, companyId }: { board: Board; companyId: string }) {
  const tables = chartTables(board)
  const marginsAvailable = board.id === "ytd"
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [grain, setGrain] = useState<Grain>(() => defaultChartGrain(board))
  const [lineFilter, setLineFilter] = useState(() => defaultLineFilter(board))
  const [picked, setPicked] = useState<string[]>(() => (tables[0] ? [tables[0].id] : []))
  const [choices, setChoices] = useState<Record<string, MetricChoice>>({})

  const plottable = tables.filter((table) => table.columns.some((column) => isValueColumn(column) && column.scope !== "firm"))
  if (plottable.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card px-5 py-6">
        <h2 className="text-xl">Graph</h2>
        <p className="mt-2 text-sm text-muted-foreground">Add a numeric column to plot this board.</p>
      </section>
    )
  }

  const selected = plottable.filter((table) => picked.includes(table.id))
  const shown = selected.length > 0 ? selected : plottable.slice(0, 1)
  const labels = [...new Set(shown.flatMap((table) => tableLabels(board, table.id)))]
  const lineRequired = grain === "company" && shown.some((table) => !tableAggregates(board, table.id))
  const sharedLine = labels.includes(lineFilter) ? lineFilter : ""

  function toggleTable(tableId: string) {
    const present = picked.filter((id) => plottable.some((table) => table.id === id))
    const active = present.length > 0 ? present : shown.map((table) => table.id)
    const next = active.includes(tableId) ? active.filter((id) => id !== tableId) : [...active, tableId]
    if (next.length === 0) return
    setPicked(next)
    const nextTables = plottable.filter((table) => next.includes(table.id))
    if (nextTables.every((table) => !tableAggregates(board, table.id))) setGrain("line")
  }

  function choiceFor(table: ChartTable): MetricChoice {
    return resolveChoice(board, table, choices[table.id])
  }

  function updateChoice(tableId: string, next: MetricChoice) {
    setChoices((current) => ({ ...current, [tableId]: next }))
  }

  return (
    <section className="rounded-lg border border-border bg-card px-5 py-5" aria-label="Graph">
      <h2 className="text-xl">{chartTitle(chartType)}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{chartDescription(chartType, grain, shown.length > 1)}</p>
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
        {chartType === "margins" ? null : (
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
        {chartType === "margins" || (!lineRequired && grain !== "line") ? null : (
          <Field label="Line" htmlFor="chart-line">
            <Select
              id="chart-line"
              value={lineRequired ? sharedLine || labels[0] || "" : sharedLine || "all"}
              onChange={(value) => setLineFilter(value === "all" ? "" : value)}
              options={[
                ...(lineRequired ? [] : [{ value: "all", label: "All lines" }]),
                ...labels.map((label) => ({ value: label, label })),
              ]}
              className="w-44"
            />
          </Field>
        )}
      </div>
      {chartType === "margins" ? null : (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          <p className="basis-full text-[11px] uppercase tracking-widest text-muted-foreground">Tables</p>
          {plottable.map((table) => (
            <label key={table.id} htmlFor={`chart-table-${table.id}`} className="inline-flex items-center gap-2 text-sm">
              <input
                id={`chart-table-${table.id}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={shown.some((item) => item.id === table.id)}
                onChange={() => toggleTable(table.id)}
              />
              {table.title}
            </label>
          ))}
        </div>
      )}
      {chartType === "margins" ? null : (
        <div className="mt-4 flex flex-col gap-4">
          {shown.map((table) => {
            const columns = metricColumns(table)
            const choice = choiceFor(table)
            return (
              <TableMetrics
                key={table.id}
                table={table}
                columns={columns}
                choice={choice}
                chartType={chartType}
                named={shown.length > 1}
                onChange={(next) => updateChoice(table.id, next)}
              />
            )
          })}
        </div>
      )}
      {chartType === "margins" ? (
        <div className="mt-4 h-[340px] w-full min-w-0">
          <MarginView board={board} companyId={companyId} />
        </div>
      ) : (
        <div className={chartType === "pie" ? "mt-4 grid gap-6 md:grid-cols-2" : "mt-4 flex flex-col gap-6"}>
          {shown.map((table) => {
            const columns = metricColumns(table)
            const choice = choiceFor(table)
            const line = lineFor(board, table, grain, lineFilter)
            const allPlots = plotTable(board, table, companyId, grain, line)
            const plots = allPlots.slice(0, 40)
            const hidden = allPlots.length - plots.length
            return (
              <div key={table.id} className={chartType === "pie" ? "min-w-0" : "min-w-0"}>
                {chartType === "pie" ? null : shown.length > 1 ? <h3 className="mb-2 text-base">{table.title}</h3> : null}
                <div className={chartType === "pie" ? "min-w-0" : "h-[340px] w-full min-w-0"}>
                  {chartType === "bar" ? (
                    <BarView companyId={companyId} plots={plots} columns={columns} barIds={choice.bars} />
                  ) : chartType === "pie" ? (
                    <TableDonut
                      title={table.title}
                      plots={plots}
                      column={columns.find((column) => column.id === choice.pie)}
                      companyId={companyId}
                      grain={grain}
                    />
                  ) : (
                    <ScatterView
                      companyId={companyId}
                      plots={plots}
                      xColumn={columns.find((column) => column.id === choice.x)}
                      yColumn={columns.find((column) => column.id === choice.y)}
                    />
                  )}
                </div>
                {hidden > 0 ? <p className="mt-2 text-xs text-muted-foreground">Showing 40 marks. {hidden} more are hidden.</p> : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function TableMetrics({
  table,
  columns,
  choice,
  chartType,
  named,
  onChange,
}: {
  table: ChartTable
  columns: Column[]
  choice: MetricChoice
  chartType: ChartType
  named: boolean
  onChange: (choice: MetricChoice) => void
}) {
  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">{table.title} has no numeric columns yet.</p>
  }
  return (
    <div className="flex flex-wrap items-end gap-4">
      {named ? <p className="min-w-28 text-sm font-medium">{table.title}</p> : null}
      {chartType === "bar" ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <p className="basis-full text-[11px] uppercase tracking-widest text-muted-foreground">Metrics</p>
          {columns.map((column) => (
            <label key={column.id} htmlFor={`series-${table.id}-${column.id}`} className="inline-flex items-center gap-2 text-sm">
              <input
                id={`series-${table.id}-${column.id}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={choice.bars.includes(column.id)}
                onChange={(event) => onChange({ ...choice, bars: nextBars(columns, choice.bars, column, event.target.checked) })}
              />
              {column.name}
            </label>
          ))}
          <p className="basis-full text-xs text-muted-foreground">A bar graph uses one column type.</p>
        </div>
      ) : null}
      {chartType === "pie" ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <p className="basis-full text-[11px] uppercase tracking-widest text-muted-foreground">Metric</p>
          {columns.map((column) => (
            <label key={column.id} htmlFor={`pie-${table.id}-${column.id}`} className="inline-flex items-center gap-2 text-sm">
              <input
                id={`pie-${table.id}-${column.id}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={choice.pie === column.id}
                onChange={() => onChange({ ...choice, pie: column.id })}
              />
              {column.name}
            </label>
          ))}
        </div>
      ) : null}
      {chartType === "scatter" ? (
        <>
          <ColumnSelect
            id={`chart-x-${table.id}`}
            label="X axis"
            columns={columns}
            value={choice.x}
            onChange={(id) => onChange({ ...choice, x: id })}
          />
          <ColumnSelect
            id={`chart-y-${table.id}`}
            label="Y axis"
            columns={columns}
            value={choice.y}
            onChange={(id) => onChange({ ...choice, y: id })}
          />
        </>
      ) : null}
    </div>
  )
}

function metricColumns(table: ChartTable): Column[] {
  return table.columns.filter((column) => isValueColumn(column) && column.scope !== "firm")
}

function resolveChoice(board: Board, table: ChartTable, saved: MetricChoice | undefined): MetricChoice {
  const columns = metricColumns(table)
  const ids = new Set(columns.map((column) => column.id))
  const main = table.id === MAIN_CHART_TABLE_ID || table.id === STATEMENT_TABLE_ID
  const fallbackBars = main ? defaultBarColumnIds(board).filter((id) => ids.has(id)) : []
  const first = columns[0]?.id ?? ""
  const second = columns[1]?.id ?? first
  const [defaultX, defaultY] = main ? defaultScatterColumnIds(board) : [first, second]
  const bars = (saved?.bars ?? (fallbackBars.length > 0 ? fallbackBars : first ? [first] : [])).filter((id) => ids.has(id))
  const kind = columns.find((column) => column.id === bars[0])?.kind
  const sameKind = kind ? bars.filter((id) => columns.find((column) => column.id === id)?.kind === kind) : []
  return {
    bars: sameKind.length > 0 ? sameKind : first ? [first] : [],
    pie: saved && ids.has(saved.pie) ? saved.pie : main && ids.has(defaultPieColumnId(board)) ? defaultPieColumnId(board) : first,
    x: saved && ids.has(saved.x) ? saved.x : ids.has(defaultX) ? defaultX : first,
    y: saved && ids.has(saved.y) ? saved.y : ids.has(defaultY) ? defaultY : second,
  }
}

function lineFor(board: Board, table: ChartTable, grain: Grain, lineFilter: string): string {
  const labels = tableLabels(board, table.id)
  if (grain === "line") return labels.includes(lineFilter) ? lineFilter : ""
  if (!tableAggregates(board, table.id)) return labels.includes(lineFilter) ? lineFilter : labels[0] ?? ""
  return labels.includes(lineFilter) ? lineFilter : ""
}

function nextBars(columns: Column[], current: string[], column: Column, checked: boolean): string[] {
  const known = new Set(columns.map((item) => item.id))
  const present = current.filter((id) => known.has(id))
  if (!checked) return present.filter((id) => id !== column.id)
  const sameKind = present.filter((id) => columns.find((item) => item.id === id)?.kind === column.kind)
  return sameKind.includes(column.id) ? sameKind : [...sameKind, column.id]
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

function TableDonut({
  title,
  plots,
  column,
  companyId,
  grain,
}: {
  title: string
  plots: PlotRow[]
  column: Column | undefined
  companyId: string
  grain: Grain
}) {
  if (!column) return <EmptyPlot message="Choose a metric." />
  const slices = plots.flatMap((row, index) => {
    const value = row.values[column.id]
    if (value === undefined || value === null || value <= 0) return []
    const color = grain === "line" ? (PIE_COLORS[index % PIE_COLORS.length] ?? PIE_COLORS[0]) : markColor(row.groupId, index, companyId)
    return [{ id: row.key, label: row.label, value, display: formatColumnValue(column, value), color }]
  })
  const [first, second] = centerLines(title)
  if (slices.length === 0) {
    return <EmptyPlot message="No positive values to graph. Pie slices skip zero and negative numbers." />
  }
  return (
    <div
      className="flex flex-wrap items-center gap-4"
      role="img"
      aria-label={`${title}: ${slices.map((slice) => `${slice.label} ${slice.display}`).join(", ")}`}
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
              {slice.label} {slice.display}
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

function chartDescription(chartType: ChartType, grain: Grain, several: boolean): string {
  if (chartType === "margins") return "Gross margin and profit margin from the financial results."
  if (chartType === "pie") {
    return several
      ? "Each pie is a table. Choose a metric, and each row with a positive value becomes a slice."
      : "Choose a table and a metric. Each row with a positive value becomes a slice."
  }
  if (chartType === "scatter") {
    return several ? "Each table has its own scatterplot. Choose both axes." : "Choose a table, then the metrics for both axes."
  }
  if (grain === "line") {
    return several ? "Each table has its own bar graph. Checked metrics share one column type." : "Each bar is a row. Check the metrics to plot."
  }
  return several
    ? "Each table has its own bar graph. Firm totals use the checked metrics."
    : "Each bar is a firm total. Check the metrics to plot."
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
