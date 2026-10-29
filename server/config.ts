import { LAUNCHBOX_TENANT_ID } from "../src/auth/access"

export function azureTenantId(): string {
  return (process.env.VITE_AZURE_TENANT_ID || LAUNCHBOX_TENANT_ID).trim()
}

export function azureClientId(): string {
  return (process.env.VITE_AZURE_CLIENT_ID || "").trim()
}
