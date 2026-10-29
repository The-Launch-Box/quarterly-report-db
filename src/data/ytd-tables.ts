import { EXPECTED_COLUMN_ID, LABEL_COLUMN_ID, type Board, type Column } from "./types"

/** Columns on the YTD ratio table. */
export const RATIO_COLUMNS: Column[] = [
  { id: LABEL_COLUMN_ID, name: "Ratio", kind: "text" },
  { id: EXPECTED_COLUMN_ID, name: "Target", kind: "percent", decimals: 0 },
  { id: "q3", name: "Q3", kind: "percent", decimals: 0 },
  { id: "ytd", name: "YTD", kind: "percent", decimals: 0 },
]

/** The income statement on YTD. */
export const STATEMENT_TABLE_ID = "statement"
/** The default ratios table on YTD. */
export const RATIOS_TABLE_ID = "ratios"

const BUILTIN_TITLES: Record<string, string> = {
  [STATEMENT_TABLE_ID]: "Financial results",
  [RATIOS_TABLE_ID]: "Ratios",
}

/** On YTD: Financial results, then Ratios, then added tables. Other boards list only added tables. */
export function ytdSectionOrder(board: Board): string[] {
  const custom = board.ytdCustomTables?.map((table) => table.id) ?? []
  const builtins = board.id === "ytd" ? [STATEMENT_TABLE_ID, RATIOS_TABLE_ID] : []
  const known = [...builtins, ...custom]
  const knownIds = new Set(known)
  const saved = (board.ytdTableOrder ?? []).filter((id, index, list) => knownIds.has(id) && list.indexOf(id) === index)
  return [...saved, ...known.filter((id) => !saved.includes(id))]
}

export function ytdSectionTitle(board: Board, tableId: string): string {
  return BUILTIN_TITLES[tableId] ?? board.ytdCustomTables?.find((table) => table.id === tableId)?.title ?? "Table"
}

export function moveInOrder(order: readonly string[], id: string, direction: "up" | "down"): string[] | null {
  const index = order.indexOf(id)
  const next = direction === "up" ? index - 1 : index + 1
  if (index < 0 || next < 0 || next >= order.length) return null
  const copy = [...order]
  const [item] = copy.splice(index, 1)
  if (!item) return null
  copy.splice(next, 0, item)
  return copy
}
