import {
  EXPECTED_COLUMN_ID,
  LABEL_COLUMN_ID,
  type Board,
  type BoardGroup,
  type BoardRow,
  type Column,
  type ColumnKind,
  type StatusValue,
  type Workspace,
  type YtdCustomTable,
} from "./types"

const ROLES = [
  { name: "Engineering", rate: 215_000 },
  { name: "Product", rate: 195_000 },
  { name: "Go to market", rate: 168_000 },
  { name: "Customer success", rate: 142_000 },
  { name: "G&A", rate: 158_000 },
] as const

const MOTIONS = [
  { name: "New logos", weight: 0.22 },
  { name: "Expansion", weight: 0.31 },
  { name: "Renewal", weight: 0.37 },
  { name: "Services", weight: 0.1 },
] as const

type Triple = readonly [number, number, number]

interface PortcoSeed {
  id: string
  name: string
  revenue: readonly [number, number, number, number]
  gp: number
  ebitda: number
  goalLift: number
  headcount: readonly [Triple, Triple, Triple, Triple, Triple]
}

const PORTCOS: readonly PortcoSeed[] = [
  {
    id: "echelon",
    name: "Echelon Risk + Cyber",
    revenue: [4_100_000, 4_400_000, 4_800_000, 5_300_000],
    gp: 0.58,
    ebitda: 0.17,
    goalLift: 1.04,
    headcount: [
      [48, 54, 52],
      [9, 11, 10],
      [22, 26, 24],
      [14, 16, 15],
      [11, 12, 12],
    ],
  },
  {
    id: "improv",
    name: "Improv",
    // Not used. Improv tables come from the deck groups in this file.
    revenue: [2_200_000, 2_350_000, 2_500_000, 2_620_000],
    gp: 0.46,
    ebitda: 0.12,
    goalLift: 1.09,
    headcount: [
      [20, 22, 21],
      [4, 5, 4],
      [15, 16, 16],
      [8, 8, 9],
      [6, 6, 6],
    ],
  },
  {
    id: "hyperscayle",
    name: "Hyperscayle",
    revenue: [3_000_000, 3_250_000, 3_550_000, 4_100_000],
    gp: 0.7,
    ebitda: 0.24,
    goalLift: 0.97,
    headcount: [
      [36, 40, 41],
      [8, 9, 9],
      [12, 14, 13],
      [7, 8, 8],
      [6, 6, 7],
    ],
  },
  {
    id: "vescape",
    name: "VEscape",
    revenue: [1_450_000, 1_520_000, 1_620_000, 1_580_000],
    gp: 0.51,
    ebitda: 0.09,
    goalLift: 1.12,
    headcount: [
      [14, 18, 15],
      [3, 4, 3],
      [9, 11, 9],
      [5, 6, 5],
      [4, 4, 4],
    ],
  },
  {
    id: "bluetrail",
    name: "Blue Trail Digital",
    revenue: [1_800_000, 1_920_000, 2_050_000, 2_240_000],
    gp: 0.48,
    ebitda: 0.13,
    goalLift: 1.03,
    headcount: [
      [17, 19, 18],
      [5, 5, 5],
      [11, 12, 12],
      [6, 7, 7],
      [5, 5, 5],
    ],
  },
  {
    id: "dxfoundation",
    name: "DX Foundation",
    revenue: [820_000, 900_000, 980_000, 1_150_000],
    gp: 0.4,
    ebitda: 0.06,
    goalLift: 1.06,
    headcount: [
      [8, 10, 9],
      [2, 3, 2],
      [6, 7, 6],
      [3, 3, 3],
      [3, 4, 3],
    ],
  },
]

/** YTD ratios from the operating-results slide. Improv uses that slide. Other firms are starter figures. */
const RATIO_LINES = [
  { id: "gpm", name: "Gross profit margin", measure: "percent" },
  { id: "nbtem", name: "Non-billable travel expense margin", measure: "percent" },
  { id: "sga", name: "SG&A expense ratio", measure: "percent" },
  { id: "npm", name: "Net profit margin", measure: "percent" },
  { id: "rgr", name: "Revenue growth rate", measure: "percent" },
  { id: "wkr", name: "Working capital ratio", measure: "number" },
] as const

const RATIO_IDS = new Set<string>(RATIO_LINES.map((line) => line.id))

/** Improv's slide also states a target and a Q3 figure beside the YTD ratio. */
const IMPROV_RATIO_PERIODS: Record<string, { expected: string; q3: string }> = {
  gpm: { expected: "0.50", q3: "0.41" },
  nbtem: { expected: "0.05", q3: "0.01" },
  sga: { expected: "0.20", q3: "0.25" },
  npm: { expected: "0.25", q3: "0.16" },
  rgr: { expected: "0.95", q3: "0.32" },
  wkr: { expected: "1.50", q3: "1.38" },
}


const IMPROV_FIRM_RATIOS: Record<string, string> = {
  gpm: "0.38",
  nbtem: "0.01",
  sga: "0.31",
  npm: "0.06",
  rgr: "0.61",
  wkr: "0.75",
}

const FIRM_RATIO_EXTRAS: Record<string, Record<string, string>> = {
  echelon: { nbtem: "0.02", sga: "0.22", npm: "0.12", rgr: "0.18", wkr: "1.62" },
  hyperscayle: { nbtem: "0.01", sga: "0.18", npm: "0.19", rgr: "0.27", wkr: "2.05" },
  vescape: { nbtem: "0.03", sga: "0.28", npm: "0.04", rgr: "0.06", wkr: "1.12" },
  bluetrail: { nbtem: "0.02", sga: "0.24", npm: "0.09", rgr: "0.14", wkr: "1.44" },
  dxfoundation: { nbtem: "0.04", sga: "0.27", npm: "0.03", rgr: "0.21", wkr: "0.88" },
}

