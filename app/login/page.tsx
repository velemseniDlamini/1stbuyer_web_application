'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { Field, inputClass, Notice } from '@/components/ui-kit'
import { BottomSheet } from '@/components/bottom-sheet'
import { DEMO_DISCLOSURE, DEMO_PASSWORD, DEMO_PERSONAS, type DemoPersona } from '@/lib/demo-accounts'
import { StaffGate } from '@/components/staff/staff-gate'
import { CarIllustration } from '@/components/car-illustration'
import { validateCredentials } from '@/lib/auth-errors'
import { ShieldCheck, Scale, Eye, EyeOff, Zap, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const store = useStore()
  const { ready, account, profile, signInWithSeed } = store
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [pendingPersona, setPendingPersona] = useState<DemoPersona | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready || !account) return
    router.replace(profile ? '/' : '/onboarding')
  }, [ready, account, profile, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const address = email.trim().toLowerCase()
    const invalid = validateCredentials(address, password)
    if (invalid) {
      setError(invalid)
      return
    }

    setBusy(true)
    const result =
      mode === 'signup'
        ? await store.signUpWithPassword(address, password)
        : await store.signInWithPassword(address, password)
    setBusy(false)

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Try again.')
      return
    }

    // The session listener loads the account and profile, and the effect above
    // routes to the dashboard or to onboarding depending on what it finds.
    setPassword('')
  }

  /** Quick sign-in replaces whatever is on this device, so anything already
   *  recorded here gets an explicit confirmation first. */
  function choosePersona(persona: DemoPersona) {
    const hasLocalData = Boolean(profile) || store.credit.length > 0
    if (hasLocalData) {
      setPendingPersona(persona)
      return
    }
    applyPersona(persona)
  }

  /**
   * A sample profile is a real account when Supabase is configured: it signs
   * up (or signs in if it already exists), writes the sample profile to the
   * database, then seeds the slices that are still local. Half-signing-in a
   * persona would leave the gate looking at a session that does not exist.
   */
  async function applyPersona(persona: DemoPersona) {
    const seed = persona.build(new Date())
    setPendingPersona(null)
    setError('')

    if (store.authMode !== 'supabase') {
      signInWithSeed(seed)
      router.replace(seed.profile ? '/' : '/onboarding')
      return
    }

    setBusy(true)
    let auth = await store.signUpWithPassword(seed.email, DEMO_PASSWORD)
    if (!auth.ok) {
      // Already registered from a previous run: sign in instead.
      auth = await store.signInWithPassword(seed.email, DEMO_PASSWORD)
    }
    if (!auth.ok) {
      setBusy(false)
      setError(auth.error ?? 'That sample profile could not be opened.')
      return
    }

    signInWithSeed(seed)
    if (seed.profile) {
      const saved = await store.saveProfile(seed.profile)
      if (!saved.ok) {
        setBusy(false)
        setError(saved.error ?? 'The sample profile could not be saved.')
        return
      }
    }

    // The persona's credit history and finance pack live in the database now,
    // so they have to be written there rather than sitting in device state.
    const seeded = await store.seedServerSlices(seed)
    if (!seeded.ok) {
      setBusy(false)
      setError(seeded.error ?? 'The sample data could not be saved.')
      return
    }

    setBusy(false)
    router.replace(seed.profile ? '/' : '/onboarding')
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-muted px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary font-display text-2xl font-bold text-primary-foreground">
            1
          </div>
          {/* The screen was text on a plain background and could have belonged
              to any product. The car says what this is before a word is read.
              An illustration rather than a photograph, so it cannot be mistaken
              for a listing. */}
          <CarIllustration className="mx-auto mb-5 max-w-[15rem]" />
          <h1 className="font-display text-3xl font-semibold leading-tight text-balance">
            Your fair advantage in car buying
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            The information the dealership already has, now in your pocket, before you sign.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-lg py-2 transition ${mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`rounded-lg py-2 transition ${mode === 'signin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.co.za"
              />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
            >
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <p role="alert" className="text-sm text-destructive text-pretty">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
            >
              {busy
                ? mode === 'signup' ? 'Creating your account…' : 'Signing you in…'
                : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {/* Quick sign-in. Three sample profiles, each reaching a different
              state of the product, so the states that are tedious to build by
              hand are one tap away. */}
          <div className="mt-6 border-t border-border pt-5">
            <div className="mb-1 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold">Quick sign-in</h2>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Sample
              </span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground text-pretty">{DEMO_DISCLOSURE}</p>

            <ul className="space-y-2">
              {DEMO_PERSONAS.map((persona) => (
                <li key={persona.id}>
                  <button
                    type="button"
                    onClick={() => choosePersona(persona)}
                    // Focus ring matches the raised Guardian button in the
                    // bottom navigation, so keyboard focus looks the same
                    // everywhere in the app.
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-secondary-foreground">
                      {persona.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{persona.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {persona.summary}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* This notice used to say "nothing is sent to a server", which stopped
            being true the moment sign-in, profiles, credit history and the
            document pack moved to Supabase, and again when Guardian started
            sending questions to Google. A false privacy claim on the screen
            where someone decides to hand over their credit score is the worst
            place in the app to be out of date, so it now reads from authMode
            rather than asserting something nobody rechecks. */}
        <Notice tone="muted">
          This is a working prototype.{' '}
          {store.authMode === 'supabase' ? (
            <>
              Your account, profile, credit score and document list are stored in a hosted database
              (Supabase). Questions you ask Chatbot are sent to Google to be answered. Everything
              else stays on this device.
            </>
          ) : (
            <>
              Your account and data are stored only on this device. Questions you ask Chatbot are
              sent to Google to be answered.
            </>
          )}{' '}
          1st Buyer is independent and takes no commission.
        </Notice>

        <ul className="mt-6 space-y-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Aligned to the buyer alone,
            no dealer-paid placement.
          </li>
          <li className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" aria-hidden /> Every legal answer cites the
            relevant South African law.
          </li>
        </ul>

        <StaffGate triggerText={store.systemSettings.triggerText} />
      </div>

      {pendingPersona && (
        <BottomSheet title="Replace the data on this device?" onClose={() => setPendingPersona(null)}>
          <div className="space-y-4">
            <p className="text-sm text-pretty">
              Signing in as <strong className="font-semibold">{pendingPersona.name}</strong> replaces
              everything currently recorded here, including
              {profile ? ` the profile for ${profile.firstName || 'this device'}` : ' the current account'}
              {store.credit.length > 0 ? ', the recorded credit history' : ''} and any saved cars,
              scenarios or quotations.
            </p>
            <p className="text-xs text-muted-foreground text-pretty">
              This build keeps everything on this device, so there is no copy elsewhere. Export your
              data from Profile first if you want to keep it.
            </p>
            <button
              onClick={() => applyPersona(pendingPersona)}
              className="min-h-11 w-full rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
            >
              Replace and sign in as {pendingPersona.name}
            </button>
            <button
              onClick={() => setPendingPersona(null)}
              className="min-h-11 w-full rounded-xl border border-border text-sm font-semibold transition hover:border-primary/40"
            >
              Keep my data
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
