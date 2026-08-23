import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { staffPersonas } from '../lib/staff-demo'

import {
  DEFAULT_SLA_HOURS,
  can,
  capabilitiesFor,
  createTicket,
  isOverdue,
  isStaff,
  maskEmail,
  priorityFor,
  repliesForUser,
  slaDeadline,
  toSupportProfileView,
  validateTicket,
  visibleTickets,
  type Ticket,
  type TicketReply,
} from '../lib/support'
import {
  GENERIC_SIGN_IN_ERROR,
  SEED_STAFF,
  authenticateStaff,
  buildAuditEntry,
  lockoutState,
  registerTriggerClick,
  sessionExpired,
  visibleAudit,
  type AttemptLog,
  type StaffSession,
} from '../lib/staff'

const NOW = new Date('2026-08-21T09:00:00.000Z')

function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    ...createTicket(
      {
        userEmail: 'buyer@example.co.za',
        userName: 'Buyer',
        category: 'App bug',
        subject: 'Something is broken',
        body: 'The instalment figure does not match the one on the card.',
      },
      NOW,
      'ticket-1',
      'BUY-2608-0001',
    ),
    ...over,
  }
}

const session: StaffSession = {
  staffId: 'staff-support',
  role: 'support',
  name: 'Naledi Khumalo',
  email: 'support@1stbuyer.test',
  startedAt: NOW.toISOString(),
  lastActiveAt: NOW.toISOString(),
}

/* ------------------------------------------------------------- tickets -- */

describe('ticket creation', () => {
  it('assigns priority from category, not from the reporter', () => {
    assert.equal(priorityFor('Payment issue'), 'P1')
    assert.equal(priorityFor('App bug'), 'P2')
    assert.equal(priorityFor('Something else'), 'P3')
    assert.equal(createTicket({ userEmail: 'a@b.co', userName: 'A', category: 'Payment issue', subject: 'Charged twice', body: 'I was charged twice for the same thing today.' }, NOW).priority, 'P1')
  })

  it('sets the SLA deadline from the priority table', () => {
    const deadline = slaDeadline('P1', NOW)
    const expected = new Date(NOW.getTime() + DEFAULT_SLA_HOURS.P1 * 3600 * 1000).toISOString()
    assert.equal(deadline, expected)
  })

  it('starts open and unassigned', () => {
    const t = ticket()
    assert.equal(t.status, 'open')
    assert.equal(t.assignedTo, null)
  })

  it('rejects a thin report but accepts a real one', () => {
    assert.equal(validateTicket({}).valid, false)
    assert.equal(validateTicket({ category: 'App bug', subject: 'Hi', body: 'short' }).valid, false)
    assert.equal(
      validateTicket({
        category: 'App bug',
        subject: 'Instalment looks wrong',
        body: 'The compare screen shows a different number to the card in Explore.',
      }).valid,
      true,
    )
  })

  it('knows when it has breached its SLA, and never for a resolved ticket', () => {
    const late = new Date(NOW.getTime() + 100 * 3600 * 1000)
    assert.equal(isOverdue(ticket(), late), true)
    assert.equal(isOverdue(ticket({ status: 'resolved' }), late), false)
  })
})

/* -------------------------------------------------------- masking/RBAC -- */

describe('buyer data exposure', () => {
  it('masks the local part of an email but keeps the domain', () => {
    assert.equal(maskEmail('thandi@gmail.com'), 't***@gmail.com')
    assert.equal(maskEmail('jo@work.co.za'), 'j**@work.co.za')
    assert.equal(maskEmail('not-an-email'), '***')
  })

  it('builds a support view that cannot carry financial data', () => {
    const view = toSupportProfileView({
      id: 'buyer-1',
      email: 'thandi@example.co.za',
      firstName: 'Thandi',
      lastName: 'Mokoena',
      city: 'Johannesburg',
      province: 'Gauteng',
      hasCreditRecord: true,
      bureau: 'TransUnion',
      createdAt: NOW.toISOString(),
    })
    assert.deepEqual(Object.keys(view).sort(), [
      'createdAt',
      'creditBureau',
      'email',
      'fullName',
      'location',
      'id',
      'updatedAt',
    ].sort())
    for (const forbidden of ['creditScore', 'score', 'monthlyIncome', 'income', 'idNumber']) {
      assert.equal(forbidden in view, false, `${forbidden} leaked into the support view`)
    }
    assert.equal(view.email, 't***@example.co.za')
  })
})