const YTD_COLUMNS: Column[] = [
  { id: LABEL_COLUMN_ID, name: "Line", kind: "text" },
  { id: EXPECTED_COLUMN_ID, name: "Expected", kind: "currency" },
  { id: "q1", name: "Q1 actual", kind: "currency" },
  { id: "q2", name: "Q2 actual", kind: "currency" },
  { id: "q3", name: "Q3 actual", kind: "currency" },
  { id: "q4", name: "Q4 forecast", kind: "currency", emphasis: true },
  {
    id: "ytd",
    name: "YTD",
    kind: "currency",
    formula: { op: "sum", columnIds: ["q1", "q2", "q3", "q4"] },
  },
  { id: "status", name: "Status", kind: "status" },
]

const HEADCOUNT_COLUMNS: Column[] = [
  { id: LABEL_COLUMN_ID, name: "Role", kind: "text" },
  { id: EXPECTED_COLUMN_ID, name: "Expected", kind: "number" },
  { id: "q3", name: "Q3 close", kind: "number" },
  { id: "q4plan", name: "Q4 plan", kind: "number" },
  { id: "q4", name: "Q4 forecast", kind: "number", emphasis: true },
  { id: "rate", name: "Annual rate", kind: "currency", rollup: "skip" },
  {
    id: "cost",
    name: "Fully loaded",
    kind: "currency",
    formula: { op: "product", columnIds: ["q4", "rate"] },
  },
  { id: "status", name: "Status", kind: "status" },
]

const REVENUE_COLUMNS: Column[] = [
  { id: LABEL_COLUMN_ID, name: "Motion", kind: "text" },
  { id: EXPECTED_COLUMN_ID, name: "Expected", kind: "currency" },
  { id: "q3", name: "Q3 actual", kind: "currency" },
  { id: "goal", name: "Q4 goal", kind: "currency" },
  { id: "q4", name: "Q4 forecast", kind: "currency", emphasis: true },
  {
    id: "attainment",
    name: "Attainment",
    kind: "percent",
    formula: { op: "ratio", numeratorId: "q4", denominatorId: "goal" },
  },
  { id: "status", name: "Status", kind: "status" },
]

/** Replaces a saved Improv group that still has the old placeholder lines. */
export function withImprovDeck(workspace: Workspace): Workspace {
  const current = workspace.boards.find((board) => board.id === "ytd")?.groups.find((group) => group.id === "improv")
  if (!current) return workspace
  if (current.operatingResults !== undefined && current.rows.some((row) => row.cells[LABEL_COLUMN_ID] === "Net income")) {
    return workspace
  }
  let changed = false
  const boards = workspace.boards.map((board) => {
    const next = improvDeckGroup(board.id)
    if (!next) return board
    const index = board.groups.findIndex((group) => group.id === "improv")
    if (index === -1) return board
    changed = true
    const groups = board.groups.slice()
    groups[index] = next
    return { ...board, groups }
  })
  return changed ? { ...workspace, boards } : workspace
}

/** A saved board may still say Behind. That status is Watch now. */
export function withoutRetiredStatuses(workspace: Workspace): Workspace {
  let changed = false
  const boards = workspace.boards.map((board) => {
    const statusIds = board.columns.filter((column) => column.kind === "status").map((column) => column.id)
    if (statusIds.length === 0) return board
    let boardChanged = false
    const groups = board.groups.map((group) => {
      let groupChanged = false
      const rows = group.rows.map((row) => {
        const cells = { ...row.cells }
        let rowChanged = false
        for (const id of statusIds) {
          if (cells[id] !== "Behind") continue
          cells[id] = "Watch"
          rowChanged = true
        }
        if (!rowChanged) return row
        groupChanged = true
        return { ...row, cells }
      })
      if (!groupChanged) return group
      boardChanged = true
      return { ...group, rows }
    })
    if (!boardChanged) return board
    changed = true
    return { ...board, groups }
  })
  return changed ? { ...workspace, boards } : workspace
}

/** Drops the note under YTD financial results, including on a saved board. */
export function withoutYtdSubtitle(workspace: Workspace): Workspace {
  let changed = false
  const boards = workspace.boards.map((board) => {
    if (board.id !== "ytd" || board.subtitle === "") return board
    changed = true
    return { ...board, subtitle: "" }
  })
  return changed ? { ...workspace, boards } : workspace
}

/** Gives every firm a ratio table, and moves older ratio columns or income-statement rows into it. */
export function withFirmRatios(workspace: Workspace): Workspace {
  let changed = false
  const boards = workspace.boards.map((board) => {
    if (board.id !== "ytd") return board
    const next = placeRatioTable(board)
    if (next !== board) changed = true
    return next
  })
  return changed ? { ...workspace, boards } : workspace
}

function placeRatioTable(board: Board): Board {
  const dropColumns = board.columns.some((column) => column.scope === "firm" || RATIO_IDS.has(column.id))
  const columns = dropColumns
    ? board.columns.filter((column) => column.scope !== "firm" && !RATIO_IDS.has(column.id))
    : board.columns
  const groups = board.groups.map((group) => placeGroupRatios(group, board.ratioTable === true))
  const groupsSame = groups.every((group, index) => group === board.groups[index])
  if (!dropColumns && groupsSame && board.ratioTable && !board.firmRatios && !board.ratioRows) return board
  const next: Board = { ...board, columns, groups, ratioTable: true }
  delete next.firmRatios
  delete next.ratioRows
  return next
}

