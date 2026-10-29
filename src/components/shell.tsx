import { NavLink, Outlet } from "react-router"
import { Save, Target, Users, Wallet, type LucideIcon } from "lucide-react"

import { useSession } from "@/auth/gate"
import { portcoId } from "@/data/brands"
import { listCompanies } from "@/data/metrics"
import { useWorkspace } from "@/data/store"
import { cn } from "@/lib/cn"
import { BrandMark, Button, Select } from "@/components/ui"

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/ytd", label: "YTD financial results", icon: Wallet },
  { to: "/headcount", label: "Headcount", icon: Users },
  { to: "/revenue", label: "Revenue goals", icon: Target },
]

export function Shell() {
  const session = useSession()
  const { workspace, companyId, setCompanyId, canEdit, statusLabel, statusTone, saving, save } = useWorkspace()
  const companies = listCompanies(workspace)
  const portco = companyId === "all" ? null : portcoId(companyId)
  const options = [{ value: "all", label: "All companies" }, ...companies.map((company) => ({ value: company.id, label: company.name }))]

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      <a
        href="#board-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to board
      </a>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-3 px-4 py-4">
          <BrandMark />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">The Launch Box</p>
            <p className="font-display text-[1.65rem] leading-none">Quarterly report</p>
          </div>
        </div>
        <p className="mt-2 px-4 text-[11px] uppercase tracking-widest text-muted-foreground">Boards</p>
        <nav className="mt-2 flex flex-col gap-1 px-2" aria-label="Boards">
          {NAV.map((item) => (
            <BoardLink key={item.to} {...item} />
          ))}
        </nav>
        <p className="mt-6 px-4 text-[11px] uppercase tracking-widest text-muted-foreground">Companies</p>
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-4">
          <CompanyButton active={companyId === "all"} onClick={() => setCompanyId("all")}>
            All companies
          </CompanyButton>
          {companies.map((company) => (
            <CompanyButton key={company.id} active={companyId === company.id} onClick={() => setCompanyId(company.id)}>
              <span className="swatch size-2.5 shrink-0 rounded-sm" data-brand={company.id} aria-hidden="true" />
              <span className="truncate">{company.name}</span>
            </CompanyButton>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">FY2026 · Q4 open</p>
          <Select label="Company" value={companyId} onChange={setCompanyId} options={options} className="w-[220px]" />
          <div className="ml-auto flex items-center gap-2">
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", statusTone === "warn" ? "bg-warning" : "bg-positive")} aria-hidden="true" />
              {statusLabel}
            </p>
            <p className="hidden max-w-56 truncate text-xs text-muted-foreground sm:block" title={session.email}>
              {session.email}
            </p>
            <Button variant="ghost" onClick={session.signOut}>
              Sign out
            </Button>
            {canEdit ? (
              <Button
                size="icon"
                aria-label="Save boards"
                title="Save the boards. This copy is deleted after 24 hours."
                disabled={saving}
                onClick={() => void save()}
              >
                <Save />
              </Button>
            ) : null}
          </div>
        </header>
        <main id="board-main" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <nav className="mb-4 flex flex-wrap gap-2 md:hidden" aria-label="Boards">
            {NAV.map((item) => (
              <BoardLink key={item.to} {...item} />
            ))}
          </nav>
          <div
            data-portco={portco ?? undefined}
            className={cn(portco && "rounded-lg border border-border bg-background p-4 font-sans text-foreground shadow-[inset_0_3px_0_var(--color-primary)] md:p-5")}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function BoardLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground outline-none hover:bg-bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          isActive && "bg-accent-wash text-foreground shadow-[inset_2px_0_0_var(--color-tlb-orange)]",
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap md:whitespace-normal">{label}</span>
    </NavLink>
  )
}

function CompanyButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground outline-none hover:bg-bg-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent-wash text-foreground shadow-[inset_2px_0_0_var(--color-tlb-orange)]",
      )}
    >
      {children}
    </button>
  )
}
