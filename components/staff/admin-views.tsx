'use client'

import { useMemo, useState } from 'react'
import { StaffPageHeader } from './staff-shell'
import { Card, EmptyState, Notice, Pill, SectionTitle, inputClass } from '@/components/ui-kit'
import { BottomSheet } from '@/components/bottom-sheet'
import { useStore } from '@/lib/store'
import {
  CONFIRMATION_PHRASE,
  buildAuditEntry,
  visibleAudit,
  type StaffAccount,
} from '@/lib/staff'
import {
  can,
  maskEmail,
  openTickets,
  toSupportProfileView,
} from '@/lib/support'
import { VEHICLES, CATALOGUE_SOURCE } from '@/lib/data'
import { specFor, hasAnySpecValue } from '@/lib/specs'
import { formatDate, formatRelative } from '@/lib/format'
import { supabaseConfigured } from '@/lib/supabase'
import { AnalyticsPanel } from './analytics-panel'
import { AlertTriangle, Download, Search, ShieldAlert, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

/* --------------------------------------------------------------- audit -- */

export function AuditView() {
  const { staffSession, auditLog } = useStore()
  const entries = useMemo(
    () => visibleAudit(auditLog, staffSession!.role, staffSession!.staffId),
    [auditLog, staffSession],
  )

  return (
    <div>
      <StaffPageHeader
        title="Audit log"
        subtitle={
          staffSession!.role === 'super_admin'
            ? 'Every staff action on this device.'
            : 'Your own actions. Other agents’ trails are not yours to read.'
        }
      />

      {entries.length === 0 ? (
        <EmptyState title="No entries yet">
          Actions are written here as they happen: sign-ins, ticket views, replies, status changes
          and impersonation sessions.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="p-3 font-semibold">When</th>
                <th scope="col" className="p-3 font-semibold">Staff</th>
                <th scope="col" className="p-3 font-semibold">Action</th>
                <th scope="col" className="p-3 font-semibold">Target</th>
                <th scope="col" className="p-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {formatRelative(e.createdAt)}
                  </td>
                  <td className="p-3">{e.staffName}</td>
                  <td className="p-3 font-medium">{e.action}</td>
                  <td className="p-3 text-muted-foreground">
                    {e.targetUserId ? maskEmail(e.targetUserId) : '-'}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {e.metadata ? JSON.stringify(e.metadata) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Notice tone="muted">
        The IP address column reads &quot;{entries[0]?.ipAddress ?? 'not captured (client-side build)'}&quot;
        because a browser cannot see its own public address. A server-side deployment records it;
        this build does not pretend to.
      </Notice>
    </div>
  )
}

/* -------------------------------------------------------------- lookup -- */

export function LookupView() {
  const store = useStore()
  const { staffSession, account, profile, credit } = store
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const canReveal = can(staffSession!.role, 'user.view.sensitive')

  // This build holds exactly one buyer, the account on this device. The search
  // therefore matches that account or returns nothing; it never invents rows.
  const match = useMemo(() => {
    if (!searched || !account || !profile) return null
    const q = query.trim().toLowerCase()
    if (!q) return null
    return account.email.toLowerCase().includes(q) ? { account, profile } : null
  }, [searched, query, account, profile])

  function search(e: React.FormEvent) {
    e.preventDefault()
    setSearched(true)
    setRevealed(false)
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: 'user.lookup',
        metadata: { query: query.trim().slice(0, 40) },
      }),
    )
  }

  const view = match
    ? toSupportProfileView({
        id: match.account.email,
        email: match.account.email,
        firstName: match.profile.firstName,
        lastName: match.profile.lastName,
        city: match.profile.city,
        province: match.profile.province,
        hasCreditRecord: credit.length > 0,
        bureau: credit[credit.length - 1]?.bureau,
        createdAt: match.account.since,
      })
    : null

  return (
    <div>
      <StaffPageHeader
        title="User lookup"
        subtitle="Find a buyer by email. Support sees identity and location only."
      />

      <form onSubmit={search} className="mb-4 flex max-w-lg gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Part of an email address"
            aria-label="Search buyers by email"
            className={cn(inputClass, 'pl-9')}
          />
        </div>
        <button
          type="submit"
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </form>

      {!searched ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="Search to begin">
          Every lookup is written to the audit log with the search term.
        </EmptyState>
      ) : !view ? (
        <EmptyState title="No buyer matches that">
          This build stores one buyer per device, so a search only matches the account signed in
          here. A server-backed deployment would search all profiles.
        </EmptyState>
      ) : (
        <Card className="max-w-2xl p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label="Name" value={view.fullName} />
            <Row label="Email" value={view.email} />
            <Row label="Location" value={view.location || 'Not set'} />
            <Row label="Credit bureau" value={view.creditBureau} />
            <Row label="Joined" value={formatDate(view.createdAt)} />
          </div>

          <div className="mt-4 border-t border-border pt-4">
            {canReveal ? (
              revealed ? (
                <div className="space-y-2">
                  <Pill tone="warning">Sensitive data revealed, logged</Pill>
                  <Row label="Net monthly income" value={`R ${match!.profile.monthlyIncome.toLocaleString('en-ZA')}`} />
                  <Row
                    label="Credit band"
                    value={credit.length ? `${credit[credit.length - 1].bureau}, band only` : 'None recorded'}
                  />
                  <p className="text-xs text-muted-foreground text-pretty">
                    The raw score is deliberately not shown even here. The band and the bureau are
                    what a support conversation needs.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setRevealed(true)
                    store.audit(
                      buildAuditEntry({
                        session: staffSession!,
                        action: 'user.sensitive_reveal',
                        targetUserId: view.email,
                      }),
                    )
                  }}
                  className="min-h-11 rounded-xl border border-warning/50 px-4 text-sm font-semibold text-warning-foreground transition hover:bg-warning/10"
                >
                  Reveal sensitive data
                </button>
              )
            ) : (
              <p className="flex items-start gap-2 text-xs text-muted-foreground text-pretty">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Income, credit score and documents are not available to support. If a ticket needs
                them, escalate it and record why in the thread.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-pretty">{value}</p>
    </div>
  )
}

/* --------------------------------------------------------------- admin -- */

export function AdminOverview() {
  const store = useStore()
  const { tickets, auditLog, account, credit, comparisonEvents } = store

  const live = tickets.filter((t) => !t.deletedAt)
  const missingSpecs = VEHICLES.filter((v) => !hasAnySpecValue(specFor(v.id))).length

  const kpis = [
    { label: 'Buyer accounts on this device', value: account ? '1' : '0' },
    { label: 'Open tickets', value: String(openTickets(live).length) },
    { label: 'Tickets raised, all time', value: String(live.length) },
    { label: 'Comparisons run', value: String(comparisonEvents.length) },
    { label: 'Credit recorded', value: credit.length ? 'Yes' : 'No' },
    { label: 'Audit entries', value: String(auditLog.length) },
  ]

  return (
    <div>
      <StaffPageHeader
        title="Admin overview"
        subtitle="Live traffic from the database, plus what this device holds. No figure here is simulated."
      />

      {/* Traffic first: it is the only thing on this screen that describes the
          whole product rather than this one browser. */}
      <AnalyticsPanel />

      <div className="mt-6 mb-2 flex items-center gap-2">
        <SectionTitle>This device</SectionTitle>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Data health</SectionTitle>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" aria-hidden />
              <span className="text-pretty">
                Catalogue source: <strong>{CATALOGUE_SOURCE.label}</strong>. {VEHICLES.length}{' '}
                listings, {missingSpecs} without any sourced specification.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" aria-hidden />
              {/* This line used to say flatly that there was no Supabase
                  connection. That stopped being true once auth, profiles,
                  credit history, documents and the new-car catalogue moved to
                  Postgres, so it now reports which half is which instead of
                  asserting something the app can check. */}
              <span className="text-pretty">
                {supabaseConfigured ? (
                  <>
                    Supabase is connected: sign-in, profiles, credit history, documents and the
                    brand-new catalogue read from Postgres. The counters above still describe
                    this device only, because comparisons, tickets and this staff portal are
                    unchanged and remain browser-local. No live server health is polled, so
                    nothing here is a green tick that means nothing.
                  </>
                ) : (
                  <>
                    No Supabase connection in this build, so there is no migration timestamp, no
                    live sync and no server health to report. The panel says so rather than
                    showing a green tick that means nothing.
                  </>
                )}
              </span>
            </li>
          </ul>
        </Card>

        <KillSwitches />
      </div>

      <div className="mt-4">
        <ExportPanel />
      </div>
    </div>
  )
}

function KillSwitches() {
  const store = useStore()
  const { staffSession, systemSettings } = store
  const [pending, setPending] = useState<'maintenance' | 'sessions' | null>(null)
  const [phrase, setPhrase] = useState('')

  function confirm() {
    if (phrase !== CONFIRMATION_PHRASE || !pending) return
    if (pending === 'maintenance') {
      const next = !systemSettings.maintenanceMode
      store.updateSystemSettings({ maintenanceMode: next })
      store.audit(
        buildAuditEntry({
          session: staffSession!,
          action: 'maintenance_mode',
          metadata: { enabled: next },
        }),
      )
    } else {
      store.audit(buildAuditEntry({ session: staffSession!, action: 'sessions.revoked' }))
      store.revokeAllStaffSessions()
    }
    setPending(null)
    setPhrase('')
  }

  return (
    <Card className="border-destructive/30 p-4">
      <SectionTitle>Emergency controls</SectionTitle>
      <div className="space-y-2">
        <button
          onClick={() => setPending('maintenance')}
          className="min-h-11 w-full rounded-xl border border-destructive/50 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
        >
          {systemSettings.maintenanceMode ? 'Disable maintenance mode' : 'Enable maintenance mode'}
        </button>
        <button
          onClick={() => setPending('sessions')}
          className="min-h-11 w-full rounded-xl border border-destructive/50 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
        >
          Revoke all staff sessions
        </button>
        <p className="text-xs text-muted-foreground text-pretty">
          Maintenance mode shows every buyer a static page; the staff portal stays reachable.
          Revoking sessions signs out every staff member including you.
        </p>
      </div>

      {pending && (
        <BottomSheet
          title={pending === 'maintenance' ? 'Change maintenance mode' : 'Revoke all staff sessions'}
          onClose={() => {
            setPending(null)
            setPhrase('')
          }}
        >
          <div className="space-y-3">
            <p className="text-sm text-pretty">
              {pending === 'maintenance'
                ? systemSettings.maintenanceMode
                  ? 'Buyers will regain access immediately.'
                  : 'Every buyer loses access to the app until this is switched off. Their data is untouched.'
                : 'Every staff member, including you, is signed out immediately and must sign in again.'}
            </p>
            <label htmlFor="kill-phrase" className="block text-sm font-medium">
              Type <span className="font-semibold">{CONFIRMATION_PHRASE}</span> to continue
            </label>
            <input
              id="kill-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className={inputClass}
              autoFocus
            />
            <button
              onClick={confirm}
              disabled={phrase !== CONFIRMATION_PHRASE}
              className="min-h-11 w-full rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground transition disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        </BottomSheet>
      )}
    </Card>
  )
}

function ExportPanel() {
  const store = useStore()
  const { staffSession, tickets, comparisonEvents } = store

  function exportCsv() {
    // Aggregates only: counts by category and by brand. No emails, no scores,
    // no incomes, and no per-user rows.
    const byCategory = new Map<string, number>()
    for (const t of tickets.filter((x) => !x.deletedAt)) {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1)
    }
    const byBrand = new Map<string, number>()
    for (const event of comparisonEvents) {
      for (const id of event.carIds) {
        const make = VEHICLES.find((v) => v.id === id)?.make
        if (make) byBrand.set(make, (byBrand.get(make) ?? 0) + 1)
      }
    }

    const lines = ['metric,key,count']
    for (const [k, v] of byCategory) lines.push(`tickets_by_category,${k},${v}`)
    for (const [k, v] of byBrand) lines.push(`comparisons_by_brand,${k},${v}`)

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '1st-buyer-aggregates.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    store.audit(buildAuditEntry({ session: staffSession!, action: 'analytics.export' }))
  }

  return (
    <Card className="p-4">
      <SectionTitle>Analytics export</SectionTitle>
      <p className="mb-3 text-xs text-muted-foreground text-pretty">
        Aggregated counts only: tickets by category and comparisons by brand. The file contains no
        email addresses, no credit scores and no incomes, and the download is logged.
      </p>
      <button
        onClick={exportCsv}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:border-primary/40"
      >
        <Download className="h-4 w-4" aria-hidden /> Download CSV
      </button>
    </Card>
  )
}

/* ------------------------------------------------------- staff accounts -- */

export function StaffAccountsView() {
  const store = useStore()
  const { staffSession, staffAccounts } = store
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'support' | 'super_admin'>('support')
  const [issued, setIssued] = useState<StaffAccount | null>(null)

  function invite(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !name.trim()) return
    // A real deployment mails an invite and forces a reset on first sign-in.
    // Here the passcode is shown once to the admin, which is stated plainly.
    const passcode = Math.random().toString(36).slice(2, 10)
    const account: StaffAccount = {
      id: `staff-${Date.now()}`,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      passcode,
      active: true,
      createdAt: new Date().toISOString(),
      totpEnrolled: false,
    }
    store.upsertStaffAccount(account)
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: 'staff.invite',
        metadata: { email: account.email, role },
      }),
    )
    setIssued(account)
    setEmail('')
    setName('')
  }

  return (
    <div>
      <StaffPageHeader
        title="Staff accounts"
        subtitle="Provisioned here only. There is no staff sign-up anywhere in the product."
        action={
          <button
            onClick={() => setInviteOpen(true)}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Add staff
          </button>
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 font-semibold">Name</th>
              <th scope="col" className="p-3 font-semibold">Email</th>
              <th scope="col" className="p-3 font-semibold">Role</th>
              <th scope="col" className="p-3 font-semibold">Status</th>
              <th scope="col" className="p-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {staffAccounts.map((a) => (
              <tr key={a.id}>
                <td className="p-3 font-medium">{a.name}</td>
                <td className="p-3 text-muted-foreground">{a.email}</td>
                <td className="p-3">
                  <Pill tone={a.role === 'super_admin' ? 'warning' : 'muted'}>
                    {a.role === 'super_admin' ? 'Super admin' : 'Support'}
                  </Pill>
                </td>
                <td className="p-3">
                  <Pill tone={a.active ? 'success' : 'destructive'}>
                    {a.active ? 'Active' : 'Revoked'}
                  </Pill>
                </td>
                <td className="p-3">
                  {a.id === staffSession!.staffId ? (
                    <span className="text-xs text-muted-foreground">
                      You cannot revoke yourself
                    </span>
                  ) : a.active ? (
                    <button
                      onClick={() => {
                        store.revokeStaffAccount(a.id)
                        store.audit(
                          buildAuditEntry({
                            session: staffSession!,
                            action: 'staff.revoke',
                            metadata: { email: a.email },
                          }),
                        )
                      }}
                      className="min-h-11 text-sm font-semibold text-destructive"
                    >
                      Revoke access
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Kept for the audit trail</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Notice tone="warning">
        Real deployments require TOTP for every staff account and send an invite email that forces a
        password reset. Neither exists in this build, so these accounts are passcode-only and are a
        workflow model, not a security boundary.
      </Notice>

      {inviteOpen && (
        <BottomSheet title="Add a staff member" onClose={() => setInviteOpen(false)}>
          <form onSubmit={invite} className="space-y-3">
            <div>
              <label htmlFor="invite-name" className="block text-sm font-medium">Name</label>
              <input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium">Email</label>
              <input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium">Role</label>
              <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as 'support' | 'super_admin')} className={inputClass}>
                <option value="support">Support</option>
                <option value="super_admin">Super admin</option>
              </select>
            </div>
            <button type="submit" className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
              Create account
            </button>
          </form>

          {issued && (
            <Notice tone="warning">
              Passcode for {issued.email}: <strong className="font-mono">{issued.passcode}</strong>.
              Shown once. In a real deployment this would be an invite email and a forced reset.
            </Notice>
          )}
        </BottomSheet>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ settings -- */

export function SettingsView() {
  const store = useStore()
  const { staffSession, systemSettings } = store
  const [draft, setDraft] = useState(systemSettings)
  const [saved, setSaved] = useState(false)

  function save() {
    store.updateSystemSettings(draft)
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: 'system_setting_changed',
        metadata: { keys: Object.keys(draft).join(',') },
      }),
    )
    setSaved(true)
  }

  return (
    <div>
      <StaffPageHeader title="System settings" subtitle="Stored per device in this build." />

      <Card className="max-w-2xl space-y-4 p-4">
        <div>
          <label htmlFor="trigger" className="block text-sm font-medium">
            Staff gate trigger text
          </label>
          <input
            id="trigger"
            value={draft.triggerText}
            onChange={(e) => setDraft({ ...draft, triggerText: e.target.value })}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The fine print on the sign-in screen that opens the staff sheet after three clicks.
          </p>
        </div>

        <div>
          <label htmlFor="session-hours" className="block text-sm font-medium">
            Staff session timeout (hours)
          </label>
          <input
            id="session-hours"
            type="number"
            min={1}
            max={24}
            value={draft.staffSessionHours}
            onChange={(e) => setDraft({ ...draft, staffSessionHours: Number(e.target.value) })}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="fuel" className="block text-sm font-medium">
            Default fuel price used by Car Compare (R/l)
          </label>
          <input
            id="fuel"
            type="number"
            step="0.10"
            min={1}
            value={draft.fuelPriceDefault}
            onChange={(e) => setDraft({ ...draft, fuelPriceDefault: Number(e.target.value) })}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['P0', 'P1', 'P2', 'P3'] as const).map((p) => (
            <div key={p}>
              <label htmlFor={`sla-${p}`} className="block text-sm font-medium">
                {p} SLA (h)
              </label>
              <input
                id={`sla-${p}`}
                type="number"
                min={1}
                value={draft.slaHours[p]}
                onChange={(e) =>
                  setDraft({ ...draft, slaHours: { ...draft.slaHours, [p]: Number(e.target.value) } })
                }
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="maintenance-message" className="block text-sm font-medium">
            Maintenance message
          </label>
          <textarea
            id="maintenance-message"
            value={draft.maintenanceMessage}
            onChange={(e) => setDraft({ ...draft, maintenanceMessage: e.target.value })}
            className={cn(inputClass, 'min-h-24 resize-y')}
          />
        </div>

        <button onClick={save} className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          Save settings
        </button>
        {saved && <p role="status" className="text-xs font-medium text-success">Saved and logged.</p>}
      </Card>
    </div>
  )
}

/* ------------------------------------------------- content and rules ----- */

export function ContentView() {
  const store = useStore()
  const { staffSession, contentSnippets, supportSnippets, guardianRules } = store
  const [content, setContent] = useState(contentSnippets)
  const [note, setNote] = useState('')

  function saveContent() {
    store.updateContent(content)
    store.audit(buildAuditEntry({ session: staffSession!, action: 'content_changed' }))
    setNote('Honest-absence copy saved.')
  }

  return (
    <div>
      <StaffPageHeader
        title="Content and rules"
        subtitle="Copy and Chatbot keywords that can change without a deployment."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <SectionTitle>Honest-absence copy</SectionTitle>
          {(
            [
              ['reliabilityAbsent', 'Reliability missing'],
              ['marketContextAbsent', 'Market context missing'],
              ['serviceNetworkAbsent', 'Service network missing'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key} className="block text-sm font-medium">{label}</label>
              <input
                id={key}
                value={content[key]}
                onChange={(e) => setContent({ ...content, [key]: e.target.value })}
                className={inputClass}
              />
            </div>
          ))}
          <button onClick={saveContent} className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            Save copy
          </button>
          {note && <p role="status" className="text-xs font-medium text-success">{note}</p>}
        </Card>

        <Card className="space-y-3 p-4">
          <SectionTitle>Chatbot rules</SectionTitle>
          <p className="text-xs text-muted-foreground text-pretty">
            Toggling a rule here records the intent. The compiled rules in lib/guardian.ts are the
            live behaviour in this build; wiring the toggle to the matcher needs the rules table in
            the migration set. This panel does not pretend a disabled rule stops firing.
          </p>
          <ul className="space-y-2">
            {guardianRules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5">
                <span className="text-sm font-medium capitalize">{rule.label}</span>
                <button
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`${rule.label} rule`}
                  onClick={() => {
                    store.setGuardianRules(
                      guardianRules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
                    )
                    store.audit(
                      buildAuditEntry({
                        session: staffSession!,
                        action: 'guardian_rule_changed',
                        metadata: { rule: rule.id, enabled: !rule.enabled },
                      }),
                    )
                  }}
                  className={cn(
                    'relative h-7 w-12 shrink-0 rounded-full border transition',
                    rule.enabled ? 'border-primary bg-primary' : 'border-border bg-muted',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all',
                      rule.enabled ? 'left-6' : 'left-0.5',
                    )}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-4 lg:col-span-2">
          <SectionTitle>Support snippets</SectionTitle>
          <ul className="space-y-2">
            {supportSnippets.map((s) => (
              <li key={s.id} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground text-pretty">{s.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