function placeGroupRatios(group: BoardGroup, tableReady: boolean): BoardGroup {
  const lifted = group.rows.filter(isRatioRow)
  const rows = lifted.length > 0 ? group.rows.filter((row) => !isRatioRow(row)) : group.rows
  const ratios = tableReady && lifted.length === 0 ? group.ratios : buildRatios(group, lifted, !tableReady)
  const metrics = withoutRatioMetrics(group.metrics)
  if (rows === group.rows && ratios === group.ratios && metrics === group.metrics) return group
  const next: BoardGroup = { ...group, rows }
  if (ratios && ratios.length > 0) next.ratios = ratios
  else delete next.ratios
  if (metrics) next.metrics = metrics
  else delete next.metrics
  return next
}

function isRatioRow(row: BoardRow): boolean {
  return RATIO_LINES.some((line) => row.measure === line.measure && row.cells[LABEL_COLUMN_ID] === line.name)
}

function buildRatios(group: BoardGroup, lifted: BoardRow[], fillMissing: boolean): BoardRow[] {
  const found = new Map<string, BoardRow>()
  for (const row of group.ratios ?? []) found.set(row.id, row)
  for (const row of lifted) found.set(row.id, row)
  const ratios: BoardRow[] = []
  for (const spec of RATIO_LINES) {
    const existing = found.get(`${group.id}-${spec.id}`)
    if (existing) ratios.push(existing)
    else if (fillMissing) ratios.push(ratioLine(group, spec))
  }
  return ratios
}

function withoutRatioMetrics(metrics: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!metrics || !Object.keys(metrics).some((id) => RATIO_IDS.has(id))) return metrics
  const next = { ...metrics }
  for (const id of RATIO_IDS) delete next[id]
  return Object.keys(next).length > 0 ? next : undefined
}

function ratioLine(group: BoardGroup, spec: (typeof RATIO_LINES)[number]): BoardRow {
  const stored = group.metrics?.[spec.id]
  const fallback = firmMetricsFor(group.id)?.[spec.id]
  const ytd = stored !== undefined ? stored : (fallback ?? "")
  const cells: Record<string, string> = { [LABEL_COLUMN_ID]: spec.name }
  const periods = group.id === "improv" ? IMPROV_RATIO_PERIODS[spec.id] : undefined
  if (periods) {
    cells[EXPECTED_COLUMN_ID] = periods.expected
    cells.q3 = periods.q3
  }
  if (ytd) cells.ytd = ytd
  return { id: `${group.id}-${spec.id}`, measure: spec.measure, omitFromRollup: true, cells }
}

function firmMetricsFor(id: string): Record<string, string> | null {
  if (id === "improv") return IMPROV_FIRM_RATIOS
  const portco = PORTCOS.find((item) => item.id === id)
  const extra = FIRM_RATIO_EXTRAS[id]
  if (!portco || !extra) return null
  return { gpm: String(portco.gp), ...extra }
}

export function createSeedWorkspace(): Workspace {
  return {
    version: 1,
    boards: [
      {
        id: "ytd",
        title: "YTD financial results",
        subtitle: "",
        aggregateRows: false,
        ratioTable: true,
        columns: YTD_COLUMNS,
        groups: PORTCOS.map((portco) => (portco.id === "improv" ? improvYtdGroup() : ytdGroup(portco))),
        kpis: [
          { id: "q3-revenue", label: "Q3 revenue", columnId: "q3", labelEquals: "Revenue" },
          { id: "q4-revenue", label: "Q4 revenue", columnId: "q4", labelEquals: "Revenue", compareColumnId: "q3" },
          { id: "q3-ebitda", label: "Q3 EBITDA", columnId: "q3", labelEquals: "EBITDA" },
          { id: "q4-ebitda", label: "Q4 EBITDA", columnId: "q4", labelEquals: "EBITDA", compareColumnId: "q3" },
        ],
      },
      {
        id: "headcount",
        title: "Headcount",
        subtitle: "Expected is the Q4 hiring plan, beside Q3 close. Fully loaded is forecast times annual rate.",
        aggregateRows: true,
        headcountTables: true,
        columns: HEADCOUNT_COLUMNS,
        ytdCustomTables: HEADCOUNT_TABLES.map((table) => ({ ...table, columns: table.columns.map((column) => ({ ...column })) })),
        ytdTableOrder: HEADCOUNT_TABLES.map((table) => table.id),
        groups: PORTCOS.map((portco) => (portco.id === "improv" ? improvHeadcountGroup() : headcountGroup(portco))),
        kpis: [
          { id: "q3-heads", label: "Q3 close", columnId: "q3" },
          { id: "q4-heads", label: "Q4 forecast", columnId: "q4", compareColumnId: "q3" },
          { id: "loaded", label: "Fully loaded", columnId: "cost" },
        ],
      },
      {
        id: "revenue",
        title: "Revenue goals",
        subtitle: "Expected is the Q4 goal, beside Q3 actual. Attainment compares the live forecast with that goal.",
        aggregateRows: true,
        columns: REVENUE_COLUMNS,
        groups: PORTCOS.map((portco) => (portco.id === "improv" ? improvRevenueGroup() : revenueGroup(portco))),
        kpis: [
          { id: "q3-actual", label: "Q3 revenue", columnId: "q3" },
          { id: "q4-goal", label: "Q4 goal", columnId: "goal" },
          { id: "q4-forecast", label: "Q4 forecast", columnId: "q4", compareColumnId: "goal" },
        ],
      },
    ],
  }
}

