import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react"

import { useSession } from "@/auth/gate"
import { listCompanies } from "./metrics"
import { fetchBoard, fetchSeed, putBoard, type BoardPayload } from "./remote"
import { keepFirmBoards, reducer, type WorkspaceAction } from "./reducer"
import { withFirmRatios, withHeadcountMix, withImprovDeck, withoutRetiredStatuses, withoutYtdSubtitle } from "./seed"
import type { Workspace } from "./types"

const COMPANY_KEY = "karla-q3-company"
const LEGACY_STORAGE_KEY = "karla-q3-boards-v1"

interface WorkspaceContextValue {
  workspace: Workspace
  dispatch: Dispatch<WorkspaceAction>
  companyId: string
  setCompanyId: (id: string) => void
  canEdit: boolean
  statusLabel: string
  statusTone: "ok" | "warn"
  saving: boolean
  save: () => Promise<void>
  resetToSeed: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
const EMPTY: Workspace = { version: 1, boards: [] }

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const [workspace, rawDispatch] = useReducer(reducer, EMPTY)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [companyId, setCompanyIdState] = useState(readCompanyId)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const baseline = useRef("")
  const workspaceRef = useRef(workspace)
  const savingRef = useRef(false)
  workspaceRef.current = workspace

  const applyPayload = useCallback((payload: BoardPayload) => {
    baseline.current = JSON.stringify(payload.workspace)
    rawDispatch({ type: "replace", workspace: payload.workspace })
    setSavedAt(payload.savedAt)
    setDirty(false)
    setSaveError("")
  }, [])

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      /* the old browser copy is unused */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchBoard()
      .then((payload) => {
        if (cancelled) return
        applyPayload({
          ...payload,
          workspace: withoutRetiredStatuses(withoutYtdSubtitle(withHeadcountMix(withFirmRatios(withImprovDeck(payload.workspace))))),
        })
        setReady(true)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoadError(reason instanceof Error ? reason.message : "The boards could not be loaded.")
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [applyPayload])

  useEffect(() => {
    if (!ready || loadError) return
    setDirty(JSON.stringify(workspace) !== baseline.current)
  }, [workspace, ready, loadError])

  useEffect(() => {
    if (companyId === "all") return
    if (!listCompanies(workspace).some((company) => company.id === companyId)) {
      setCompanyId("all")
    }
  }, [workspace, companyId])

  const dispatch = useCallback(
    (action: WorkspaceAction) => {
      if (!session.admin) return
      setSaveError("")
      rawDispatch(action)
    },
    [session.admin],
  )

  const save = useCallback(async () => {
    if (!session.admin || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError("")
    try {
      const payload = await putBoard(workspaceRef.current)
      applyPayload(payload)
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not save.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [session.admin, applyPayload])

  const resetToSeed = useCallback(async () => {
    if (!session.admin) return
    setSaveError("")
    try {
      const next = await fetchSeed()
      rawDispatch({ type: "replace", workspace: keepFirmBoards(next, workspaceRef.current) })
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Could not restore the starter figures.")
    }
  }, [session.admin])

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id)
    try {
      sessionStorage.setItem(COMPANY_KEY, id)
    } catch {
      /* selection still updates in memory */
    }
  }, [])

  const status = statusOf({ saving, saveError, dirty, savedAt })

  const value = useMemo(
    () => ({
      workspace,
      dispatch,
      companyId,
      setCompanyId,
      canEdit: session.admin,
      statusLabel: status.label,
      statusTone: status.tone,
      saving,
      save,
      resetToSeed,
    }),
    [workspace, dispatch, companyId, setCompanyId, session.admin, status.label, status.tone, saving, save, resetToSeed],
  )

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">Loading boards</div>
    )
  }
  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-4 text-center text-sm text-muted-foreground">
        <p>{loadError}</p>
        <button type="button" className="text-foreground underline" onClick={session.signOut}>
          Sign out
        </button>
      </div>
    )
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider")
  return value
}

function statusOf(input: { saving: boolean; saveError: string; dirty: boolean; savedAt: string | null }): {
  label: string
  tone: "ok" | "warn"
} {
  if (input.saving) return { label: "Saving", tone: "warn" }
  if (input.saveError) return { label: input.saveError, tone: "warn" }
  if (input.dirty) return { label: "Unsaved changes", tone: "warn" }
  if (input.savedAt) {
    const time = new Date(input.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    return { label: `Saved ${time}`, tone: "ok" }
  }
  return { label: "Starter figures", tone: "ok" }
}

function readCompanyId(): string {
  if (typeof sessionStorage === "undefined") return "all"
  try {
    return sessionStorage.getItem(COMPANY_KEY) || "all"
  } catch {
    return "all"
  }
}
