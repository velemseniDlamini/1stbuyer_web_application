'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Zap } from 'lucide-react'
import { BottomSheet } from '@/components/bottom-sheet'
import { Field, inputClass } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import {
  GENERIC_SIGN_IN_ERROR,
  authenticateStaff,
  buildAuditEntry,
  lockoutState,
  registerTriggerClick,
  type ClickTracker,
} from '@/lib/staff'
import {
  STAFF_QUICK_SIGN_IN_NOTE,
  staffPersonas,
  staffQuickSignInEnabled,
} from '@/lib/staff-demo'

/**
 * The hidden staff entry point.
 *
 * The trigger is a line of footer micro-copy that looks like every other piece
 * of fine print: same token, same muted colour, no hover state, no pointer
 * cursor, no animation. Three clicks inside 600ms opens the sheet.
 *
 * Obscurity is the outer layer only. The sheet below authenticates, applies a
 * generic error for every failure mode so staff addresses cannot be enumerated,
 * and throttles repeated failures. In THIS build all of that runs client-side
 * and is therefore a workflow model rather than an access boundary, which the
 * sheet states in plain words rather than implying a security it does not have.
 */
export function StaffGate({ triggerText }: { triggerText: string }) {
  const store = useStore()
  const router = useRouter()
  const tracker = useRef<ClickTracker | null>(null)

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')

  const lock = lockoutState(store.staffAttempts)

  // Derived from the accounts actually in the store, so a passcode changed
  // from the admin screen is reflected instead of handed out stale.
  const quickSignIn = staffQuickSignInEnabled()
  const personas = useMemo(
    () => (quickSignIn ? staffPersonas(store.staffAccounts) : []),
    [quickSignIn, store.staffAccounts],
  )

  function onTriggerClick() {
    const result = registerTriggerClick(tracker.current, Date.now())
    tracker.current = result.tracker
    if (result.opened) {
      tracker.current = null
      setOpen(true)
    }
  }

  /**
   * The one sign-in path. The quick buttons below feed it real credentials
   * rather than shortcutting past it, so the lockout, the attempt log and the
   * audit entry all behave exactly as they do for a typed sign-in.
   */
  function signIn(attempt: { email: string; passcode: string }) {
    setError('')

    const current = lockoutState(store.staffAttempts)
    if (current.locked) {
      setError(`Too many attempts. Try again in ${current.remainingMinutes} minutes.`)
      return
    }

    const outcome = authenticateStaff(attempt, store.staffAccounts)
    store.recordStaffAttempt({ at: new Date().toISOString(), ok: outcome.ok })

    if (!outcome.ok) {
      // One message for unknown email, wrong passcode and disabled account.
      setError(GENERIC_SIGN_IN_ERROR)
      setPasscode('')
      return
    }

    store.staffSignIn(outcome.session)
    store.audit(buildAuditEntry({ session: outcome.session, action: 'staff.sign_in' }))
    setOpen(false)
    setEmail('')
    setPasscode('')
    router.push(outcome.session.role === 'super_admin' ? '/staff/admin' : '/staff/support')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    signIn({ email, passcode })
  }

  return (
    <>
      {/* Reads as fine print. No cursor change, no hover, no underline. */}
      <p
        onClick={onTriggerClick}
        className="mt-6 select-none text-center text-xs font-normal text-muted-foreground/50"
      >
        {triggerText}
      </p>

      {open && (
        <BottomSheet title="Staff Sign-In" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Field label="Email" htmlFor="staff-email">
              <input
                id="staff-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Passcode"
              htmlFor="staff-passcode"
              hint="Staff accounts are provisioned by a super admin. There is no sign-up."
            >
              <input
                id="staff-passcode"
                type="password"
                autoComplete="off"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className={inputClass}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {!error && lock.failuresInWindow > 0 && (
              <p className="text-xs text-muted-foreground">
                {lock.failuresInWindow} of 5 attempts used in this window.
              </p>
            )}

            <button
              type="submit"
              disabled={lock.locked}
              className="min-h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              Sign in
            </button>

            {/* One tap per role, so both sides of the portal can be seen
                without hunting for a passcode in the source. */}
            {quickSignIn && personas.length > 0 && (
              <div className="border-t border-border pt-3">
                <div className="mb-1 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <h3 className="text-xs font-semibold">Quick sign-in</h3>
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sample
                  </span>
                </div>
                <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground text-pretty">
                  {STAFF_QUICK_SIGN_IN_NOTE}
                </p>

                <ul className="space-y-2">
                  {personas.map((persona) => (
                    <li key={persona.id}>
                      <button
                        type="button"
                        disabled={lock.locked}
                        onClick={() => signIn({ email: persona.email, passcode: persona.passcode })}
                        className="flex min-h-11 w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-secondary-foreground">
                          {persona.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{persona.name}</span>
                            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              {persona.roleLabel}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground text-pretty">
                            {persona.summary}
                          </span>
                          <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground/80">
                            {persona.email} / {persona.passcode}
                          </span>
                        </span>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Said plainly, because a portal that implies server-side auth it
                does not have is worse than one that admits it. */}
            <p className="text-[11px] leading-snug text-muted-foreground text-pretty">
              This build authenticates staff in the browser against local data. It models the roles,
              screens and audit trail; it is not an access-control boundary. Real enforcement lives
              in the row-level security policies shipped in supabase/migrations, which need a
              backend to run.
            </p>
          </form>
        </BottomSheet>
      )}
    </>
  )
}