export function seedProblems(): string[] {
  const workspace = createSeedWorkspace()
  const ytd = workspace.boards.find((board) => board.id === "ytd")
  const revenue = workspace.boards.find((board) => board.id === "revenue")
  if (!ytd || !revenue) return ["Missing seed boards."]
  const problems: string[] = []
  if (ytd.columns.some((column) => column.scope === "firm" || RATIO_IDS.has(column.id))) {
    problems.push("Ratio columns are still on the YTD board.")
  }
  for (const group of ytd.groups) {
    const rev = group.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue")
    const motions = revenue.groups.find((item) => item.id === group.id)
    if (!rev || !motions) {
      problems.push(`Missing revenue for ${group.id}.`)
      continue
    }
    if (group.id === "improv") {
      problems.push(...improvSeedProblems(group, motions))
      continue
    }
    problems.push(...firmRatioProblems(group))
    for (const quarter of ["q3", "q4"] as const) {
      const total = Number(rev.cells[quarter])
      const sum = motions.rows.reduce((acc, row) => acc + Number(row.cells[quarter] ?? 0), 0)
      if (sum !== total) problems.push(`${group.id} ${quarter} sums to ${sum}, expected ${total}.`)
    }
  }
  return problems
}

/** YTD operating results copied from the Improv deck. */
export const IMPROV_OPERATING_RESULTS = [
  "• $3.4M YTD Revenue vs $3.6M (-5%)",
  "• $1.3M Gross Margin, 38% YTD",
  "• P7 operational burn-rate of ~$460k",
  "• $198k Net Income, 6% YTD",
  "• $4.2M backlog as of 8/01",
  "",
  "Gross profit margin: P7 41%, Q3 41%, YTD 38%, target 50%",
  "Non-billable travel expense margin: P7 1%, Q3 1%, YTD 1%, target 5%",
  "SG&A expense ratio: P7 25%, Q3 25%, YTD 31%, target 20%",
  "Net profit margin: P7 16%, Q3 16%, YTD 6%, target 25%",
  "Revenue growth rate: P7 32%, Q3 32%, YTD 61%, target 95%",
  "Working capital ratio: P7 1.38, Q3 1.38, YTD 0.75, target 1.50",
].join("\n")

const IMPROV_REVENUE_YTD = 3_400_000
const IMPROV_REVENUE_EXPECTED = 3_600_000
const IMPROV_GROSS_YTD = 1_300_000
const IMPROV_GROSS_EXPECTED = 1_800_000
const IMPROV_NET_YTD = 198_000
const IMPROV_NET_EXPECTED = 900_000

const IMPROV_HEADCOUNT: readonly (readonly [string, number])[] = [
  ["Aug 2025", 30],
  ["Sep 2025", 36],
  ["Oct 2025", 34],
  ["Nov 2025", 31],
  ["Dec 2025", 33],
  ["Jan 2026", 33],
  ["Feb 2026", 34],
  ["Mar 2026", 35],
  ["Apr 2026", 33],
  ["May 2026", 32],
  ["Jun 2026", 32],
  ["Jul 2026", 31],
  ["Aug 2026", 32],
]

const IMPROV_CENSUS: readonly (readonly [string, number])[] = [
  ["2025 headcount", 33],
  ["2024 headcount", 21],
  ["2023 headcount", 5],
]

export const HEADCOUNT_MONTH_TABLE_ID = "headcount-months"
export const HEADCOUNT_TERMINATION_TABLE_ID = "headcount-termination"
export const HEADCOUNT_TENURE_TABLE_ID = "headcount-tenure"
const HEADCOUNT_COUNT_COLUMN_ID = "count"
const HEADCOUNT_SHARE_COLUMN_ID = "share"

const HEADCOUNT_TABLES: readonly YtdCustomTable[] = [
  {
    id: HEADCOUNT_MONTH_TABLE_ID,
    title: "Month by Month",
    columns: [
      { id: LABEL_COLUMN_ID, name: "Month", kind: "text" },
      { id: HEADCOUNT_COUNT_COLUMN_ID, name: "Headcount", kind: "number" },
    ],
  },
  {
    id: HEADCOUNT_TERMINATION_TABLE_ID,
    title: "Termination type",
    columns: [
      { id: LABEL_COLUMN_ID, name: "Type", kind: "text" },
      { id: HEADCOUNT_SHARE_COLUMN_ID, name: "Share", kind: "percent", decimals: 0 },
    ],
  },
  {
    id: HEADCOUNT_TENURE_TABLE_ID,
    title: "Length of service",
    columns: [
      { id: LABEL_COLUMN_ID, name: "Length", kind: "text" },
      { id: HEADCOUNT_SHARE_COLUMN_ID, name: "Share", kind: "percent", decimals: 0 },
    ],
  },
]

const HEADCOUNT_MIX: readonly { mix: "termination" | "tenure"; name: string; legacy: string }[] = [
  { mix: "termination", name: "Involuntary Termination", legacy: "Involuntary termination %" },
  { mix: "termination", name: "Voluntary Unspecified", legacy: "Voluntary unspecified %" },
  { mix: "termination", name: "Non-Regrettable", legacy: "Non-regrettable %" },
  { mix: "termination", name: "Regrettable", legacy: "Regrettable %" },
  { mix: "tenure", name: "1-3 years", legacy: "Tenure 1-3 years %" },
  { mix: "tenure", name: "6 months - 1 year", legacy: "Tenure 6 months-1 year %" },
  { mix: "tenure", name: "< 6 months", legacy: "Tenure under 6 months %" },
]

const IMPROV_TERMINATIONS: readonly (readonly [string, number])[] = [
  ["Involuntary Termination", 70],
  ["Voluntary Unspecified", 15],
  ["Non-Regrettable", 10],
  ["Regrettable", 5],
]

