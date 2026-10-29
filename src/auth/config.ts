import { LAUNCHBOX_TENANT_ID } from "./access"

export const azureClientId = (import.meta.env.VITE_AZURE_CLIENT_ID ?? "").trim()

export const azureTenantId = (import.meta.env.VITE_AZURE_TENANT_ID ?? "").trim() || LAUNCHBOX_TENANT_ID

export const loginScopes = ["openid", "profile", "email"] as const
