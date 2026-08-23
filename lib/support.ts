// Support tickets: the shared domain between the consumer help screen and the
// staff portal. Pure functions only, so both sides compute SLA, masking and
// permissions from one definition rather than two that can drift.

export type TicketCategory =
  | 'Payment issue'
  | 'App bug'
  | 'Vehicle query'
  | 'Credit and finance'
  | 'Account and data'
  | 'Something else'

export const TICKET_CATEGORIES: TicketCategory[] = [
  'Payment issue',
  'App bug',
  'Vehicle query',
  'Credit and finance',
  'Account and data',
  'Something else',
]

export type TicketPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_user'
  | 'resolved'
  | 'escalated'

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_user: 'Waiting on you',
  resolved: 'Resolved',
  escalated: 'Escalated',
}

/** Response targets by priority. Editable in the staff settings panel. */
export const DEFAULT_SLA_HOURS: Record<TicketPriority, number> = {
  P0: 4,
  P1: 24,
  P2: 72,
  P3: 168,
}

export type TicketReply = {
  id: string
  ticketId: string
  /** 'user' replies are visible to everyone; 'staff' too. */
  author: 'user' | 'staff'
  authorName: string
  body: string
  /** Internal notes are staff-only and never rendered to the buyer. */
  internal: boolean
  createdAt: string
}

export type Ticket = {
  id: string
  reference: string
  userEmail: string
  userName: string
  category: TicketCategory
  subject: string
  body: string
  priority: TicketPriority
  status: TicketStatus
  assignedTo: string | null
  /** Optional context the buyer attached: a comparison or a quotation id. */
  linkedComparisonId?: string
  linkedQuotationId?: string
  createdAt: string
  updatedAt: string
  slaDeadline: string
  deletedAt?: string
}

/* --------------------------------------------------------------- create -- */

let referenceCounter = 0

/** Human-quotable reference. Deterministic input, so tests can pin it. */
export function ticketReference(now: Date, seq = ++referenceCounter): string {
  const stamp = `${now.getFullYear()}`.slice(2) + String(now.getMonth() + 1).padStart(2, '0')
  return `BUY-${stamp}-${String(seq).padStart(4, '0')}`
}

export function slaDeadline(
  priority: TicketPriority,
  createdAt: Date,
  hoursByPriority: Record<TicketPriority, number> = DEFAULT_SLA_HOURS,
): string {
  const hours = hoursByPriority[priority] ?? DEFAULT_SLA_HOURS.P3
  return new Date(createdAt.getTime() + hours * 3600 * 1000).toISOString()
}

/**
 * Priority is assigned by the system, not chosen by the reporter: a buyer
 * cannot mark their own question P0, and we do not pretend they can.
 */
export function priorityFor(category: TicketCategory): TicketPriority {
  switch (category) {
    case 'Payment issue':
      return 'P1'
    case 'Account and data':
      return 'P1'
    case 'App bug':
      return 'P2'
    case 'Credit and finance':
      return 'P2'
    default:
      return 'P3'
  }
}

export type NewTicketInput = {
  userEmail: string
  userName: string
  category: TicketCategory
  subject: string
  body: string
  linkedComparisonId?: string
  linkedQuotationId?: string
}

export function createTicket(
  input: NewTicketInput,
  now: Date = new Date(),
  id: string = crypto.randomUUID(),
  reference: string = ticketReference(now),
): Ticket {
  const priority = priorityFor(input.category)
  return {
    id,
    reference,
    userEmail: input.userEmail,
    userName: input.userName,
    category: input.category,
    subject: input.subject.trim().slice(0, 120),
    body: input.body.trim().slice(0, 4000),
    priority,
    status: 'open',
    assignedTo: null,
    linkedComparisonId: input.linkedComparisonId,
    linkedQuotationId: input.linkedQuotationId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    slaDeadline: slaDeadline(priority, now),
  }
}

export type TicketValidation = { valid: boolean; errors: Record<string, string> }

export function validateTicket(input: Partial<NewTicketInput>): TicketValidation {
  const errors: Record<string, string> = {}
  if (!input.category) errors.category = 'Choose the closest category.'
  if (!input.subject?.trim()) errors.subject = 'Give it a one-line summary.'
  else if (input.subject.trim().length < 6) errors.subject = 'A few more words, please.'
  if (!input.body?.trim()) errors.body = 'Tell us what happened.'
  else if (input.body.trim().length < 20)
    errors.body = 'A little more detail helps us answer without a back and forth.'
  return { valid: Object.keys(errors).length === 0, errors }
}

/* ---------------------------------------------------------------- state -- */

export function isOverdue(ticket: Ticket, now: Date = new Date()): boolean {
  if (ticket.status === 'resolved') return false
  return new Date(ticket.slaDeadline).getTime() < now.getTime()
}