const IMPROV_TENURE: readonly (readonly [string, number])[] = [
  ["1-3 years", 40],
  ["6 months - 1 year", 30],
  ["< 6 months", 20],
]

const IMPROV_PLAN: readonly (readonly [string, number])[] = [
  ["2026 revenue", 8_100_000],
  ["2026 gross margin (43%)", 3_500_000],
  ["2027 revenue", 13_500_000],
  ["2027 gross margin (45%)", 6_000_000],
  ["2028 revenue", 18_000_000],
  ["2028 gross margin (50%)", 9_000_000],
]

function improvDeckGroup(boardId: string): BoardGroup | null {
  if (boardId === "ytd") return improvYtdGroup()
  if (boardId === "headcount") return improvHeadcountGroup()
  if (boardId === "revenue") return improvRevenueGroup()
  return null
}

function improvYtdGroup(): BoardGroup {
  const revenue = thirds(IMPROV_REVENUE_YTD)
  const gross = thirds(IMPROV_GROSS_YTD)
  const net = thirds(IMPROV_NET_YTD)
  const opex: [number, number, number] = [
    gross[0] - net[0],
    gross[1] - net[1],
    gross[2] - net[2],
  ]
  return {
    id: "improv",
    name: "Improv",
    operatingResults: IMPROV_OPERATING_RESULTS,
    rows: [
      closedMoneyRow("improv-revenue", "Revenue", revenue, IMPROV_REVENUE_EXPECTED),
      closedMoneyRow("improv-gp", "Gross profit", gross, IMPROV_GROSS_EXPECTED),
      closedMoneyRow("improv-opex", "Operating expenses", opex, IMPROV_GROSS_EXPECTED - IMPROV_NET_EXPECTED),
      closedMoneyRow("improv-net-income", "Net income", net, IMPROV_NET_EXPECTED),
    ],
    ratios: firmRatioRows("improv"),
  }
}

function improvHeadcountGroup(): BoardGroup {
  return {
    id: "improv",
    name: "Improv",
    rows: [
      ...IMPROV_CENSUS.map(([label, count]) => headcountFact(`improv-census-${slug(label)}`, label, count, false)),
      headcountFact("improv-turnover", "Total turnover (61%)", 20, false),
    ],
    customRows: improvHeadcountCustomRows(),
  }
}

function improvHeadcountCustomRows(): Record<string, BoardRow[]> {
  return {
    [HEADCOUNT_MONTH_TABLE_ID]: IMPROV_HEADCOUNT.map(([label, count]) => countRow(`improv-${slug(label)}`, label, count)),
    [HEADCOUNT_TERMINATION_TABLE_ID]: IMPROV_TERMINATIONS.map(([label, percent]) => shareRow(`improv-${slug(label)}`, label, percent)),
    [HEADCOUNT_TENURE_TABLE_ID]: IMPROV_TENURE.map(([label, percent]) => shareRow(`improv-${slug(label)}`, label, percent)),
  }
}

function improvRevenueGroup(): BoardGroup {
  return {
    id: "improv",
    name: "Improv",
    rows: IMPROV_PLAN.map(([label, amount]) => ({
      id: `improv-${slug(label)}`,
      omitFromRollup: true,
      cells: {
        [LABEL_COLUMN_ID]: label,
        [EXPECTED_COLUMN_ID]: String(amount),
        status: "",
      },
    })),
  }
}

function improvSeedProblems(ytd: BoardGroup, revenue: BoardGroup): string[] {
  const problems: string[] = []
  const revenueRow = ytd.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue")
  const gross = ytd.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Gross profit")
  const net = ytd.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Net income")
  const opex = ytd.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Operating expenses")
  if (!revenueRow || !gross || !net || !opex) {
    problems.push("Improv P&L is missing a line.")
    return problems
  }
  const quarters = ["q1", "q2", "q3"] as const
  if (quarterSum(revenueRow, quarters) !== IMPROV_REVENUE_YTD) problems.push("Improv revenue YTD is not $3.4M.")
  if (revenueRow.cells[EXPECTED_COLUMN_ID] !== String(IMPROV_REVENUE_EXPECTED)) problems.push("Improv revenue expected is not $3.6M.")
  if (quarterSum(gross, quarters) !== IMPROV_GROSS_YTD) problems.push("Improv gross profit YTD is not $1.3M.")
  if (quarterSum(net, quarters) !== IMPROV_NET_YTD) problems.push("Improv net income YTD is not $198k.")
  for (const quarter of quarters) {
    const gap = Number(gross.cells[quarter]) - Number(net.cells[quarter])
    if (gap !== Number(opex.cells[quarter])) problems.push(`Improv ${quarter} does not foot.`)
  }
  if (ytd.operatingResults !== IMPROV_OPERATING_RESULTS) problems.push("Improv operating results are missing.")
  problems.push(...firmRatioProblems(ytd))
  const plan = new Map(IMPROV_PLAN)
  for (const [label, amount] of plan) {
    const row = revenue.rows.find((item) => item.cells[LABEL_COLUMN_ID] === label)
    if (!row || row.cells[EXPECTED_COLUMN_ID] !== String(amount)) problems.push(`Improv plan is missing ${label}.`)
  }
  return problems
}

