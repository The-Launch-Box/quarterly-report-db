import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react"

import { listCompanies } from "./metrics"
import { parseWorkspace } from "./persist"
import { reducer, type WorkspaceAction } from "./reducer"
import { createSeedWorkspace, withExpectedColumn } from "./seed"
import type { Workspace } from "./types"

const STORAGE_KEY = "karla-q3-boards-v1"
const COMPANY_KEY = "karla-q3-company"

interface WorkspaceContextValue {
  workspace: Workspace
  dispatch: Dispatch<WorkspaceAction>
  companyId: string
  setCompanyId: (id: string) => void
  savedLabel: string
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, dispatch] = useReducer(reducer, undefined, loadWorkspace)
  const [companyId, setCompanyIdState] = useState(readCompanyId)
  const [savedLabel, setSavedLabel] = useState("Live")
  const savedSnapshot = useRef<string | null>(null)

  useEffect(() => {
    let next = ""
    try {
      next = JSON.stringify(workspace)
    } catch {
      setSavedLabel("Live · not saved in this browser")
      return
    }
    const changed = savedSnapshot.current !== null && savedSnapshot.current !== next
    savedSnapshot.current = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
      if (!changed) return
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      setSavedLabel(`Live · saved ${time}`)
    } catch {
      setSavedLabel("Live · not saved in this browser")
    }
  }, [workspace])

  useEffect(() => {
    if (companyId === "all") return
    if (!listCompanies(workspace).some((company) => company.id === companyId)) {
      setCompanyId("all")
    }
  }, [workspace, companyId])

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id)
    try {
      sessionStorage.setItem(COMPANY_KEY, id)
    } catch {
      /* selection still updates in memory */
    }
  }, [])

  const value = useMemo(
    () => ({ workspace, dispatch, companyId, setCompanyId, savedLabel }),
    [workspace, companyId, setCompanyId, savedLabel],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider")
  return value
}

function loadWorkspace(): Workspace {
  if (typeof localStorage === "undefined") return withExpectedColumn(createSeedWorkspace())
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeedWorkspace()
    return withExpectedColumn(parseWorkspace(JSON.parse(raw) as unknown) ?? createSeedWorkspace())
  } catch {
    return createSeedWorkspace()
  }
}

function readCompanyId(): string {
  if (typeof sessionStorage === "undefined") return "all"
  try {
    return sessionStorage.getItem(COMPANY_KEY) || "all"
  } catch {
    return "all"
  }
}