export function slaRemainingHours(ticket: Ticket, now: Date = new Date()): number {
  return (new Date(ticket.slaDeadline).getTime() - now.getTime()) / 3600000
}

export function openTickets(tickets: readonly Ticket[]): Ticket[] {
  return tickets.filter((t) => !t.deletedAt && t.status !== 'resolved')
}

/* --------------------------------------------------------------- masking -- */

/**
 * Staff see a masked address by default. Enough to recognise a person who has
 * just quoted their own email in chat, not enough to harvest a mailing list.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const head = local.slice(0, 1)
  return `${head}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 3)))}@${domain}`
}

/* ----------------------------------------------------------- permissions -- */

export type StaffRole = 'buyer' | 'support' | 'super_admin'

export type Capability =
  | 'ticket.view.assigned'
  | 'ticket.view.all'
  | 'ticket.reply'
  | 'ticket.status'
  | 'ticket.assign'
  | 'ticket.escalate'
  | 'ticket.note'
  | 'ticket.delete'
  | 'user.lookup.masked'
  | 'user.view.sensitive'
  | 'user.suspend'
  | 'impersonate.readonly'
  | 'staff.manage'
  | 'settings.manage'
  | 'content.manage'
  | 'guardian.rules.manage'
  | 'analytics.self'
  | 'analytics.team'
  | 'analytics.export'
  | 'catalogue.manage'
  | 'killswitch'

const SUPPORT_CAPABILITIES: Capability[] = [
  'ticket.view.assigned',
  'ticket.reply',
  'ticket.status',
  'ticket.assign',
  'ticket.escalate',
  'ticket.note',
  'user.lookup.masked',
  'impersonate.readonly',
  'analytics.self',
]

const SUPER_ADMIN_CAPABILITIES: Capability[] = [
  ...SUPPORT_CAPABILITIES,
  'ticket.view.all',
  'ticket.delete',
  'user.view.sensitive',
  'user.suspend',
  'staff.manage',
  'settings.manage',
  'content.manage',
  'guardian.rules.manage',
  'analytics.team',
  'analytics.export',
  'catalogue.manage',
  'killswitch',
]

export function capabilitiesFor(role: StaffRole): Capability[] {
  if (role === 'super_admin') return SUPER_ADMIN_CAPABILITIES
  if (role === 'support') return SUPPORT_CAPABILITIES
  return []
}

export function can(role: StaffRole, capability: Capability): boolean {
  return capabilitiesFor(role).includes(capability)
}

export function isStaff(role: StaffRole | undefined | null): role is 'support' | 'super_admin' {
  return role === 'support' || role === 'super_admin'
}

/**
 * Which ticket rows a given staff member may see. Support sees their own work
 * and the unassigned queue; another agent's closed tickets are not theirs to
 * read unless the ticket was escalated.
 */
export function visibleTickets(
  tickets: readonly Ticket[],
  role: StaffRole,
  staffId: string,
): Ticket[] {
  const live = tickets.filter((t) => !t.deletedAt)
  if (role === 'super_admin') return live
  if (role !== 'support') return []
  return live.filter(
    (t) => t.assignedTo === staffId || t.assignedTo === null || t.status === 'escalated',
  )
}

/** Replies a buyer may read: internal notes never leave the staff portal. */
export function repliesForUser(replies: readonly TicketReply[]): TicketReply[] {
  return replies.filter((r) => !r.internal)
}

/* ---------------------------------------------------- profile redaction -- */

/** Columns support may read. Mirrors the RLS policy on profiles. */
export const SUPPORT_VISIBLE_PROFILE_FIELDS = [
  'id',
  'email',
  'fullName',
  'location',
  'creditBureau',
  'createdAt',
  'updatedAt',
] as const

export type SupportProfileView = {
  id: string
  email: string
  fullName: string
  location: string
  creditBureau: string
  createdAt: string
  updatedAt: string
}

/**
 * Build the support-visible view of a buyer. The sensitive fields are not
 * redacted here, they are never read: this function cannot return a score or an
 * income because it does not accept them.
 */
export function toSupportProfileView(input: {
  id: string
  email: string
  firstName: string
  lastName: string
  city: string
  province: string
  hasCreditRecord: boolean
  bureau?: string
  createdAt: string
  updatedAt?: string
}): SupportProfileView {
  return {
    id: input.id,
    email: maskEmail(input.email),
    fullName: `${input.firstName} ${input.lastName}`.trim(),
    location: [input.city, input.province].filter(Boolean).join(', '),
    creditBureau: input.hasCreditRecord ? (input.bureau ?? 'Recorded') : 'Not connected',
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
  }
}
