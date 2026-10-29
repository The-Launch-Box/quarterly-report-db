/** Entra tenant for The Launch Box. Tokens from any other tenant are rejected. */
export const LAUNCHBOX_TENANT_ID = "82f56c4e-888b-4ac4-a433-0768b1724101"

export const ALLOWED_EMAIL_DOMAIN = "thelaunchbox.com"

const ADMIN_EMAILS = new Set([
  "karla.oros@thelaunchbox.com",
  "daniel.bernasconi@thelaunchbox.com",
  "kaylee.scanlin@thelaunchbox.com",
])

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isLaunchboxEmail(email: string): boolean {
  const normalized = normalizeEmail(email)
  const at = normalized.lastIndexOf("@")
  if (at <= 0 || normalized.includes(" ")) return false
  return normalized.slice(at + 1) === ALLOWED_EMAIL_DOMAIN
}

export function isAdminEmail(email: string): boolean {
  return isLaunchboxEmail(email) && ADMIN_EMAILS.has(normalizeEmail(email))
}

export function launchboxEmailFromClaims(claims: {
  preferred_username?: string | null
  email?: string | null
  upn?: string | null
}): string | null {
  const candidates = [claims.preferred_username, claims.email, claims.upn]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isLaunchboxEmail(candidate)) return normalizeEmail(candidate)
  }
  return null
}