function firmRatioProblems(group: BoardGroup): string[] {
  const expected = firmMetricsFor(group.id)
  if (!expected) return [`Missing firm ratios for ${group.id}.`]
  const problems: string[] = []
  if (group.rows.some(isRatioRow)) problems.push(`${group.id} ratios are still on the income statement.`)
  RATIO_LINES.forEach((line, offset) => {
    const row = group.ratios?.[offset]
    if (!row || row.cells[LABEL_COLUMN_ID] !== line.name || row.measure !== line.measure) {
      problems.push(`${group.id} ${line.name} is missing from the ratio table.`)
      return
    }
    if (row.cells.ytd !== expected[line.id]) problems.push(`${group.id} ${line.id} YTD is ${row.cells.ytd ?? "missing"}.`)
  })
  return problems
}

export function firmRatioRows(groupId: string): BoardRow[] {
  return ratioLines(groupId)
}

function ratioLines(groupId: string): BoardRow[] {
  const group: BoardGroup = { id: groupId, name: groupId, rows: [] }
  return RATIO_LINES.map((spec) => ratioLine(group, spec))
}

function quarterSum(row: BoardRow, quarters: readonly string[]): number {
  return quarters.reduce((sum, id) => sum + Number(row.cells[id] ?? 0), 0)
}

/** The deck states a YTD total. Closed quarters share it so the calculated YTD matches. */
function thirds(total: number): [number, number, number] {
  const base = Math.floor(total / 3)
  return [base, base, total - base * 2]
}

function closedMoneyRow(id: string, label: string, quarters: readonly [number, number, number], expected: number): BoardRow {
  const actual = quarters[0] + quarters[1] + quarters[2]
  return {
    id,
    cells: {
      [LABEL_COLUMN_ID]: label,
      [EXPECTED_COLUMN_ID]: String(expected),
      q1: String(quarters[0]),
      q2: String(quarters[1]),
      q3: String(quarters[2]),
      status: varianceStatus(actual, expected),
    },
  }
}

/** Blank rows for one of the headcount tables. Other added tables return null. */
export function headcountTemplateRows(tableId: string, groupId: string): BoardRow[] | null {
  if (tableId === HEADCOUNT_MONTH_TABLE_ID) {
    return IMPROV_HEADCOUNT.map(([label]) => countRow(`${groupId}-${slug(label)}`, label, null))
  }
  if (tableId === HEADCOUNT_TERMINATION_TABLE_ID) {
    return IMPROV_TERMINATIONS.map(([label]) => shareRow(`${groupId}-${slug(label)}`, label, null))
  }
  if (tableId === HEADCOUNT_TENURE_TABLE_ID) {
    return IMPROV_TENURE.map(([label]) => shareRow(`${groupId}-${slug(label)}`, label, null))
  }
  return null
}

/** Puts the starter summary tiles back on a shared board that was saved without them. */
export function withSeedKpis(workspace: Workspace): Workspace {
  const seed = createSeedWorkspace()
  let changed = false
  const boards = workspace.boards.map((board) => {
    if (board.firmId || board.kpis.length > 0) return board
    const kpis = seed.boards.find((item) => item.id === board.id)?.kpis
    if (!kpis || kpis.length === 0) return board
    changed = true
    return { ...board, kpis: kpis.map((kpi) => ({ ...kpi })) }
  })
  return changed ? { ...workspace, boards } : workspace
}

/**
 * Moves month, termination, and tenure rows off the main headcount table.
 * A board that already has these tables is left alone, so a deleted table stays deleted.
 */
export function withHeadcountTables(workspace: Workspace): Workspace {
  const board = workspace.boards.find((item) => item.id === "headcount")
  if (!board || board.headcountTables === true) return workspace
  const groups = board.groups.map(splitHeadcountGroup)
  const withTables = ensureHeadcountTables(board)
  return {
    ...workspace,
    boards: workspace.boards.map((item) =>
      item.id === "headcount"
        ? {
            ...withTables,
            headcountTables: true,
            groups: groups.every((group, index) => group === board.groups[index]) ? board.groups : groups,
          }
        : item,
    ),
  }
}

function ensureHeadcountTables(board: Board): Board {
  const existing = board.ytdCustomTables ?? []
  const missing = HEADCOUNT_TABLES.filter((table) => !existing.some((item) => item.id === table.id))
  if (missing.length === 0) return board
  const ytdCustomTables = [
    ...existing,
    ...missing.map((table) => ({ ...table, columns: table.columns.map((column) => ({ ...column })) })),
  ]
  const known = new Set(ytdCustomTables.map((table) => table.id))
  const preferred = [
    ...HEADCOUNT_TABLES.map((table) => table.id),
    ...(board.ytdTableOrder ?? []),
    ...existing.map((table) => table.id),
  ]
  const ytdTableOrder = preferred.filter((id, index) => known.has(id) && preferred.indexOf(id) === index)
  return { ...board, ytdCustomTables, ytdTableOrder }
}