describe('capabilities', () => {
  it('gives support a working set without any admin power', () => {
    assert.equal(can('support', 'ticket.reply'), true)
    assert.equal(can('support', 'impersonate.readonly'), true)
    for (const forbidden of [
      'ticket.delete',
      'user.view.sensitive',
      'staff.manage',
      'settings.manage',
      'catalogue.manage',
      'analytics.export',
      'killswitch',
    ] as const) {
      assert.equal(can('support', forbidden), false, `support should not have ${forbidden}`)
    }
  })

  it('gives super admin everything support has, and more', () => {
    for (const capability of capabilitiesFor('support')) {
      assert.equal(can('super_admin', capability), true)
    }
    assert.equal(can('super_admin', 'killswitch'), true)
  })

  it('gives a buyer nothing at all', () => {
    assert.deepEqual(capabilitiesFor('buyer'), [])
    assert.equal(isStaff('buyer'), false)
    assert.equal(isStaff(undefined), false)
    assert.equal(isStaff('support'), true)
  })

  it('shows support only its own queue, unassigned work and escalations', () => {
    const tickets = [
      ticket({ id: 'mine', assignedTo: 'staff-support' }),
      ticket({ id: 'unassigned', assignedTo: null }),
      ticket({ id: 'other', assignedTo: 'staff-other' }),
      ticket({ id: 'escalated', assignedTo: 'staff-other', status: 'escalated' }),
      ticket({ id: 'deleted', assignedTo: null, deletedAt: NOW.toISOString() }),
    ]
    const visible = visibleTickets(tickets, 'support', 'staff-support').map((t) => t.id)
    assert.deepEqual(visible.sort(), ['escalated', 'mine', 'unassigned'])

    const admin = visibleTickets(tickets, 'super_admin', 'staff-admin').map((t) => t.id)
    assert.equal(admin.includes('other'), true)
    assert.equal(admin.includes('deleted'), false)

    assert.deepEqual(visibleTickets(tickets, 'buyer', 'someone'), [])
  })

  it('never sends an internal note to the buyer', () => {
    const replies: TicketReply[] = [
      { id: 'r1', ticketId: 'ticket-1', author: 'staff', authorName: 'N', body: 'Public answer', internal: false, createdAt: NOW.toISOString() },
      { id: 'r2', ticketId: 'ticket-1', author: 'staff', authorName: 'N', body: 'Escalating, buyer sounds upset', internal: true, createdAt: NOW.toISOString() },
    ]
    const forUser = repliesForUser(replies)
    assert.equal(forUser.length, 1)
    assert.equal(forUser[0].id, 'r1')
  })
})

/* ------------------------------------------------------- the hidden gate -- */

describe('staff gate trigger', () => {
  it('opens on the third click inside the window', () => {
    let tracker = registerTriggerClick(null, 1000)
    assert.equal(tracker.opened, false)
    tracker = registerTriggerClick(tracker.tracker, 1200)
    assert.equal(tracker.opened, false)
    tracker = registerTriggerClick(tracker.tracker, 1400)
    assert.equal(tracker.opened, true)
  })

  it('does not open when the clicks are too slow', () => {
    let tracker = registerTriggerClick(null, 1000)
    tracker = registerTriggerClick(tracker.tracker, 1300)
    tracker = registerTriggerClick(tracker.tracker, 2600)
    assert.equal(tracker.opened, false)
    assert.equal(tracker.tracker.count, 1)
  })
})

describe('staff authentication', () => {
  it('accepts a seeded account and returns its role', () => {
    const outcome = authenticateStaff(
      { email: 'support@1stbuyer.test', passcode: 'support1st' },
      SEED_STAFF,
      NOW,
    )
    assert.equal(outcome.ok, true)
    if (outcome.ok) assert.equal(outcome.session.role, 'support')
  })

  it('is indistinguishable across every failure mode', () => {
    const unknown = authenticateStaff({ email: 'nobody@x.test', passcode: 'x' }, SEED_STAFF, NOW)
    const wrongPass = authenticateStaff({ email: 'support@1stbuyer.test', passcode: 'nope' }, SEED_STAFF, NOW)
    const disabled = authenticateStaff(
      { email: 'support@1stbuyer.test', passcode: 'support1st' },
      SEED_STAFF.map((a) => ({ ...a, active: false })),
      NOW,
    )
    assert.deepEqual(unknown, { ok: false, reason: 'invalid' })
    assert.deepEqual(wrongPass, { ok: false, reason: 'invalid' })
    assert.deepEqual(disabled, { ok: false, reason: 'invalid' })
    assert.match(GENERIC_SIGN_IN_ERROR, /not recognised/i)
  })

  it('expires a session after the inactivity window', () => {
    assert.equal(sessionExpired(session, new Date(NOW.getTime() + 3 * 3600 * 1000), 4), false)
    assert.equal(sessionExpired(session, new Date(NOW.getTime() + 5 * 3600 * 1000), 4), true)
    assert.equal(sessionExpired(null), true)
  })

  it('locks out after five failures in the window', () => {
    const fail = (minsAgo: number): AttemptLog => ({
      at: new Date(NOW.getTime() - minsAgo * 60000).toISOString(),
      ok: false,
    })
    const four = [fail(10), fail(9), fail(8), fail(7)]
    assert.equal(lockoutState(four, NOW).locked, false)

    const five = [...four, fail(1)]
    const locked = lockoutState(five, NOW)
    assert.equal(locked.locked, true)
    assert.ok(locked.remainingMinutes > 0 && locked.remainingMinutes <= 30)

    // Failures outside the window do not count.
    const stale = [fail(60), fail(59), fail(58), fail(57), fail(56)]
    assert.equal(lockoutState(stale, NOW).locked, false)
  })
})

