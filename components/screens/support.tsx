'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ScreenHeader } from '@/components/screen-header'
import { Card, EmptyState, Field, Notice, Pill, SectionTitle, inputClass } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import {
  TICKET_CATEGORIES,
  TICKET_STATUS_LABELS,
  createTicket,
  isOverdue,
  priorityFor,
  repliesForUser,
  validateTicket,
  type Ticket,
  type TicketCategory,
} from '@/lib/support'
import { formatDate, formatRelative } from '@/lib/format'
import { LifeBuoy, MessageSquare, Send, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The buyer's side of support: raise a ticket, read the thread, reply.
 *
 * Internal staff notes are filtered out here by repliesForUser, and the buyer
 * never sees who a ticket is assigned to or what priority the system gave it.
 * Priority is set by category rather than by the reporter, and the screen says
 * so rather than offering a P0 button that means nothing.
 */
export function SupportScreen() {
  const { account, profile, myTickets, addTicket, addTicketReply, ticketReplies } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)

  const openTicket = myTickets.find((t) => t.id === openId) ?? null

  if (openTicket) {
    return (
      <TicketThread
        ticket={openTicket}
        onBack={() => setOpenId(null)}
        replies={ticketReplies.filter((r) => r.ticketId === openTicket.id)}
        onReply={(body) => {
          if (!account) return
          addTicketReply({
            id: crypto.randomUUID(),
            ticketId: openTicket.id,
            author: 'user',
            authorName: profile?.firstName || 'You',
            body,
            internal: false,
            createdAt: new Date().toISOString(),
          })
        }}
      />
    )
  }

  return (
    <div className="pb-8">
      <ScreenHeader title="Help" subtitle="Ask us anything the app cannot answer" back />

      <div className="space-y-5 px-4">
        <Notice tone="muted">
          Chatbot answers questions about South African car-buying law and finance instantly. Use a
          ticket when something is wrong with the app itself, with your account, or when you need a
          person.{' '}
          <Link href="/chat" className="font-semibold underline">
            Ask Chatbot first
          </Link>
          .
        </Notice>

        <NewTicketForm
          onCreate={(category, subject, body) => {
            if (!account) return
            const ticket = createTicket({
              userEmail: account.email,
              userName: `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || 'Buyer',
              category,
              subject,
              body,
            })
            addTicket(ticket)
            setOpenId(ticket.id)
          }}
        />

        <div>
          <SectionTitle>Your tickets</SectionTitle>
          {myTickets.length === 0 ? (
            <EmptyState icon={<LifeBuoy className="h-8 w-8" />} title="No tickets yet">
              Anything you raise will appear here with its full history, so you always have a record
              of what was said.
            </EmptyState>
          ) : (
            <Card className="divide-y divide-border">
              {myTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setOpenId(ticket.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.reference} · {ticket.category} · {formatRelative(ticket.createdAt)}
                    </p>
                  </div>
                  <StatusPill ticket={ticket} />
                </button>
              ))}
            </Card>
          )}
        </div>

        <Card className="p-4">
          <SectionTitle>What we can see</SectionTitle>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span className="text-pretty">
                Support agents see your name, your city and whether a credit score is recorded. They
                cannot see the score itself, your income, or your documents.
              </span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span className="text-pretty">
                Every time a staff member opens your ticket or views your account, it is written to
                an audit log with their name and the time.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}

function StatusPill({ ticket }: { ticket: Ticket }) {
  const overdue = isOverdue(ticket)
  const tone =
    ticket.status === 'resolved'
      ? 'success'
      : ticket.status === 'waiting_user'
        ? 'warning'
        : overdue
          ? 'destructive'
          : 'muted'
  return <Pill tone={tone}>{TICKET_STATUS_LABELS[ticket.status]}</Pill>
}

function NewTicketForm({
  onCreate,
}: {
  onCreate: (category: TicketCategory, subject: string, body: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<TicketCategory | ''>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const expectedPriority = category ? priorityFor(category) : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateTicket({ category: category || undefined, subject, body })
    setErrors(result.errors)
    if (!result.valid || !category) return
    onCreate(category, subject, body)
    setCategory('')
    setSubject('')
    setBody('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        <MessageSquare className="h-4 w-4" aria-hidden /> Raise a ticket
      </button>
    )
  }

  return (
    <Card className="p-4">
      <SectionTitle>Raise a ticket</SectionTitle>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="What is this about?" htmlFor="ticket-category" error={errors.category}>
          <select
            id="ticket-category"
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
          >
            <option value="">Choose a category</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="One-line summary" htmlFor="ticket-subject" error={errors.subject}>
          <input
            id="ticket-subject"
            className={inputClass}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder="My instalment estimate looks wrong"
          />
        </Field>

        <Field
          label="What happened?"
          htmlFor="ticket-body"
          error={errors.body}
          hint="Include what you expected and what you saw. Do not include passwords or ID numbers."
        >
          <textarea
            id="ticket-body"
            className={cn(inputClass, 'min-h-32 resize-y')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
        </Field>

        {expectedPriority && (
          <p className="text-xs text-muted-foreground text-pretty">
            We will treat this as {expectedPriority}. Priority is set by category, not by the
            reporter, so everyone reporting the same kind of problem waits the same time.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Send className="h-4 w-4" aria-hidden /> Send
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 flex-1 rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}

function TicketThread({
  ticket,
  replies,
  onBack,
  onReply,
}: {
  ticket: Ticket
  replies: ReturnType<typeof useStore>['ticketReplies']
  onBack: () => void
  onReply: (body: string) => void
}) {
  const [draft, setDraft] = useState('')
  const visible = useMemo(() => repliesForUser(replies), [replies])

  return (
    <div className="pb-8">
      <ScreenHeader title={ticket.subject} subtitle={`${ticket.reference} · ${ticket.category}`} back />

      <div className="space-y-4 px-4">
        <button onClick={onBack} className="min-h-11 text-sm font-semibold text-primary">
          Back to all tickets
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={ticket.status === 'resolved' ? 'success' : 'muted'}>
            {TICKET_STATUS_LABELS[ticket.status]}
          </Pill>
          <span className="text-xs text-muted-foreground">
            Raised {formatDate(ticket.createdAt)}
          </span>
        </div>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your message
          </p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-pretty">{ticket.body}</p>
        </Card>

        {visible.length > 0 && (
          <div className="space-y-2">
            {visible.map((reply) => (
              <Card
                key={reply.id}
                className={cn('p-3.5', reply.author === 'staff' && 'border-primary/30 bg-primary/5')}
              >
                <p className="text-xs font-semibold">
                  {reply.author === 'staff' ? `${reply.authorName}, 1st Buyer support` : 'You'}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {formatRelative(reply.createdAt)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-pretty">{reply.body}</p>
              </Card>
            ))}
          </div>
        )}

        {ticket.status === 'resolved' ? (
          <Notice tone="success">
            This ticket is resolved. Replying reopens it if the problem is still there.
          </Notice>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            onReply(draft.trim())
            setDraft('')
          }}
          className="space-y-2"
        >
          <label htmlFor="ticket-reply" className="block text-sm font-medium">
            Add a reply
          </label>
          <textarea
            id="ticket-reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(inputClass, 'min-h-24 resize-y')}
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden /> Send reply
          </button>
        </form>
      </div>
    </div>
  )
}
