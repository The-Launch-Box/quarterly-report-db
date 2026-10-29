import { listCompanies } from "./metrics"
import { firmRatioRows } from "./seed"
import {
  LABEL_COLUMN_ID,
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  SOLO_COLUMN_WIDTH,
  screenWideColumn,
  type Board,
  type BoardGroup,
  type BoardRow,
  type Column,
  type ColumnKind,
  type Workspace,
  type YtdCustomTable,
} from "./types"
import { moveInOrder, RATIOS_TABLE_ID, STATEMENT_TABLE_ID, ytdSectionOrder } from "./ytd-tables"

const COLUMN_KINDS = new Set<ColumnKind>(["text", "number", "currency", "percent", "status"])

const RESERVED_BOARD_IDS = new Set(["ytd", "headcount", "revenue"])

export type WorkspaceAction =
  | { type: "set-cell"; boardId: string; groupId: string; rowId: string; columnId: string; value: string }
  | { type: "add-row"; boardId: string; groupId: string }
  | { type: "add-subrow"; boardId: string; groupId: string; rowId: string }
  | { type: "delete-row"; boardId: string; groupId: string; rowId: string }
  | { type: "delete-subrow"; boardId: string; groupId: string; rowId: string; subrowId: string }
  | { type: "add-column"; boardId: string; groupId?: string; name: string; kind: ColumnKind }
  | { type: "rename-column"; boardId: string; groupId?: string; columnId: string; name: string }
  | { type: "delete-column"; boardId: string; groupId?: string; columnId: string }
  | { type: "set-column-width"; boardId: string; groupId?: string; columnId: string; width: number }
  | { type: "add-table"; boardId: string; groupId: string; title: string }
  | { type: "rename-table"; boardId: string; groupId: string; title: string }
  | { type: "delete-table"; boardId: string; groupId: string }
  | { type: "move-table"; boardId: string; groupId: string; direction: "up" | "down" }
  | { type: "add-ytd-table"; boardId: string; tableId: string; columnId: string; title: string }
  | { type: "rename-ytd-table"; boardId: string; tableId: string; title: string }
  | { type: "delete-ytd-table"; boardId: string; tableId: string }
  | { type: "move-ytd-table"; boardId: string; tableId: string; direction: "up" | "down" }
  | { type: "add-ytd-column"; boardId: string; tableId: string; columnId: string; name: string; kind: ColumnKind }
  | { type: "rename-ytd-column"; boardId: string; tableId: string; columnId: string; name: string }
  | { type: "delete-ytd-column"; boardId: string; tableId: string; columnId: string }
  | { type: "set-ytd-column-width"; boardId: string; tableId: string; columnId: string; width: number }
  | { type: "add-ytd-row"; boardId: string; tableId: string; groupId: string }
  | { type: "delete-ytd-row"; boardId: string; tableId: string; groupId: string; rowId: string }
  | { type: "add-company"; name: string }
  | { type: "rename-company"; groupId: string; name: string }
  | { type: "delete-company"; groupId: string }
  | { type: "set-operating-results"; groupId: string; value: string }
  | { type: "set-firm-metric"; boardId: string; groupId: string; columnId: string; value: string }
  | { type: "add-board"; boardId: string; firmId: string; title: string }
  | { type: "rename-board"; boardId: string; title: string }
  | { type: "set-board-subtitle"; boardId: string; subtitle: string }
  | { type: "delete-board"; boardId: string }
  | { type: "replace"; workspace: Workspace }

