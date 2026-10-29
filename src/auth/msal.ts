import { InteractionRequiredAuthError, PublicClientApplication, type AccountInfo, type AuthenticationResult } from "@azure/msal-browser"

import { launchboxEmailFromClaims } from "./access"
import { azureClientId, azureTenantId, loginScopes } from "./config"

const scopes = [...loginScopes]

export const msal = azureClientId
  ? new PublicClientApplication({
      auth: {
        clientId: azureClientId,
        authority: `https://login.microsoftonline.com/${azureTenantId}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: { cacheLocation: "localStorage" },
    })
  : null

let bootPromise: Promise<void> | null = null

export function bootMsal(): Promise<void> {
  if (!msal) return Promise.resolve()
  if (!bootPromise) {
    bootPromise = (async () => {
      await msal.initialize()
      const result = await msal.handleRedirectPromise()
      const account = result?.account ?? msal.getAllAccounts()[0]
      if (account) msal.setActiveAccount(account)
      if (msal.getAllAccounts().length > 0) return
      try {
        const silent = await Promise.race([
          msal.ssoSilent({ scopes }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("sso timeout")), 2000)
          }),
        ])
        if (silent.account) msal.setActiveAccount(silent.account)
      } catch (error) {
        if (!(error instanceof InteractionRequiredAuthError) && !(error instanceof Error && error.message === "sso timeout")) {
          console.debug("Silent Microsoft sign-in was not available.", error)
        }
      }
    })()
  }
  return bootPromise
}

export function activeAccount(): AccountInfo | null {
  if (!msal) return null
  return msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null
}

export function accountEmail(account: AccountInfo): string | null {
  const claims = account.idTokenClaims ?? {}
  return launchboxEmailFromClaims({
    preferred_username: stringClaim(claims.preferred_username) ?? account.username,
    email: stringClaim(claims.email),
    upn: stringClaim(claims.upn),
  })
}

export async function signIn(): Promise<void> {
  if (!msal) throw new Error("Microsoft sign-in is not configured.")
  await msal.loginRedirect({ scopes })
}

export async function signOut(): Promise<void> {
  if (!msal) return
  await msal.logoutRedirect()
}

export async function acquireIdToken(): Promise<string> {
  if (!msal) throw new Error("Microsoft sign-in is not configured.")
  const account = activeAccount()
  if (!account) throw new Error("Sign in required.")
  try {
    const result: AuthenticationResult = await msal.acquireTokenSilent({ account, scopes })
    if (!result.idToken) throw new Error("Microsoft did not return a sign-in token.")
    return result.idToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ account, scopes })
    }
    throw error
  }
}

function stringClaim(value: unknown): string | null {
  return typeof value === "string" ? value : null
}
