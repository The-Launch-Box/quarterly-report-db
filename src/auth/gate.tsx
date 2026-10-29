import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { BrandMark, Button } from "@/components/ui"
import { isAdminEmail } from "./access"
import { azureClientId } from "./config"
import { accountEmail, activeAccount, bootMsal, signIn, signOut } from "./msal"

export interface Session {
  email: string
  name: string
  admin: boolean
  signOut: () => void
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const value = useContext(SessionContext)
  if (!value) throw new Error("useSession must be used inside AuthGate")
  return value
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!azureClientId) return
    let cancelled = false
    void bootMsal()
      .then(() => {
        if (!cancelled) setBooted(true)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : "Microsoft sign-in failed.")
        setBooted(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const account = booted ? activeAccount() : null
  const email = account ? accountEmail(account) : null

  const session = useMemo<Session | null>(() => {
    if (!account || !email) return null
    return {
      email,
      name: account.name || email,
      admin: isAdminEmail(email),
      signOut: () => void signOut(),
    }
  }, [account, email])

  if (!azureClientId) return <ConfigScreen />
  if (!booted) return <Frame title="Signing in" body="Connecting to Microsoft." />
  if (error) return <Frame title="Sign-in failed" body={error} action={<Retry />} />
  if (!account) return <SignInScreen />
  if (!email || !session) {
    return (
      <Frame
        title="This account cannot open the report"
        body={`${account.username} is not an @thelaunchbox.com account.`}
        action={
          <Button onClick={() => void signOut()}>Use a different account</Button>
        }
      />
    )
  }

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

function SignInScreen() {
  return (
    <Frame
      title="Sign in"
      body="Use your @thelaunchbox.com account to open the boards."
      action={<Button onClick={() => void signIn()}>Sign in with Microsoft</Button>}
    />
  )
}

function ConfigScreen() {
  return (
    <Frame
      title="Sign-in is not configured"
      body="Set VITE_AZURE_CLIENT_ID to this site's Entra app registration, add this site's address as a SPA redirect URI, then restart."
    />
  )
}

function Retry() {
  return <Button onClick={() => void signIn()}>Try again</Button>
}

function Frame({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-card px-8 py-10 text-center">
        <div className="mx-auto flex w-fit items-center gap-3 text-left">
          <BrandMark />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">The Launch Box</p>
            <p className="font-display text-3xl leading-none">Quarterly report</p>
          </div>
        </div>
        <h1 className="mt-8 text-2xl leading-none">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{body}</p>
        {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      </div>
    </div>
  )
}