export function reducer(workspace: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case "set-cell":
      return mapBoard(workspace, action.boardId, (board) => {
        const group = board.groups.find((item) => item.id === action.groupId)
        const custom = group ? customTableForRow(board, group, action.rowId) : undefined
        if (custom) {
          const column = custom.columns.find((item) => item.id === action.columnId)
          if (!column || column.formula) return board
          return {
            ...board,
            groups: board.groups.map((item) => {
              if (item.id !== action.groupId) return item
              const rows = item.customRows?.[custom.id]
              if (!rows) return item
              return {
                ...item,
                customRows: {
                  ...item.customRows,
                  [custom.id]: rows.map((row) => writeCell(row, action.rowId, action.columnId, action.value)),
                },
              }
            }),
          }
        }
        const column = (group ? tableColumns(board, group) : board.columns).find((item) => item.id === action.columnId)
        const ratio = group?.ratios?.find((row) => row.id === action.rowId)
        if (!column || column.scope === "firm") return board
        if (column.formula && !ratio?.measure) return board
        return {
          ...board,
          groups: board.groups.map((item) => {
            if (item.id !== action.groupId) return item
            if (item.ratios?.some((row) => row.id === action.rowId)) {
              return {
                ...item,
                ratios: item.ratios.map((row) => writeCell(row, action.rowId, action.columnId, action.value)),
              }
            }
            return {
              ...item,
              rows: item.rows.map((row) => writeCell(row, action.rowId, action.columnId, action.value)),
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
    case "add-subrow": {
      const board = workspace.boards.find((item) => item.id === action.boardId)
      const group = board?.groups.find((item) => item.id === action.groupId)
      if (!board?.firmId || !group?.rows.some((row) => row.id === action.rowId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        groups: current.groups.map((item) =>
          item.id === action.groupId
            ? {
                ...item,
                rows: item.rows.map((row) =>
                  row.id === action.rowId ? { ...row, subrows: [...(row.subrows ?? []), blankItem()] } : row,
                ),
              }
            : item,
        ),
      }))
    }
    case "delete-row":
      return mapBoard(workspace, action.boardId, (board) => ({
        ...board,
        groups: board.groups.map((group) =>
          group.id === action.groupId ? { ...group, rows: group.rows.filter((row) => row.id !== action.rowId) } : group,
        ),
      }))
    case "delete-subrow": {
      const board = workspace.boards.find((item) => item.id === action.boardId)
      const row = board?.groups
        .find((item) => item.id === action.groupId)
        ?.rows.find((item) => item.id === action.rowId)
      if (!board?.firmId || !row?.subrows?.some((item) => item.id === action.subrowId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        groups: current.groups.map((group) => {
          if (group.id !== action.groupId) return group
          return {
            ...group,
            rows: group.rows.map((item) => {
              if (item.id !== action.rowId || !item.subrows) return item
              const subrows = item.subrows.filter((sub) => sub.id !== action.subrowId)
              if (subrows.length === 0) {
                const next = { ...item }
                delete next.subrows
                return next
              }
              return { ...item, subrows }
            }),
          }
        }),
      }))
    }
    case "add-column": {
      const name = action.name.trim()
      if (!name) return workspace
      const column: Column = { id: crypto.randomUUID(), name, kind: action.kind }
      return mapBoard(workspace, action.boardId, (board) => {
        if (!board.firmId) return { ...board, columns: [...board.columns, column] }
        return mapFirmTable(board, action.groupId, (group) => ({
          ...group,
          columns: [...tableColumns(board, group), column],
        }))
      })
    }
    case "rename-column": {
      const name = action.name.trim()
      if (!name) return workspace
      return mapBoard(workspace, action.boardId, (board) => {
        if (!board.firmId) {
          return {
            ...board,
            columns: board.columns.map((column) => (column.id === action.columnId ? { ...column, name } : column)),
          }
        }
        return mapFirmTable(board, action.groupId, (group) => ({
          ...group,
          columns: tableColumns(board, group).map((column) =>
            column.id === action.columnId ? { ...column, name } : column,
          ),
        }))
      })
    }
    case "set-column-width": {
      if (!Number.isFinite(action.width)) return workspace
      const width = Math.round(action.width)
      if (width < MIN_COLUMN_WIDTH) return workspace
      const board = workspace.boards.find((item) => item.id === action.boardId)
      if (!board) return workspace
      const columns = columnsForWidth(board, action.groupId)
      const current = columns.find((column) => column.id === action.columnId)
      if (!current || current.width === width) return workspace
      const limit = screenWideColumn(columns)?.id === current.id ? SOLO_COLUMN_WIDTH : MAX_COLUMN_WIDTH
      if (width > limit) return workspace
      return mapBoard(workspace, action.boardId, (current) => {
        if (!current.firmId) {
          return {
            ...current,
            columns: current.columns.map((column) => (column.id === action.columnId ? { ...column, width } : column)),
          }
        }
        return mapFirmTable(current, action.groupId, (group) => ({
          ...group,
          columns: tableColumns(current, group).map((column) =>
            column.id === action.columnId ? { ...column, width } : column,
          ),
        }))
      })
    }
    case "delete-column":
      return mapBoard(workspace, action.boardId, (board) => {
        if (!board.firmId) return deleteColumn(board, action.columnId)
        if (action.columnId === LABEL_COLUMN_ID) return board
        return mapFirmTable(board, action.groupId, (group) => ({
          ...group,
          columns: tableColumns(board, group).flatMap((column) => {
            const next = stripColumn(column, action.columnId)
            return next ? [next] : []
          }),
          rows: group.rows.map((row) => stripRowCells(row, action.columnId)),
        }))
      })
    case "add-table": {
      const title = action.title.trim()
      if (!title || title.length > 60) return workspace
      const board = workspace.boards.find((item) => item.id === action.boardId)
      if (!board?.firmId || !action.groupId || board.groups.some((group) => group.id === action.groupId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => {
        const owned = ownTableColumns(current)
        const groups = [...owned.groups, blankTable(action.groupId, title)]
        return { ...owned, columns: groups[0]?.columns ?? owned.columns, groups }
      })
    }
    case "rename-table": {
      const title = action.title.trim()
      if (!title || title.length > 60) return workspace
      const board = workspace.boards.find((item) => item.id === action.boardId)
      if (!board?.firmId || !board.groups.some((group) => group.id === action.groupId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        groups: current.groups.map((group) => (group.id === action.groupId ? { ...group, name: title } : group)),
      }))
    }
    case "delete-table": {
      const board = workspace.boards.find((item) => item.id === action.boardId)
      if (!board?.firmId || board.groups.length <= 1) return workspace
      if (!board.groups.some((group) => group.id === action.groupId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => {
        const groups = current.groups.filter((group) => group.id !== action.groupId)
        return { ...current, columns: groups[0]?.columns ?? current.columns, groups }
      })
    }
    case "move-table": {
      const board = workspace.boards.find((item) => item.id === action.boardId)
      if (!board?.firmId) return workspace
      const next = moveInOrder(
        board.groups.map((group) => group.id),
        action.groupId,
        action.direction,
      )
      if (!next) return workspace
      return mapBoard(workspace, action.boardId, (current) => {
        const owned = ownTableColumns(current)
        const byId = new Map(owned.groups.map((group) => [group.id, group]))
        const groups = next.flatMap((id) => {
          const group = byId.get(id)
          return group ? [group] : []
        })
        return { ...owned, groups, columns: groups[0]?.columns ?? owned.columns }
      })
    }
    case "add-ytd-table": {
      const title = action.title.trim()
      const tableId = cleanId(action.tableId)
      const columnId = cleanId(action.columnId)
      if (!title || title.length > 60 || !tableId || !columnId || columnId === LABEL_COLUMN_ID) return workspace
      if (tableId === STATEMENT_TABLE_ID || tableId === RATIOS_TABLE_ID) return workspace
      const board = workspace.boards.find((item) => item.id === action.boardId)
      if (!board || board.id !== "ytd" || board.firmId) return workspace
      if (board.ytdCustomTables?.some((table) => table.id === tableId)) return workspace
      const table: YtdCustomTable = {
        id: tableId,
        title,
        columns: [
          { id: LABEL_COLUMN_ID, name: "Title", kind: "text" },
          { id: columnId, name: "Column", kind: "text" },
        ],
      }
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        ytdCustomTables: [...(current.ytdCustomTables ?? []), table],
        ytdTableOrder: [...ytdSectionOrder(current), table.id],
        groups: current.groups.map((group) => ({
          ...group,
          customRows: { ...group.customRows, [table.id]: [blankItem(), blankItem(), blankItem()] },
        })),
      }))
    }
    case "rename-ytd-table": {
      const title = action.title.trim()
      if (!title || title.length > 60) return workspace
      const board = ytdBoard(workspace, action.boardId)
      if (!board?.ytdCustomTables?.some((table) => table.id === action.tableId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        ytdCustomTables: current.ytdCustomTables?.map((table) =>
          table.id === action.tableId ? { ...table, title } : table,
        ),
      }))
    }
    case "delete-ytd-table": {
      const board = ytdBoard(workspace, action.boardId)
      if (!board?.ytdCustomTables?.some((table) => table.id === action.tableId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => {
        const tables = current.ytdCustomTables?.filter((table) => table.id !== action.tableId) ?? []
        const next: Board = {
          ...current,
          ytdTableOrder: ytdSectionOrder(current).filter((id) => id !== action.tableId),
          groups: current.groups.map((group) => withoutCustomTable(group, action.tableId)),
        }
        if (tables.length > 0) next.ytdCustomTables = tables
        else delete next.ytdCustomTables
        return next
      })
    }
    case "move-ytd-table": {
      const board = ytdBoard(workspace, action.boardId)
      if (!board) return workspace
      const next = moveInOrder(ytdSectionOrder(board), action.tableId, action.direction)
      if (!next) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({ ...current, ytdTableOrder: next }))
    }
    case "add-ytd-column": {
      const name = action.name.trim()
      const columnId = cleanId(action.columnId)
      if (!name || name.length > 60 || !columnId || columnId === LABEL_COLUMN_ID || !COLUMN_KINDS.has(action.kind)) {
        return workspace
      }
      const board = ytdBoard(workspace, action.boardId)
      const table = board?.ytdCustomTables?.find((item) => item.id === action.tableId)
      if (!table || table.columns.some((column) => column.id === columnId)) return workspace
      const column: Column = { id: columnId, name, kind: action.kind }
      return mapYtdTable(workspace, action.boardId, action.tableId, (item) => ({
        ...item,
        columns: [...item.columns, column],
      }))
    }
    case "rename-ytd-column": {
      const name = action.name.trim()
      if (!name || name.length > 60) return workspace
      const board = ytdBoard(workspace, action.boardId)
      const table = board?.ytdCustomTables?.find((item) => item.id === action.tableId)
      if (!table?.columns.some((column) => column.id === action.columnId)) return workspace
      return mapYtdTable(workspace, action.boardId, action.tableId, (item) => ({
        ...item,
        columns: item.columns.map((column) => (column.id === action.columnId ? { ...column, name } : column)),
      }))
    }
    case "delete-ytd-column": {
      if (action.columnId === LABEL_COLUMN_ID) return workspace
      const board = ytdBoard(workspace, action.boardId)
      const table = board?.ytdCustomTables?.find((item) => item.id === action.tableId)
      if (!table?.columns.some((column) => column.id === action.columnId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        ytdCustomTables: current.ytdCustomTables?.map((item) =>
          item.id === action.tableId
            ? {
                ...item,
                columns: item.columns.flatMap((column) => {
                  const next = stripColumn(column, action.columnId)
                  return next ? [next] : []
                }),
              }
            : item,
        ),
        groups: current.groups.map((group) => {
          const rows = group.customRows?.[action.tableId]
          if (!rows) return group
          return {
            ...group,
            customRows: {
              ...group.customRows,
              [action.tableId]: rows.map((row) => stripRowCells(row, action.columnId)),
            },
          }
        }),
      }))
    }
    case "set-ytd-column-width": {
      if (!Number.isFinite(action.width)) return workspace
      const width = Math.round(action.width)
      if (width < MIN_COLUMN_WIDTH) return workspace
      const board = ytdBoard(workspace, action.boardId)
      const table = board?.ytdCustomTables?.find((item) => item.id === action.tableId)
      const column = table?.columns.find((item) => item.id === action.columnId)
      if (!table || !column || column.width === width) return workspace
      const limit = screenWideColumn(table.columns)?.id === column.id ? SOLO_COLUMN_WIDTH : MAX_COLUMN_WIDTH
      if (width > limit) return workspace
      return mapYtdTable(workspace, action.boardId, action.tableId, (item) => ({
        ...item,
        columns: item.columns.map((entry) => (entry.id === action.columnId ? { ...entry, width } : entry)),
      }))
    }
    case "add-ytd-row": {
      const board = ytdBoard(workspace, action.boardId)
      if (!board?.ytdCustomTables?.some((table) => table.id === action.tableId)) return workspace
      if (!board.groups.some((group) => group.id === action.groupId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        groups: current.groups.map((group) => {
          if (group.id !== action.groupId) return group
          const rows = group.customRows?.[action.tableId] ?? []
          return {
            ...group,
            customRows: { ...group.customRows, [action.tableId]: [...rows, blankItem()] },
          }
        }),
      }))
    }
    case "delete-ytd-row": {
      const board = ytdBoard(workspace, action.boardId)
      const rows = board?.groups.find((group) => group.id === action.groupId)?.customRows?.[action.tableId]
      if (!rows?.some((row) => row.id === action.rowId)) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({
        ...current,
        groups: current.groups.map((group) => {
          if (group.id !== action.groupId) return group
          const currentRows = group.customRows?.[action.tableId]
          if (!currentRows) return group
          return {
            ...group,
            customRows: {
              ...group.customRows,
              [action.tableId]: currentRows.filter((row) => row.id !== action.rowId),
            },
          }
        }),
      }))
    }
    case "add-company": {
      const name = action.name.trim()
      if (!name) return workspace
      const groupId = crypto.randomUUID()
      const ytd = workspace.boards.find((board) => board.id === "ytd")
      const customRows = ytd ? starterCustomRows(ytd) : undefined
      return {
        ...workspace,
        boards: workspace.boards.map((board) =>
          board.firmId
            ? board
            : {
                ...board,
                groups: [
                  ...board.groups,
                  {
                    id: groupId,
                    name,
                    rows: [{ id: crypto.randomUUID(), cells: { [LABEL_COLUMN_ID]: "New line" } }],
                    ...(board.id === "ytd"
                      ? { ratios: firmRatioRows(groupId), ...(customRows ? { customRows } : {}) }
                      : {}),
                  },
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
    case "set-board-subtitle": {
      const subtitle = action.subtitle.trim().replace(/\s+/g, " ")
      if (subtitle.length > 400) return workspace
      const board = workspace.boards.find((item) => item.id === action.boardId)
      if (!board?.firmId || board.subtitle === subtitle) return workspace
      return mapBoard(workspace, action.boardId, (current) => ({ ...current, subtitle }))
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
        name: "Table",
        rows: [blankItem(), blankItem(), blankItem()],
      },
    ],
    kpis: [],
  }
}

function blankItem(): BoardRow {
  return { id: crypto.randomUUID(), cells: { [LABEL_COLUMN_ID]: "" } }
}

function writeCell(row: BoardRow, rowId: string, columnId: string, value: string): BoardRow {
  if (row.id === rowId) return { ...row, cells: { ...row.cells, [columnId]: value } }
  if (!row.subrows?.some((item) => item.id === rowId)) return row
  return {
    ...row,
    subrows: row.subrows.map((item) => (item.id === rowId ? { ...item, cells: { ...item.cells, [columnId]: value } } : item)),
  }
}

function stripRowCells(row: BoardRow, columnId: string): BoardRow {
  const next: BoardRow = { ...row, cells: withoutCell(row.cells, columnId) }
  if (row.subrows) next.subrows = row.subrows.map((item) => ({ ...item, cells: withoutCell(item.cells, columnId) }))
  return next
}

function blankTable(groupId: string, title: string): BoardGroup {
  return {
    id: groupId,
    name: title,
    columns: [
      { id: LABEL_COLUMN_ID, name: "Title", kind: "text" },
      { id: crypto.randomUUID(), name: "Column", kind: "text" },
    ],
    rows: [blankItem(), blankItem(), blankItem()],
  }
}

function tableColumns(board: Board, group: BoardGroup): Column[] {
  return group.columns ?? board.columns
}

function columnsForWidth(board: Board, groupId: string | undefined): Column[] {
  if (!board.firmId) return board.columns
  const group = board.groups.find((item) => item.id === (groupId ?? board.groups[0]?.id))
  return group ? tableColumns(board, group) : []
}

/** Give every table on a firm board its own column list. */
function ownTableColumns(board: Board): Board {
  if (board.groups.every((group) => group.columns)) return board
  return {
    ...board,
    groups: board.groups.map((group) => (group.columns ? group : { ...group, columns: board.columns.map((column) => ({ ...column })) })),
  }
}

function mapFirmTable(board: Board, groupId: string | undefined, mapper: (group: BoardGroup) => BoardGroup): Board {
  const id = groupId ?? board.groups[0]?.id
  if (!id || !board.groups.some((group) => group.id === id)) return board
  const owned = ownTableColumns(board)
  const groups = owned.groups.map((group) => (group.id === id ? mapper(group) : group))
  return { ...owned, columns: groups[0]?.columns ?? owned.columns, groups }
}

function mapBoard(workspace: Workspace, boardId: string, mapper: (board: Board) => Board): Workspace {
  return {
    ...workspace,
    boards: workspace.boards.map((board) => (board.id === boardId ? mapper(board) : board)),
  }
}

function ytdBoard(workspace: Workspace, boardId: string): Board | undefined {
  const board = workspace.boards.find((item) => item.id === boardId)
  if (!board || board.id !== "ytd" || board.firmId) return undefined
  return board
}

function mapYtdTable(
  workspace: Workspace,
  boardId: string,
  tableId: string,
  mapper: (table: YtdCustomTable) => YtdCustomTable,
): Workspace {
  return mapBoard(workspace, boardId, (board) => ({
    ...board,
    ytdCustomTables: board.ytdCustomTables?.map((table) => (table.id === tableId ? mapper(table) : table)),
  }))
}

function customTableForRow(board: Board, group: BoardGroup, rowId: string): YtdCustomTable | undefined {
  return board.ytdCustomTables?.find((table) => group.customRows?.[table.id]?.some((row) => row.id === rowId))
}

function withoutCustomTable(group: BoardGroup, tableId: string): BoardGroup {
  if (!group.customRows?.[tableId]) return group
  const customRows = { ...group.customRows }
  delete customRows[tableId]
  const next: BoardGroup = { ...group }
  if (Object.keys(customRows).length > 0) next.customRows = customRows
  else delete next.customRows
  return next
}

function starterCustomRows(board: Board): Record<string, BoardRow[]> | undefined {
  if (!board.ytdCustomTables?.length) return undefined
  const customRows: Record<string, BoardRow[]> = {}
  for (const table of board.ytdCustomTables) customRows[table.id] = [blankItem(), blankItem(), blankItem()]
  return customRows
}

function cleanId(value: string): string | null {
  const id = value.trim()
  if (!id || id.length > 80) return null
  return id
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
      rows: group.rows.map((row) => stripRowCells(row, columnId)),
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
  if (column.width !== undefined) next.width = column.width
  return next
}

function withoutCell(cells: Record<string, string>, columnId: string): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(cells)) {
    if (key !== columnId) next[key] = value
  }
  return next
}