/* ------------------------------------------------------------ audit log -- */

describe('audit log', () => {
  const entry = buildAuditEntry({
    session,
    action: 'ticket.view',
    metadata: { ticket: 'BUY-2608-0001' },
    now: NOW,
    id: 'audit-1',
    userAgent: 'test-agent',
  })

  it('records who, what and when', () => {
    assert.equal(entry.staffId, 'staff-support')
    assert.equal(entry.action, 'ticket.view')
    assert.equal(entry.createdAt, NOW.toISOString())
  })

  it('is honest that a browser cannot capture its own IP', () => {
    assert.match(entry.ipAddress, /not captured/i)
  })

  it('shows support only its own trail', () => {
    const entries = [
      entry,
      buildAuditEntry({
        session: { ...session, staffId: 'staff-admin', name: 'Admin', role: 'super_admin' },
        action: 'staff.sign_in',
        now: NOW,
        id: 'audit-2',
        userAgent: 'test-agent',
      }),
    ]
    assert.equal(visibleAudit(entries, 'support', 'staff-support').length, 1)
    assert.equal(visibleAudit(entries, 'super_admin', 'staff-admin').length, 2)
  })
})

/* ------------------------------------------------------ migration shape -- */

describe('staff migration', () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      'supabase',
      'migrations',
      readdirSync(join(process.cwd(), 'supabase', 'migrations')).find((f) =>
        f.includes('staff_and_support'),
      )!,
    ),
    'utf8',
  ).toLowerCase()

  it('enables RLS on every new table', () => {
    for (const table of [
      'tickets',
      'ticket_replies',
      'support_snippets',
      'staff_audit_logs',
      'system_settings',
      'content_snippets',
      'guardian_rules',
    ]) {
      assert.match(
        sql,
        new RegExp(`alter table public\\.${table}\\s+enable row level security`),
        `${table} has no RLS`,
      )
    }
  })

  it('restricts support to a view that has no financial columns', () => {
    const view = sql.slice(sql.indexOf('create or replace view public.buyer_directory'), sql.indexOf('comment on view'))
    for (const column of ['credit_score', 'income', 'id_number']) {
      assert.doesNotMatch(view, new RegExp(column), `${column} is exposed to support`)
    }
  })

  it('never lets an audit row be updated or deleted', () => {
    const audit = sql.slice(sql.indexOf('staff_audit_logs'), sql.indexOf('system settings'))
    assert.doesNotMatch(audit, /for update/)
    assert.doesNotMatch(audit, /for delete/)
  })

  it('keeps ticket deletion to super admins only', () => {
    assert.match(sql, /super admins soft delete tickets/)
    assert.doesNotMatch(sql, /for delete[\s\S]{0,120}tickets/)
  })

  it('records the controls that cannot be expressed in SQL', () => {
    for (const gap of ['totp', 'rate limiting', 'middleware role check']) {
      assert.match(sql, new RegExp(gap.replace(/ /g, '\\s')), `${gap} is not recorded as a gap`)
    }
  })
})

/* ------------------------------------------------- staff quick sign-in --- */

describe('staff quick sign-in', () => {
  it('offers one persona per seeded role, super admin first', () => {
    const personas = staffPersonas()
    assert.equal(personas.length, SEED_STAFF.filter((s) => s.active).length)
    assert.equal(personas[0].role, 'super_admin')
    assert.ok(personas.some((p) => p.role === 'support'))
  })

  it('hands out credentials that actually authenticate', () => {
    // The buttons feed the real sign-in path, so a stale passcode here would
    // be a button that always fails. This is what catches that.
    for (const persona of staffPersonas()) {
      const outcome = authenticateStaff(
        { email: persona.email, passcode: persona.passcode },
        SEED_STAFF,
      )
      assert.equal(outcome.ok, true, `${persona.email} did not authenticate`)
      if (!outcome.ok) continue
      assert.equal(outcome.session.role, persona.role)
    }
  })

  it('never offers a disabled account', () => {
    const disabled = SEED_STAFF.map((s) => ({ ...s, active: false }))
    assert.deepEqual(staffPersonas(disabled), [])
  })

  it('reflects a passcode changed from the admin screen', () => {
    const rotated = SEED_STAFF.map((s) => ({ ...s, passcode: 'rotated-2026' }))
    for (const persona of staffPersonas(rotated)) {
      assert.equal(persona.passcode, 'rotated-2026')
    }
  })

  it('falls back to the seed set when no accounts are loaded yet', () => {
    assert.ok(staffPersonas([]).length > 0)
  })
})
