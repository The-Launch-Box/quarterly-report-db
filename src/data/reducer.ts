import { listCompanies } from "./metrics"
import { LABEL_COLUMN_ID, type Board, type BoardRow, type Column, type ColumnKind, type Workspace } from "./types"

const RESERVED_BOARD_IDS = new Set(["ytd", "headcount", "revenue"])

export type WorkspaceAction =
  | { type: "set-cell"; boardId: string; groupId: string; rowId: string; columnId: string; value: string }
  | { type: "add-row"; boardId: string; groupId: string }
  | { type: "delete-row"; boardId: string; groupId: string; rowId: string }
  | { type: "add-column"; boardId: string; name: string; kind: ColumnKind }
  | { type: "rename-column"; boardId: string; columnId: string; name: string }
  | { type: "delete-column"; boardId: string; columnId: string }
  | { type: "add-company"; name: string }
  | { type: "rename-company"; groupId: string; name: string }
  | { type: "delete-company"; groupId: string }
  | { type: "set-operating-results"; groupId: string; value: string }
  | { type: "set-firm-metric"; boardId: string; groupId: string; columnId: string; value: string }
  | { type: "add-board"; boardId: string; firmId: string; title: string }
  | { type: "rename-board"; boardId: string; title: string }
  | { type: "delete-board"; boardId: string }
  | { type: "replace"; workspace: Workspace }

export function reducer(workspace: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case "set-cell":
      return mapBoard(workspace, action.boardId, (board) => {
        const column = board.columns.find((item) => item.id === action.columnId)
        if (!column || column.formula || column.scope === "firm") return board
        return {
          ...board,
          groups: board.groups.map((group) => {
            if (group.id !== action.groupId) return group
            return {
              ...group,
              rows: group.rows.map((row) => {
                if (row.id !== action.rowId) return row
                return { ...row, cells: { ...row.cells, [action.columnId]: action.value } }
              }),
            }
          }),
        }
      })
    case "add-row":
      return mapBoard(workspace, action.boardId, (board) => ({
        ...board,
        groups: board.groups.map((group) =>
          group.id === action.groupId
            ? {
                ...group,
                rows: [...group.rows, { id: crypto.randomUUID(), cells: { [LABEL_COLUMN_ID]: board.firmId ? "" : "New line" } }],
              }
            : group,
        ),
      }))
    case "delete-row":
      return mapBoard(workspace, action.boardId, (board) => ({
        ...board,
        groups: board.groups.map((group) =>
          group.id === action.groupId ? { ...group, rows: group.rows.filter((row) => row.id !== action.rowId) } : group,
        ),
      }))
    case "add-column": {
      const name = action.name.trim()
      if (!name) return workspace
      const column: Column = { id: crypto.randomUUID(), name, kind: action.kind }
      return mapBoard(workspace, action.boardId, (board) => ({
        ...board,
        columns: [...board.columns, column],
      }))
    }
    case "rename-column": {
      const name = action.name.trim()
      if (!name) return workspace
      return mapBoard(workspace, action.boardId, (board) => ({
        ...board,
        columns: board.columns.map((column) => (column.id === action.columnId ? { ...column, name } : column)),
      }))
    }
    case "delete-column":
      return mapBoard(workspace, action.boardId, (board) => deleteColumn(board, action.columnId))
    case "add-company": {
      const name = action.name.trim()
      if (!name) return workspace
      const groupId = crypto.randomUUID()
      return {
        ...workspace,
        boards: workspace.boards.map((board) =>
          board.firmId
            ? board
            : {
                ...board,
                groups: [
                  ...board.groups,
                  { id: groupId, name, rows: [{ id: crypto.randomUUID(), cells: { [LABEL_COLUMN_ID]: "New line" } }] },
                ],
              },
        ),
      }
    }
    case "rename-company": {
      const name = action.name.trim()
      if (!name) return workspace
      return {
        ...workspace,
        boards: workspace.boards.map((board) =>
          board.firmId
            ? board
            : {
                ...board,
                groups: board.groups.map((group) => (group.id === action.groupId ? { ...group, name } : group)),
              },
        ),
      }
    }
    case "delete-company": {
      if (listCompanies(workspace).length <= 1) return workspace
      return {
        ...workspace,
        boards: workspace.boards.flatMap((board) => {
          if (board.firmId === action.groupId) return []
          if (board.firmId) return [board]
          return [{ ...board, groups: board.groups.filter((group) => group.id !== action.groupId) }]
        }),
      }
    }
    case "add-board": {
      const title = action.title.trim()
      if (!title || title.length > 60) return workspace
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(action.boardId) || RESERVED_BOARD_IDS.has(action.boardId)) return workspace
      if (workspace.boards.some((board) => board.id === action.boardId)) return workspace
      if (!listCompanies(workspace).some((company) => company.id === action.firmId)) return workspace
      return { ...workspace, boards: [...workspace.boards, firmBoard(action.boardId, action.firmId, title)] }
    }
    case "rename-board": {
      const title = action.title.trim()
      if (!title || title.length > 60) return workspace
      return mapBoard(workspace, action.boardId, (board) => (board.firmId ? { ...board, title } : board))
    }
    case "delete-board":
      return {
        ...workspace,
        boards: workspace.boards.filter((board) => !(board.firmId && board.id === action.boardId)),
      }
    case "set-operating-results":
      return mapBoard(workspace, "ytd", (board) => ({
        ...board,
        groups: board.groups.map((group) =>
          group.id === action.groupId ? { ...group, operatingResults: action.value } : group,
        ),
      }))
    case "set-firm-metric": {
      const board = workspace.boards.find((item) => item.id === action.boardId)
      const column = board?.columns.find((item) => item.id === action.columnId)
      const group = board?.groups.find((item) => item.id === action.groupId)
      if (!column || column.scope !== "firm" || !group) return workspace
      if ((group.metrics?.[action.columnId] ?? "") === action.value) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        groups: current.groups.map((item) => {
          if (item.id !== action.groupId) return item
          return { ...item, metrics: { ...item.metrics, [action.columnId]: action.value } }
        }),
      }))
    }
    case "replace":
      return action.workspace
    default: {
      const unreachable: never = action
      void unreachable
      return workspace
    }
  }
}

