/** Saved boards and the previous copy are deleted once they are 24 hours old. */
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000

export function isExpired(savedAt: string, now: number, ttl = SNAPSHOT_TTL_MS): boolean {
  const time = Date.parse(savedAt)
  if (!Number.isFinite(time)) return true
  return now - time >= ttl
}

export function expiresAt(savedAt: string, ttl = SNAPSHOT_TTL_MS): string | null {
  const time = Date.parse(savedAt)
  if (!Number.isFinite(time)) return null
  return new Date(time + ttl).toISOString()
}
