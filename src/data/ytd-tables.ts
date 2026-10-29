import type { Board } from "./types"

/** The income statement on YTD. */
export const STATEMENT_TABLE_ID = "statement"
/** The default ratios table on YTD. */
export const RATIOS_TABLE_ID = "ratios"

const BUILTIN_TITLES: Record<string, string> = {
  [STATEMENT_TABLE_ID]: "Financial results",
  [RATIOS_TABLE_ID]: "Ratios",
}

/** Financial results, then Ratios, then any tables added later, unless a saved order says otherwise. */
export function ytdSectionOrder(board: Board): string[] {
  const custom = board.ytdCustomTables?.map((table) => table.id) ?? []
  const known = [STATEMENT_TABLE_ID, RATIOS_TABLE_ID, ...custom]
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
