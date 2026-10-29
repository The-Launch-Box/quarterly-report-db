import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"

import { isAdminEmail, launchboxEmailFromClaims } from "../src/auth/access"
import { azureClientId, azureTenantId } from "./config"

export interface Viewer {
  email: string
  name: string
  admin: boolean
}

export type AuthFailure = { ok: false; status: 401 | 403 | 503; message: string }
export type AuthSuccess = { ok: true; viewer: Viewer }

const jwksByTenant = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export async function authenticate(authorization: string | undefined): Promise<AuthSuccess | AuthFailure> {
  const clientId = azureClientId()
  const tenantId = azureTenantId()
  if (!clientId) {
    return { ok: false, status: 503, message: "Microsoft sign-in is not configured." }
  }
  const token = bearer(authorization)
  if (!token) return { ok: false, status: 401, message: "Sign in required." }

  try {
    const { payload } = await jwtVerify(token, jwks(tenantId), {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience: clientId,
    })
    return viewerFromPayload(payload, tenantId)
  } catch {
    return { ok: false, status: 401, message: "Sign in again." }
  }
}

function viewerFromPayload(payload: JWTPayload, tenantId: string): AuthSuccess | AuthFailure {
  if (payload.tid !== tenantId) {
    return { ok: false, status: 403, message: "This site is limited to The Launch Box." }
  }
  const email = launchboxEmailFromClaims({
    preferred_username: claimString(payload.preferred_username),
    email: claimString(payload.email),
    upn: claimString(payload.upn),
  })
  if (!email) {
    return { ok: false, status: 403, message: "This site is limited to @thelaunchbox.com accounts." }
  }
  const name = claimString(payload.name) || email
  return { ok: true, viewer: { email, name, admin: isAdminEmail(email) } }
}

function jwks(tenantId: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwksByTenant.get(tenantId)
  if (existing) return existing
  const created = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))
  jwksByTenant.set(tenantId, created)
  return created
}

function bearer(authorization: string | undefined): string | null {
  if (!authorization) return null
  const match = /^Bearer\s+(\S+)$/i.exec(authorization)
  return match?.[1] ?? null
}

function claimString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}
