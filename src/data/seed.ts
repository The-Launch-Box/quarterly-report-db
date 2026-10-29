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

export function createSeedWorkspace(): Workspace {
  return {
    version: 1,
    boards: [
      {
        id: "ytd",
        title: "YTD financial results",
        subtitle: "Expected sits beside Q1. Closed actuals run Q1 to Q3. Q4 forecast is the working column. YTD is calculated.",
        aggregateRows: false,
        columns: YTD_COLUMNS,
        groups: PORTCOS.map(ytdGroup),
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
        columns: HEADCOUNT_COLUMNS,
        groups: PORTCOS.map(headcountGroup),
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
        groups: PORTCOS.map(revenueGroup),
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
  for (const group of ytd.groups) {
    const rev = group.rows.find((row) => row.cells[LABEL_COLUMN_ID] === "Revenue")
    const motions = revenue.groups.find((item) => item.id === group.id)
    if (!rev || !motions) {
      problems.push(`Missing revenue for ${group.id}.`)
      continue
    }
    for (const quarter of ["q3", "q4"] as const) {
      const total = Number(rev.cells[quarter])
      const sum = motions.rows.reduce((acc, row) => acc + Number(row.cells[quarter] ?? 0), 0)
      if (sum !== total) problems.push(`${group.id} ${quarter} sums to ${sum}, expected ${total}.`)
    }
  }
  return problems
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
  }
}

function headcountGroup(portco: PortcoSeed): BoardGroup {
  return {
    id: portco.id,
    name: portco.name,
    rows: ROLES.map((role, index) => {
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
 * Within 4% is On track. More than 8% below is Behind. More than 8% above is Ahead.
 * The open band between those cuts is Watch.
 */
export function varianceStatus(actual: number, expected: number): StatusValue {
  if (expected === 0) {
    if (actual > 0) return "Ahead"
    if (actual < 0) return "Behind"
    return "On track"
  }
  const variance = (actual - expected) / expected
  if (Math.abs(variance) <= 0.04 + 1e-9) return "On track"
  if (variance < -0.08 - 1e-9) return "Behind"
  if (variance > 0.08 + 1e-9) return "Ahead"
  return "Watch"
}