function splitHeadcountGroup(group: BoardGroup): BoardGroup {
  const kept: BoardRow[] = []
  const months: BoardRow[] = []
  const termination: BoardRow[] = []
  const tenure: BoardRow[] = []
  const hasCensus = group.rows.some((row) => row.cells[LABEL_COLUMN_ID] === "2025 headcount")
  let moved = false
  for (const row of group.rows) {
    const label = row.cells[LABEL_COLUMN_ID] ?? ""
    if (IMPROV_HEADCOUNT.some(([month]) => month === label)) {
      months.push(countFrom(row))
      moved = true
      continue
    }
    const line = HEADCOUNT_MIX.find((item) => item.name === label || item.legacy === label)
    const mix = line?.mix ?? row.mix
    if (line || mix === "termination" || mix === "tenure") {
      const next = shareFrom(row, line?.name ?? label)
      if (mix === "tenure") tenure.push(next)
      else termination.push(next)
      moved = true
      continue
    }
    if (label === "Total employees" && hasCensus) {
      moved = true
      continue
    }
    kept.push(row)
  }
  const monthRows = mergeMoved(group.customRows?.[HEADCOUNT_MONTH_TABLE_ID], months, headcountTemplateRows(HEADCOUNT_MONTH_TABLE_ID, group.id) ?? [])
  const terminationRows = mergeMoved(
    group.customRows?.[HEADCOUNT_TERMINATION_TABLE_ID],
    termination,
    headcountTemplateRows(HEADCOUNT_TERMINATION_TABLE_ID, group.id) ?? [],
  )
  const tenureRows = mergeMoved(
    group.customRows?.[HEADCOUNT_TENURE_TABLE_ID],
    tenure,
    headcountTemplateRows(HEADCOUNT_TENURE_TABLE_ID, group.id) ?? [],
  )
  if (
    !moved &&
    monthRows === group.customRows?.[HEADCOUNT_MONTH_TABLE_ID] &&
    terminationRows === group.customRows?.[HEADCOUNT_TERMINATION_TABLE_ID] &&
    tenureRows === group.customRows?.[HEADCOUNT_TENURE_TABLE_ID]
  ) {
    return group
  }
  return {
    ...group,
    rows: kept,
    customRows: {
      ...group.customRows,
      [HEADCOUNT_MONTH_TABLE_ID]: monthRows,
      [HEADCOUNT_TERMINATION_TABLE_ID]: terminationRows,
      [HEADCOUNT_TENURE_TABLE_ID]: tenureRows,
    },
  }
}

function mergeMoved(existing: BoardRow[] | undefined, moved: BoardRow[], blanks: BoardRow[]): BoardRow[] {
  if (!existing) return moved.length > 0 ? moved : blanks
  if (moved.length === 0) return existing
  const labels = new Set(existing.map((row) => (row.cells[LABEL_COLUMN_ID] ?? "").trim()))
  const extra = moved.filter((row) => !labels.has((row.cells[LABEL_COLUMN_ID] ?? "").trim()))
  return extra.length > 0 ? [...existing, ...extra] : existing
}

function countFrom(row: BoardRow): BoardRow {
  const raw = row.cells[HEADCOUNT_COUNT_COLUMN_ID] || row.cells.q3 || row.cells[EXPECTED_COLUMN_ID] || ""
  return countRow(row.id, row.cells[LABEL_COLUMN_ID] ?? "", raw ? Number(raw) : null)
}

function shareFrom(row: BoardRow, label: string): BoardRow {
  const raw = row.cells[HEADCOUNT_SHARE_COLUMN_ID] || row.cells.q3 || row.cells[EXPECTED_COLUMN_ID] || ""
  const stored = Number(raw)
  const percent = !raw || !Number.isFinite(stored) ? null : Math.abs(stored) > 1 ? stored : stored * 100
  return shareRow(row.id, label, percent)
}

function countRow(id: string, label: string, count: number | null): BoardRow {
  const cells: Record<string, string> = { [LABEL_COLUMN_ID]: label }
  if (count !== null && Number.isFinite(count)) cells[HEADCOUNT_COUNT_COLUMN_ID] = String(count)
  return { id, omitFromRollup: true, cells }
}

function shareRow(id: string, label: string, percent: number | null): BoardRow {
  const cells: Record<string, string> = { [LABEL_COLUMN_ID]: label }
  if (percent !== null && Number.isFinite(percent)) cells[HEADCOUNT_SHARE_COLUMN_ID] = String(percent / 100)
  return { id, omitFromRollup: true, cells }
}

