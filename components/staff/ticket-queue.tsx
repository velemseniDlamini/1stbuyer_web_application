'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { StaffPageHeader } from './staff-shell'
import { Card, EmptyState, Notice, Pill, inputClass } from '@/components/ui-kit'
import { BottomSheet } from '@/components/bottom-sheet'
import { useStore } from '@/lib/store'
import { buildAuditEntry } from '@/lib/staff'
import {
  TICKET_STATUS_LABELS,
  can,
  isOverdue,
  maskEmail,
  slaRemainingHours,
  visibleTickets,
  type Ticket,
  type TicketStatus,
} from '@/lib/support'
import { formatRelative } from '@/lib/format'
import { Eye, LifeBuoy, Lock, Send, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_user', 'resolved', 'escalated']

export function TicketQueue() {
  const store = useStore()
  const { staffSession, tickets, staffAccounts } = store
  const params = useSearchParams()
  const denied = params.get('denied') === '1'

  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<Ticket | null>(null)

  const role = staffSession!.role
  const mine = useMemo(
    () => visibleTickets(tickets, role, staffSession!.staffId),
    [tickets, role, staffSession],
  )
  const rows = useMemo(
    () =>
      mine
        .filter((t) => statusFilter === 'all' || t.status === statusFilter)
        .sort((a, b) => new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime()),
    [mine, statusFilter],
  )

  const openTicket = rows.find((t) => t.id === openId) ?? mine.find((t) => t.id === openId) ?? null

  function openDetail(ticket: Ticket) {
    setOpenId(ticket.id)
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: 'ticket.view',
        metadata: { ticket: ticket.reference },
      }),
    )
  }

  return (
    <div>
      <StaffPageHeader
        title="Ticket queue"
        subtitle={
          role === 'super_admin'
            ? 'Every ticket across all agents.'
            : 'Tickets assigned to you, plus the unassigned queue and anything escalated.'
        }
      />

      {denied && (
        <Notice tone="warning">You do not have access to that area.</Notice>
      )}

      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          All ({mine.length})
        </FilterChip>
        {STATUSES.map((status) => (
          <FilterChip
            key={status}
            active={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          >
            {TICKET_STATUS_LABELS[status]} ({mine.filter((t) => t.status === status).length})
          </FilterChip>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<LifeBuoy className="h-8 w-8" />} title="Nothing in this view">
          When a buyer raises a ticket it lands here. Nothing is seeded: this queue shows real
          tickets from this device only.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">Support tickets, earliest deadline first</caption>
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="p-3 font-semibold">Reference</th>
                <th scope="col" className="p-3 font-semibold">Buyer</th>
                <th scope="col" className="p-3 font-semibold">Category</th>
                <th scope="col" className="p-3 font-semibold">Priority</th>
                <th scope="col" className="p-3 font-semibold">Status</th>
                <th scope="col" className="p-3 font-semibold">Assigned</th>
                <th scope="col" className="p-3 font-semibold">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((ticket) => {
                const overdue = isOverdue(ticket)
                const hours = slaRemainingHours(ticket)
                const agent = staffAccounts.find((a) => a.id === ticket.assignedTo)
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => openDetail(ticket)}
                    className="cursor-pointer transition hover:bg-muted/50"
                  >
                    <td className="p-3 font-medium tabular-nums">{ticket.reference}</td>
                    {/* Masked by default: enough to recognise, not to harvest. */}
                    <td className="p-3 text-muted-foreground">{maskEmail(ticket.userEmail)}</td>
                    <td className="p-3">{ticket.category}</td>
                    <td className="p-3">
                      <Pill tone={ticket.priority === 'P0' || ticket.priority === 'P1' ? 'warning' : 'muted'}>
                        {ticket.priority}
                      </Pill>
                    </td>
                    <td className="p-3">
                      <Pill tone={ticket.status === 'resolved' ? 'success' : 'muted'}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Pill>
                    </td>
                    <td className="p-3 text-muted-foreground">{agent?.name ?? 'Unassigned'}</td>
                    <td className={cn('p-3 tabular-nums', overdue && 'font-semibold text-destructive')}>
                      {ticket.status === 'resolved'
                        ? 'Met'
                        : overdue
                          ? `${Math.abs(Math.round(hours))}h over`
                          : `${Math.round(hours)}h left`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {openTicket && (
        <TicketDetail
          ticket={openTicket}
          onClose={() => setOpenId(null)}
          onImpersonate={() => setImpersonating(openTicket)}
        />
      )}

      {impersonating && (
        <ImpersonationOverlay ticket={impersonating} onClose={() => setImpersonating(null)} />
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-11 rounded-full border px-3 text-xs font-semibold transition',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

function TicketDetail({
  ticket,
  onClose,
  onImpersonate,
}: {
  ticket: Ticket
  onClose: () => void
  onImpersonate: () => void
}) {
  const store = useStore()
  const { staffSession, ticketReplies, supportSnippets, staffAccounts } = store
  const role = staffSession!.role
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)

  const thread = ticketReplies.filter((r) => r.ticketId === ticket.id)

  function send() {
    if (!reply.trim()) return
    store.addTicketReply({
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      author: 'staff',
      authorName: staffSession!.name,
      body: reply.trim(),
      internal,
      createdAt: new Date().toISOString(),
    })
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: internal ? 'ticket.note' : 'ticket.reply',
        metadata: { ticket: ticket.reference },
      }),
    )
    if (!internal && ticket.status === 'open') {
      store.updateTicket(ticket.id, { status: 'in_progress', assignedTo: staffSession!.staffId })
    }
    setReply('')
  }

  function changeStatus(status: TicketStatus) {
    store.updateTicket(ticket.id, { status })
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: 'ticket.status_change',
        metadata: { ticket: ticket.reference, status },
      }),
    )
  }

  return (
    <BottomSheet title={`${ticket.reference}: ${ticket.subject}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Pill tone="muted">{ticket.category}</Pill>
          <Pill tone="muted">{ticket.priority}</Pill>
          <Pill tone={ticket.status === 'resolved' ? 'success' : 'muted'}>
            {TICKET_STATUS_LABELS[ticket.status]}
          </Pill>
          <Pill tone="muted">{maskEmail(ticket.userEmail)}</Pill>
        </div>

        <Card className="p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Buyer&apos;s message
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-pretty">{ticket.body}</p>
        </Card>

        {thread.length > 0 && (
          <div className="space-y-2">
            {thread.map((r) => (
              <Card
                key={r.id}
                className={cn(
                  'p-3',
                  r.internal && 'border-warning/40 bg-warning/10',
                  !r.internal && r.author === 'staff' && 'border-primary/30',
                )}
              >
                <p className="flex items-center gap-2 text-xs font-semibold">
                  {r.authorName}
                  {r.internal && (
                    <span className="inline-flex items-center gap-1 text-warning-foreground">
                      <Lock className="h-3 w-3" aria-hidden /> Internal note
                    </span>
                  )}
                  <span className="font-normal text-muted-foreground">
                    {formatRelative(r.createdAt)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-pretty">{r.body}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Canned responses, managed by super admins */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Snippets
          </p>
          <div className="flex flex-wrap gap-2">
            {supportSnippets.map((s) => (
              <button
                key={s.id}
                onClick={() => setReply((r) => (r ? `${r}\n\n${s.body}` : s.body))}
                className="min-h-11 rounded-full border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="staff-reply" className="block text-sm font-medium">
            Reply
          </label>
          <textarea
            id="staff-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className={cn(inputClass, 'min-h-28 resize-y')}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="inline-flex items-center gap-1">
              <StickyNote className="h-3.5 w-3.5" aria-hidden />
              Internal note, never shown to the buyer
            </span>
          </label>
          <button
            onClick={send}
            disabled={!reply.trim()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden /> {internal ? 'Save note' : 'Send reply'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Change status"
            value={ticket.status}
            onChange={(e) => changeStatus(e.target.value as TicketStatus)}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Assign to"
            value={ticket.assignedTo ?? ''}
            onChange={(e) => {
              store.updateTicket(ticket.id, { assignedTo: e.target.value || null })
              store.audit(
                buildAuditEntry({
                  session: staffSession!,
                  action: 'ticket.assign',
                  metadata: { ticket: ticket.reference, to: e.target.value || 'unassigned' },
                }),
              )
            }}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {staffAccounts
              .filter((a) => a.active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>

        <button
          onClick={onImpersonate}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
        >
          <Eye className="h-4 w-4" aria-hidden /> View as user, read only
        </button>

        {can(role, 'ticket.delete') && (
          <button
            onClick={() => {
              store.softDeleteTicket(ticket.id)
              store.audit(
                buildAuditEntry({
                  session: staffSession!,
                  action: 'ticket.delete',
                  metadata: { ticket: ticket.reference },
                }),
              )
              onClose()
            }}
            className="min-h-11 w-full rounded-xl border border-destructive/40 text-sm font-semibold text-destructive transition hover:bg-destructive/10"
          >
            Soft-delete ticket
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

/**
 * Read-only diagnostic view. It shows what the buyer's dashboard reports, with
 * no action available and a permanent banner. In this build the store holds one
 * buyer, so the overlay reads that state and says so rather than pretending to
 * have fetched another person's account.
 */
function ImpersonationOverlay({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const store = useStore()
  const { staffSession, profile, currentScore, savedVehicleIds, documents } = store
  const startedAt = useMemo(() => new Date(), [])

  useState(() => {
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: 'impersonation.start',
        targetUserId: ticket.userEmail,
        metadata: { ticket: ticket.reference },
      }),
    )
    return null
  })

  function end() {
    store.audit(
      buildAuditEntry({
        session: staffSession!,
        action: 'impersonation.end',
        targetUserId: ticket.userEmail,
        metadata: { ticket: ticket.reference },
      }),
    )
    onClose()
  }

  const sameDevice = store.account?.email === ticket.userEmail

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-destructive px-4 py-3 text-destructive-foreground">
        <p className="text-sm font-semibold">
          IMPERSONATION MODE, {staffSession!.name}, {startedAt.toLocaleString('en-ZA')}. All actions
          logged.
        </p>
        <button
          onClick={end}
          className="min-h-11 rounded-lg border border-destructive-foreground/40 px-3 text-sm font-semibold"
        >
          End session
        </button>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {!sameDevice ? (
          <Notice tone="warning">
            <strong className="font-semibold">Nothing to show.</strong> This build stores one
            buyer&apos;s data per device, and the account that raised {ticket.reference} is not the
            account signed in here. A server-backed deployment would load their dashboard read-only;
            we will not fabricate one.
          </Notice>
        ) : (
          <>
            <Notice tone="warning">
              Read-only diagnostic view. You cannot act for this buyer from here, by design.
            </Notice>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyStat label="Name" value={`${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || 'Not set'} />
              <ReadOnlyStat label="City" value={profile?.city ?? 'Not set'} />
              <ReadOnlyStat
                label="Credit score recorded"
                value={currentScore ? 'Yes' : 'No'}
              />
              <ReadOnlyStat label="Saved cars" value={String(savedVehicleIds.length)} />
              <ReadOnlyStat
                label="Finance pack"
                value={`${documents.filter((d) => d.status === 'added').length} of ${documents.length} recorded`}
              />
            </div>
            <Notice tone="muted">
              The score itself, the income and the document contents are not shown here. Support
              does not need them to diagnose a problem, so the view does not carry them.
            </Notice>
          </>
        )}
      </div>
    </div>
  )
}

function ReadOnlyStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </Card>
  )
}