/** Keeps firm boards whose firm is still in the restored workspace. */
export function keepFirmBoards(next: Workspace, current: Workspace): Workspace {
  const firms = new Set(listCompanies(next).map((company) => company.id))
  const kept = current.boards.filter((board) => board.firmId && firms.has(board.firmId))
  if (kept.length === 0) return next
  return { ...next, boards: [...next.boards.filter((board) => !board.firmId), ...kept] }
}

function firmBoard(boardId: string, firmId: string, title: string): Board {
  return {
    id: boardId,
    title,
    subtitle: "",
    aggregateRows: false,
    firmId,
    columns: [
      { id: LABEL_COLUMN_ID, name: "Title", kind: "text" },
      { id: crypto.randomUUID(), name: "Column", kind: "text" },
    ],
    groups: [
      {
        id: `group-${boardId}`,
        name: "Items",
        rows: [blankItem(), blankItem(), blankItem()],
      },
    ],
    kpis: [],
  }
}

function blankItem(): BoardRow {
  return { id: crypto.randomUUID(), cells: { [LABEL_COLUMN_ID]: "" } }
}

function mapBoard(workspace: Workspace, boardId: string, mapper: (board: Board) => Board): Workspace {
  return {
    ...workspace,
    boards: workspace.boards.map((board) => (board.id === boardId ? mapper(board) : board)),
  }
}

function deleteColumn(board: Board, columnId: string): Board {
  if (columnId === LABEL_COLUMN_ID) return board
  return {
    ...board,
    columns: board.columns.flatMap((column) => {
      const next = stripColumn(column, columnId)
      return next ? [next] : []
    }),
    kpis: board.kpis.flatMap((kpi) => {
      if (kpi.columnId === columnId) return []
      if (kpi.compareColumnId === columnId) {
        const rest: typeof kpi = { ...kpi }
        delete rest.compareColumnId
        return [rest]
      }
      return [kpi]
    }),
    groups: board.groups.map((group) => ({
      ...group,
      ...(group.metrics ? { metrics: withoutCell(group.metrics, columnId) } : {}),
      rows: group.rows.map((row) => ({ ...row, cells: withoutCell(row.cells, columnId) })),
    })),
  }
}

function stripColumn(column: Column, columnId: string): Column | null {
  if (column.id === columnId) return null
  const formula = column.formula
  if (!formula) return column
  if (formula.op === "sum") {
    return { ...column, formula: { op: "sum", columnIds: formula.columnIds.filter((id) => id !== columnId) } }
  }
  if (formula.op === "product") {
    const columnIds = formula.columnIds.filter((id) => id !== columnId)
    if (columnIds.length >= 2) return { ...column, formula: { op: "product", columnIds } }
    return plainColumn(column)
  }
  if (formula.numeratorId === columnId || formula.denominatorId === columnId) return plainColumn(column)
  return column
}

function plainColumn(column: Column): Column {
  const next: Column = { id: column.id, name: column.name, kind: column.kind }
  if (column.emphasis) next.emphasis = true
  return next
}

function withoutCell(cells: Record<string, string>, columnId: string): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(cells)) {
    if (key !== columnId) next[key] = value
  }
  return next
}