function headcountFact(id: string, label: string, count: number, rollup: boolean): BoardRow {
  const row: BoardRow = {
    id,
    cells: {
      [LABEL_COLUMN_ID]: label,
      [EXPECTED_COLUMN_ID]: String(count),
      q3: String(count),
      status: rollup ? varianceStatus(count, count) : "",
    },
  }
  if (rollup) {
    row.cells.q4plan = String(count)
    row.cells.q4 = String(count)
  } else {
    row.omitFromRollup = true
  }
  return row
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function ytdGroup(portco: PortcoSeed): BoardGroup {
  const quarters = portco.revenue
  const gross = quarters.map((value) => Math.round(value * portco.gp))
  const ebitda = quarters.map((value) => Math.round(value * portco.ebitda))
  const opex = gross.map((value, index) => value - (ebitda[index] ?? 0))
  return {
    id: portco.id,
    name: portco.name,
    rows: [
      moneyRow(`${portco.id}-revenue`, "Revenue", quarters, annualPlan(quarters, portco.goalLift)),
      moneyRow(`${portco.id}-gp`, "Gross profit", gross, annualPlan(gross, portco.goalLift)),
      moneyRow(`${portco.id}-opex`, "Operating expenses", opex, annualPlan(opex, 1)),
      moneyRow(`${portco.id}-ebitda`, "EBITDA", ebitda, annualPlan(ebitda, portco.goalLift)),
    ],
    ratios: firmRatioRows(portco.id),
  }
}

function headcountGroup(portco: PortcoSeed): BoardGroup {
  return {
    id: portco.id,
    name: portco.name,
    rows: [
      ...ROLES.map((role, index) => {
        const counts = portco.headcount[index] ?? [0, 0, 0]
        const q3 = counts[0] ?? 0
        const plan = counts[1] ?? 0
        const forecast = counts[2] ?? 0
        return {
          id: `${portco.id}-${role.name.toLowerCase().replace(/\s+/g, "-")}`,
          cells: {
            [LABEL_COLUMN_ID]: role.name,
            [EXPECTED_COLUMN_ID]: String(plan),
            q3: String(q3),
            q4plan: String(plan),
            q4: String(forecast),
            rate: String(role.rate),
            status: varianceStatus(forecast, plan),
          },
        }
      }),
    ],
    customRows: {
      [HEADCOUNT_MONTH_TABLE_ID]: headcountTemplateRows(HEADCOUNT_MONTH_TABLE_ID, portco.id) ?? [],
      [HEADCOUNT_TERMINATION_TABLE_ID]: headcountTemplateRows(HEADCOUNT_TERMINATION_TABLE_ID, portco.id) ?? [],
      [HEADCOUNT_TENURE_TABLE_ID]: headcountTemplateRows(HEADCOUNT_TENURE_TABLE_ID, portco.id) ?? [],
    },
  }
}

function revenueGroup(portco: PortcoSeed): BoardGroup {
  const q3 = portco.revenue[2] ?? 0
  const q4 = portco.revenue[3] ?? 0
  const goal = Math.round(q4 * portco.goalLift)
  const weights = MOTIONS.map((motion) => motion.weight)
  const actuals = allocate(q3, weights)
  const forecasts = allocate(q4, weights)
  const goals = allocate(goal, weights)
  return {
    id: portco.id,
    name: portco.name,
    rows: MOTIONS.map((motion, index) => {
      const forecast = forecasts[index] ?? 0
      const target = goals[index] ?? 0
      return {
        id: `${portco.id}-${motion.name.toLowerCase().replace(/\s+/g, "-")}`,
        cells: {
          [LABEL_COLUMN_ID]: motion.name,
          [EXPECTED_COLUMN_ID]: String(target),
          q3: String(actuals[index] ?? 0),
          goal: String(target),
          q4: String(forecast),
          status: varianceStatus(forecast, target),
        },
      }
    }),
  }
}

function moneyRow(id: string, label: string, quarters: readonly number[], expected: number): BoardRow {
  const ytd = quarters.reduce((sum, value) => sum + value, 0)
  return {
    id,
    cells: {
      [LABEL_COLUMN_ID]: label,
      [EXPECTED_COLUMN_ID]: String(expected),
      q1: String(quarters[0] ?? 0),
      q2: String(quarters[1] ?? 0),
      q3: String(quarters[2] ?? 0),
      q4: String(quarters[3] ?? 0),
      status: varianceStatus(ytd, expected),
    },
  }
}

function annualPlan(values: readonly number[], lift: number): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round(total * lift)
}

/** Puts Expected beside Q1, or beside the first quarter column when the board has no Q1. */
export function withExpectedColumn(workspace: Workspace): Workspace {
  return {
    ...workspace,
    boards: workspace.boards.map(placeExpected),
  }
}

function placeExpected(board: Board): Board {
  if (board.firmId) return board
  const existing = board.columns.find((column) => column.id === EXPECTED_COLUMN_ID)
  const rest = board.columns.filter((column) => column.id !== EXPECTED_COLUMN_ID)
  const column = existing ?? { id: EXPECTED_COLUMN_ID, name: "Expected", kind: expectedKind(board) }
  const columns = rest.slice()
  const q1Index = columns.findIndex((item) => item.id === "q1")
  const labelIndex = columns.findIndex((item) => item.id === LABEL_COLUMN_ID)
  const at = q1Index >= 0 ? q1Index : labelIndex >= 0 ? labelIndex + 1 : 0
  columns.splice(at, 0, column)
  if (sameColumnOrder(board.columns, columns)) return board
  return {
    ...board,
    columns,
    groups: existing
      ? board.groups
      : board.groups.map((group) => ({
          ...group,
          rows: group.rows.map((row) => ({
            ...row,
            cells: { ...row.cells, [EXPECTED_COLUMN_ID]: fallbackExpected(board.id, row.cells) },
          })),
        })),
  }
}

function sameColumnOrder(current: Column[], next: Column[]): boolean {
  return current.length === next.length && current.every((column, index) => column === next[index])
}

function expectedKind(board: Board): ColumnKind {
  if (board.id === "headcount") return "number"
  const numeric = board.columns.filter((column) => column.kind === "number" || column.kind === "currency")
  if (numeric.length > 0 && numeric.every((column) => column.kind === "number")) return "number"
  return "currency"
}

function fallbackExpected(boardId: string, cells: Record<string, string>): string {
  if (boardId === "headcount") return cells.q4plan || cells.q4 || ""
  if (boardId === "revenue") return cells.goal || cells.q4 || ""
  const quarters = ["q1", "q2", "q3", "q4"].map((id) => Number(cells[id] ?? ""))
  if (quarters.every((value) => Number.isFinite(value))) return String(quarters.reduce((sum, value) => sum + value, 0))
  return cells.q4 || ""
}

function allocate(total: number, weights: readonly number[]): number[] {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  const amounts = weights.map((weight) => Math.round((total * weight) / weightTotal))
  const drift = Math.round(total) - amounts.reduce((sum, amount) => sum + amount, 0)
  const last = amounts.length - 1
  if (last >= 0) amounts[last] = (amounts[last] ?? 0) + drift
  return amounts
}

/**
 * Status from (actual − expected) / expected.
 * Within 4% is On track. More than 8% above is Ahead. Anything else is Watch.
 */
export function varianceStatus(actual: number, expected: number): StatusValue {
  if (expected === 0) {
    if (actual > 0) return "Ahead"
    if (actual < 0) return "Watch"
    return "On track"
  }
  const variance = (actual - expected) / expected
  if (Math.abs(variance) <= 0.04 + 1e-9) return "On track"
  if (variance > 0.08 + 1e-9) return "Ahead"
  return "Watch"
}
