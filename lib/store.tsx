'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { FinanceInput, FinanceResult } from './finance'
import type { JourneyStageId } from './journey'
import { assessCurrency, DEFAULT_DOCS, mergeDocs, type DocItem } from './documents'

// Re-exported so existing imports from '@/lib/store' keep working.
export { DEFAULT_DOCS, type DocItem }
import { satisfiesKnowTheMarket, type ComparisonEvent } from './compare'
import { isExpired, type ComparisonShare } from './share-token'
import type { CriterionId } from './decision-score'
import type { DemoSeed } from './demo-accounts'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, supabaseConfigured } from './supabase'
import { fetchProfile, saveProfileRow } from './profile-repo'
import { describeSignInError, describeSignUpError } from './auth-errors'
import { fetchCredit, insertCredit } from './credit-repo'
import { deleteDocument, fetchDocuments, upsertDocument } from './documents-repo'
import type { Ticket, TicketReply } from './support'
import {
  DEFAULT_CONTENT,
  DEFAULT_SNIPPETS,
  DEFAULT_SYSTEM_SETTINGS,
  SEED_STAFF,
  defaultGuardianRules,
  sessionExpired,
  type AttemptLog,
  type AuditEntry,
  type ContentSnippets,
  type GuardianRuleConfig,
  type StaffAccount,
  type StaffSession,
  type SupportSnippet,
  type SystemSettings,
} from './staff'

const JOURNEY_ORDER: JourneyStageId[] = [
  'know-yourself',
  'know-rights',
  'know-market',
  'know-deal',
  'find-car',
  'seal-deal',
  'protect-ride',
]

/** Per-user interface preferences. Mirrors profiles.preferences (jsonb). */
export type Preferences = {
  /** Suggestion vehicle ids the user dismissed permanently. */
  dismissedSuggestionIds: string[]
  /** Weights for the decision helper, 0-5 per criterion. */
  decisionWeights: Partial<Record<CriterionId, number>>
  glanceBarDismissed: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  dismissedSuggestionIds: [],
  decisionWeights: {},
  glanceBarDismissed: false,
}

export type Profile = {
  firstName: string
  lastName: string
  city: string
  province: string
  employment: string
  monthlyIncome: number
  dob: string
  licenceDate: string
  goal: string
  preferences?: Preferences
}

export type CreditEntry = { score: number; bureau: string; date: string }

export type SavedScenario = {
  id: string
  name: string
  input: FinanceInput
  result: FinanceResult
  savedAt: string
}

export type QuotationFinding = {
  label: string
  value: string
  status: 'ok' | 'watch' | 'flag'
  note: string
}

export type Quotation = {
  id: string
  vehicle: string
  createdAt: string
  findings: QuotationFinding[]
  score: number // 0-100 fairness score
}


export type ChatMessage = {
  id: string
  role: 'user' | 'guardian'
  text: string
  citation?: string
  steps?: string[]
  matched?: boolean
  link?: { label: string; href: string }
  at: string
}

/** Mirrors the saved_comparisons table (2-3 car ids, per user). */
export type SavedComparison = {
  id: string
  carIds: string[]
  name: string
  createdAt: string
  updatedAt?: string
}

export type AppNotification = {
  id: string
  title: string
  body: string
  at: string
  href?: string
  read?: boolean
}

export type Account = { email: string; since: string }

type State = {
  ready: boolean
  account: Account | null
  profile: Profile | null
  credit: CreditEntry[]
  scenarios: SavedScenario[]
  quotations: Quotation[]
  savedVehicleIds: string[]
  documents: DocItem[]
  chat: ChatMessage[]
  completedRights: string[]
  visitedMarket: boolean
  comparedInsurance: boolean
  savedComparisons: SavedComparison[]
  /** Append-only log the journey service derives progress from. */
  comparisonEvents: ComparisonEvent[]
  /** Mirrors comparison_shares: 24-hour read-only links. */
  comparisonShares: ComparisonShare[]
  readNotificationIds: string[]
  /* ---- support and staff ---- */
  tickets: Ticket[]
  ticketReplies: TicketReply[]
  staffAccounts: StaffAccount[]
  staffSession: StaffSession | null
  staffAttempts: AttemptLog[]
  auditLog: AuditEntry[]
  systemSettings: SystemSettings
  contentSnippets: ContentSnippets
  supportSnippets: SupportSnippet[]
  guardianRules: GuardianRuleConfig[]
  suspendedEmails: string[]
  /** Supabase user id when signed in through Supabase. */
  authUserId: string | null
  /** Surfaced by screens rather than swallowed. */
  profileError: string | null
  /** A failed read or write of a synced slice, shown rather than hidden. */
  syncError: string | null
  theme: 'light' | 'dark'
}

type Store = State & {
  /** Local-only sign-in, used when Supabase is not configured. */
  signIn: (email: string) => void
  authMode: 'supabase' | 'local'
  signUpWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signInWithSeed: (seed: DemoSeed) => void
  /**
   * Writes a sample persona's credit history and finance pack to the database,
   * but only into an account that has neither yet. Signing into the same
   * persona twice must not stack a second copy of its score history.
   */
  seedServerSlices: (seed: DemoSeed) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
  deleteAccount: () => void
  saveProfile: (p: Profile) => Promise<{ ok: boolean; error?: string }>
  updateProfile: (p: Partial<Profile>) => Promise<{ ok: boolean; error?: string }>
  addCredit: (entry: CreditEntry) => Promise<{ ok: boolean; error?: string }>
  saveScenario: (s: SavedScenario) => void
  removeScenario: (id: string) => void
  addQuotation: (q: Quotation) => void
  toggleSavedVehicle: (id: string) => void
  setDocument: (id: string, fileName: string | null, docDate?: string) => Promise<{ ok: boolean; error?: string }>
  addChat: (m: ChatMessage) => void
  clearChat: () => void
  completeRights: (id: string) => void
  markMarketVisited: () => void
  markInsuranceCompared: () => void
  recordComparison: (event: ComparisonEvent) => void
  saveComparison: (c: SavedComparison) => void
  renameComparison: (id: string, name: string) => void
  removeComparison: (id: string) => void
  createShare: (share: ComparisonShare) => void
  prunedShares: ComparisonShare[]
  preferences: Preferences
  updatePreferences: (p: Partial<Preferences>) => void
  dismissSuggestion: (vehicleId: string) => void
  markNotificationsRead: () => void
  setTheme: (t: 'light' | 'dark') => void
  currentScore: number | null
  journeyDone: Record<JourneyStageId, boolean>
  notifications: AppNotification[]
  exportData: () => string
  /* ---- support (consumer side) ---- */
  addTicket: (t: Ticket) => void
  addTicketReply: (r: TicketReply) => void
  myTickets: Ticket[]
  /* ---- staff ---- */
  staffSignIn: (session: StaffSession) => void
  staffSignOut: () => void
  recordStaffAttempt: (attempt: AttemptLog) => void
  touchStaffSession: () => void
  audit: (entry: AuditEntry) => void
  updateTicket: (id: string, patch: Partial<Ticket>) => void
  softDeleteTicket: (id: string) => void
  updateSystemSettings: (patch: Partial<SystemSettings>) => void
  updateContent: (patch: Partial<ContentSnippets>) => void
  upsertSnippet: (snippet: SupportSnippet) => void
  removeSnippet: (id: string) => void
  setGuardianRules: (rules: GuardianRuleConfig[]) => void
  upsertStaffAccount: (account: StaffAccount) => void
  revokeStaffAccount: (id: string) => void
  toggleSuspendEmail: (email: string) => void
  revokeAllStaffSessions: () => void
}



const INITIAL: State = {
  ready: false,
  account: null,
  profile: null,
  credit: [],
  scenarios: [],
  quotations: [],
  savedVehicleIds: [],
  documents: DEFAULT_DOCS,
  chat: [],
  completedRights: [],
  visitedMarket: false,
  comparedInsurance: false,
  savedComparisons: [],
  comparisonEvents: [],
  comparisonShares: [],
  readNotificationIds: [],
  tickets: [],
  ticketReplies: [],
  staffAccounts: SEED_STAFF,
  staffSession: null,
  staffAttempts: [],
  auditLog: [],
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  contentSnippets: DEFAULT_CONTENT,
  supportSnippets: DEFAULT_SNIPPETS,
  guardianRules: defaultGuardianRules(),
  suspendedEmails: [],
  authUserId: null,
  profileError: null,
  syncError: null,
  theme: 'light',
}

const STORAGE_KEY = '1stbuyer.state.v1'

const Ctx = createContext<Store | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(INITIAL)

  /**
   * WHERE IDENTITY LIVES.
   *
   * When Supabase is configured, the session and the profiles row are the only
   * source of truth for `account` and `profile`. Anything restored from
   * localStorage for those two fields is discarded, because a stale local copy
   * of "who is signed in" is exactly how an app ends up showing one person's
   * name over another person's data.
   *
   * Everything else (credit history, documents, comparisons, tickets, staff)
   * is still local. That split is deliberate and temporary, and the profile
   * screen says which is which rather than implying it is all synced.
   */
  const authMode: 'supabase' | 'local' = supabaseConfigured ? 'supabase' : 'local'

  // hydrate the local slices
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      const restored = { ...INITIAL, ...parsed, documents: mergeDocs(parsed.documents) }

      if (authMode === 'supabase') {
        // Identity comes from the session below, never from disk.
        restored.account = null
        restored.profile = null
      }

      // In Supabase mode `ready` waits for the session check.
      setState({ ...restored, ready: authMode === 'local' })
    } catch {
      setState((s) => ({ ...s, ready: authMode === 'local' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Session, then profile. Runs only when Supabase is configured.
  useEffect(() => {
    if (authMode !== 'supabase') return
    const supabase = getSupabase()
    if (!supabase) return

    let active = true

    async function load(session: Session | null) {
      if (!active) return

      if (!session?.user) {
        setState((s) => ({ ...s, account: null, profile: null, authUserId: null, ready: true }))
        return
      }

      const user = session.user
      const account = { email: user.email ?? '', since: user.created_at ?? new Date().toISOString() }

      // Profile, credit history and the finance pack all belong to this user
      // and are all scoped by row level security, so they are fetched together
      // rather than in a waterfall.
      const [result, creditResult, docsResult] = await Promise.all([
        fetchProfile(supabase!),
        fetchCredit(supabase!),
        fetchDocuments(supabase!),
      ])
      if (!active) return

      setState((s) => ({
        ...s,
        account,
        authUserId: user.id,
        // 'incomplete' means the sign-up trigger made a row but onboarding has
        // not run yet, which must send the user to onboarding rather than in.
        profile: result.status === 'ok' ? result.profile : null,
        profileError: result.status === 'error' ? result.message : null,
        // A failed read leaves the slice empty rather than showing a stale
        // local copy as if it were the server's answer.
        credit: creditResult.ok ? creditResult.entries : [],
        documents: docsResult.ok ? docsResult.documents : DEFAULT_DOCS,
        syncError:
          [creditResult.ok ? null : creditResult.error, docsResult.ok ? null : docsResult.error]
            .filter(Boolean)
            .join(' ') || null,
        ready: true,
      }))
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // persist the local slices
  useEffect(() => {
    if (!state.ready) return
    try {
      const { ready: _ready, ...persist } = state
      if (authMode === 'supabase') {
        // Identity is not written to disk in Supabase mode.
        localStorage.setItem(
          STORAGE_KEY,
          // Identity, credit history and the finance pack are server-owned in
          // this mode. Writing a copy to disk would create a second source of
          // truth that could be read back stale after a change on another device.
          JSON.stringify({ ...persist, account: null, profile: null, credit: [], documents: DEFAULT_DOCS }),
        )
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persist))
      }
    } catch {
      /* storage may be unavailable */
    }
  }, [state, authMode])

  // apply theme class
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.classList.toggle('dark', state.theme === 'dark')
    root.classList.toggle('light', state.theme === 'light')
  }, [state.theme])

  const store = useMemo<Store>(() => {
    const currentScore = state.credit.length ? state.credit[state.credit.length - 1].score : null
    const preferences: Preferences = { ...DEFAULT_PREFERENCES, ...(state.profile?.preferences ?? {}) }
    // Expired share links are never handed to a screen.
    const prunedShares = state.comparisonShares.filter((s) => !isExpired(s))
    // A stale staff session is never handed to a screen.
    const liveStaffSession = sessionExpired(state.staffSession, new Date(), state.systemSettings.staffSessionHours)
      ? null
      : state.staffSession
    const myTickets = state.account
      ? state.tickets.filter((t) => t.userEmail === state.account!.email && !t.deletedAt)
      : []

    const journeyDone: Record<JourneyStageId, boolean> = {
      'know-yourself': state.credit.length > 0,
      'know-rights': state.completedRights.length > 0,
      // Stage 3 is satisfied by browsing the market OR by running a real
      // comparison, the latter derived from the event log, not a flag any
      // screen can set on itself.
      'know-market': state.visitedMarket || satisfiesKnowTheMarket(state.comparisonEvents),
      'know-deal': state.scenarios.length > 0,
      'find-car': state.savedVehicleIds.length > 0,
      'seal-deal': state.quotations.length > 0,
      'protect-ride': state.comparedInsurance,
    }

    // Notifications are derived from this user's real state only, nothing is
    // fabricated, and each one links to the screen that resolves it.
    const raw: AppNotification[] = []
    const now = new Date().toISOString()

    if (currentScore === null && state.profile) {
      raw.push({
        id: 'score',
        title: 'Record your credit score',
        body: 'Your target interest rate is the most valuable number in the deal. Record a score to unlock it.',
        at: now,
        href: '/credit',
      })
    }

    for (const doc of state.documents) {
      const currency = assessCurrency(doc)
      if (currency.state === 'expired' || currency.state === 'expiring') {
        raw.push({
          id: `doc-${doc.id}-${currency.state}`,
          title:
            currency.state === 'expired'
              ? `${doc.category} is out of date`
              : `${doc.category} expires soon`,
          body: `${currency.label}. Replace it before your finance application.`,
          at: now,
          href: '/documents',
        })
      }
    }

    const missingDocs = state.documents.filter((d) => d.status === 'missing').length
    if (state.profile && missingDocs > 0) {
      raw.push({
        id: `docs-${missingDocs}`,
        title: 'Finance pack incomplete',
        body: `${missingDocs} document${missingDocs > 1 ? 's are' : ' is'} still missing from your finance pack.`,
        at: now,
        href: '/documents',
      })
    }

    const flagged = state.quotations.find((q) =>
      q.findings.some((f) => f.status === 'flag' || f.status === 'watch'),
    )
    if (flagged) {
      const count = flagged.findings.filter((f) => f.status !== 'ok').length
      raw.push({
        id: `quote-${flagged.id}`,
        title: 'Negotiation points outstanding',
        body: `Your quotation for ${flagged.vehicle || 'a vehicle'} has ${count} item${count > 1 ? 's' : ''} worth challenging.`,
        at: flagged.createdAt,
        href: '/documents',
      })
    }

    const unlocked = JOURNEY_ORDER.filter((id) => journeyDone[id]).length
    if (unlocked > 0 && unlocked < JOURNEY_ORDER.length) {
      raw.push({
        id: `journey-${unlocked}`,
        title: `Stage ${unlocked} complete`,
        body: `You have finished ${unlocked} of ${JOURNEY_ORDER.length} journey stages. Your next step is waiting.`,
        at: now,
        href: '/journey',
      })
    }

    const notifications = raw.map((n) => ({
      ...n,
      read: state.readNotificationIds.includes(n.id),
    }))

    return {
      ...state,
      currentScore,
      journeyDone,
      notifications,
      preferences,
      prunedShares,
      staffSession: liveStaffSession,
      myTickets,
      signIn: (email) =>
        setState((s) => ({
          ...s,
          // Returning to an account already on this device keeps its join date.
          account: { email, since: s.account?.since ?? new Date().toISOString() },
        })),
      /**
       * Quick sign-in. Replaces device state wholesale rather than merging, so
       * switching personas can never leave one persona's credit score attached
       * to another's profile. The chosen theme survives, because appearance is
       * the tester's preference rather than part of the sample data.
       */
      signInWithSeed: (seed) =>
        setState((s) => ({
          ...INITIAL,
          ready: true,
          theme: s.theme,
          // In Supabase mode identity belongs to the session and the profiles
          // row, so the seed only fills the slices that are still local.
          account: authMode === 'supabase' ? s.account : { email: seed.email, since: new Date().toISOString() },
          profile: authMode === 'supabase' ? s.profile : seed.profile,
          authUserId: s.authUserId,
          // Credit history and the finance pack live in the database in
          // Supabase mode. Overwriting them with seed values would show the
          // signed-in person figures that are not in their own rows.
          credit: authMode === 'supabase' ? s.credit : seed.credit,
          documents: authMode === 'supabase' ? s.documents : seed.documents,
          savedVehicleIds: seed.savedVehicleIds,
          savedComparisons: seed.savedComparisons,
          completedRights: seed.completedRights,
          visitedMarket: seed.visitedMarket,
        })),
      authMode,

      seedServerSlices: async (seed) => {
        if (authMode !== 'supabase') return { ok: true }
        const supabase = getSupabase()
        // Read the id from the session: this runs moments after sign-in, which
        // can land before the auth listener has updated state.
        const userId =
          state.authUserId ?? (await supabase?.auth.getUser())?.data.user?.id ?? null
        if (!supabase || !userId) {
          return { ok: false, error: 'You are not signed in. Sign in and try again.' }
        }

        const [existingCredit, existingDocs] = await Promise.all([
          fetchCredit(supabase),
          fetchDocuments(supabase),
        ])
        if (!existingCredit.ok) return { ok: false, error: existingCredit.error }
        if (!existingDocs.ok) return { ok: false, error: existingDocs.error }

        if (existingCredit.entries.length === 0) {
          for (const entry of seed.credit) {
            const written = await insertCredit(supabase, userId, entry)
            if (!written.ok) return { ok: false, error: written.error }
          }
        }

        const alreadyHasDocs = existingDocs.documents.some((d) => d.status === 'added')
        if (!alreadyHasDocs) {
          for (const doc of seed.documents.filter((d) => d.status === 'added')) {
            const written = await upsertDocument(supabase, userId, doc.id, doc.fileName, doc.docDate)
            if (!written.ok) return { ok: false, error: written.error }
          }
        }

        // Read back rather than assuming: what the screen shows is what the
        // database holds, including anything this account already had.
        const [credit, docs] = await Promise.all([fetchCredit(supabase), fetchDocuments(supabase)])
        setState((s) => ({
          ...s,
          credit: credit.ok ? credit.entries : s.credit,
          documents: docs.ok ? docs.documents : s.documents,
          syncError: null,
        }))
        return { ok: true }
      },

      /**
       * Sign-up goes through the server route rather than the browser client:
       * this project has email confirmation on with no custom SMTP, so a direct
       * signUp() hits the built-in mail rate limit after a couple of attempts.
       * The route creates the user already confirmed; we then sign in normally.
       */
      signUpWithPassword: async (email, password) => {
        if (authMode !== 'supabase') {
          setState((s) => ({
            ...s,
            account: { email, since: new Date().toISOString() },
          }))
          return { ok: true }
        }

        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) {
            return { ok: false, error: payload.error ?? describeSignUpError(null).message }
          }
        } catch (err) {
          return {
            ok: false,
            error: describeSignUpError(err instanceof Error ? err.message : null).message,
          }
        }

        const supabase = getSupabase()
        if (!supabase) return { ok: false, error: describeSignUpError(null).message }

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, error: describeSignInError(error.message).message }
        // onAuthStateChange loads the account and profile.
        return { ok: true }
      },

      signInWithPassword: async (email, password) => {
        if (authMode !== 'supabase') {
          setState((s) => ({
            ...s,
            account: { email, since: s.account?.since ?? new Date().toISOString() },
          }))
          return { ok: true }
        }

        const supabase = getSupabase()
        if (!supabase) return { ok: false, error: describeSignInError(null).message }

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, error: describeSignInError(error.message).message }
        return { ok: true }
      },

      signOut: () => {
        if (authMode === 'supabase') {
          // Ends the session; onAuthStateChange clears account and profile.
          getSupabase()?.auth.signOut()
        }
        setState((s) => ({ ...s, account: null, profile: null, authUserId: null }))
      },

      deleteAccount: () => {
        if (authMode === 'supabase') {
          // Deleting the auth user needs the service role, which the browser
          // must never hold. Signing out and clearing the device is what we can
          // honestly do here; the profile screen says so.
          getSupabase()?.auth.signOut()
        }
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {}
        setState({ ...INITIAL, ready: true })
      },

      saveProfile: async (p) => {
        if (authMode === 'supabase') {
          const supabase = getSupabase()
          // Read the id from the live session rather than from state: a save
          // immediately after sign-in can land before the listener has updated.
          const userId =
            state.authUserId ?? (await supabase?.auth.getUser())?.data.user?.id ?? null
          if (!supabase || !userId) {
            return { ok: false, error: 'You are not signed in. Sign in and try again.' }
          }
          const result = await saveProfileRow(supabase, userId, p)
          if (!result.ok) {
            setState((s) => ({ ...s, profileError: result.error }))
            return { ok: false, error: result.error }
          }
        }
        setState((s) => ({ ...s, profile: p, profileError: null }))
        return { ok: true }
      },

      updateProfile: async (p) => {
        const next = state.profile ? { ...state.profile, ...p } : null
        if (!next) return { ok: false, error: 'There is no profile to update yet.' }

        if (authMode === 'supabase') {
          const supabase = getSupabase()
          const userId = state.authUserId
          if (!supabase || !userId) {
            return { ok: false, error: 'You are not signed in. Sign in and try again.' }
          }
          const result = await saveProfileRow(supabase, userId, next)
          if (!result.ok) {
            setState((s) => ({ ...s, profileError: result.error }))
            return { ok: false, error: result.error }
          }
        }
        setState((s) => ({ ...s, profile: next, profileError: null }))
        return { ok: true }
      },
      /**
       * Writes to the database first and only then to state, so the list on
       * screen never shows a score the server rejected.
       */
      addCredit: async (entry) => {
        if (authMode === 'supabase') {
          const supabase = getSupabase()
          const userId =
            state.authUserId ?? (await supabase?.auth.getUser())?.data.user?.id ?? null
          if (!supabase || !userId) {
            return { ok: false, error: 'You are not signed in. Sign in and try again.' }
          }
          const written = await insertCredit(supabase, userId, entry)
          if (!written.ok) {
            setState((s) => ({ ...s, syncError: written.error }))
            return { ok: false, error: written.error }
          }
        }
        setState((s) => ({
          ...s,
          // Kept oldest-first to match the order the server read uses, because
          // the app treats the last entry as the current score.
          credit: [...s.credit, entry],
          syncError: null,
        }))
        return { ok: true }
      },
      saveScenario: (sc) => setState((s) => ({ ...s, scenarios: [sc, ...s.scenarios].slice(0, 12) })),
      removeScenario: (id) =>
        setState((s) => ({ ...s, scenarios: s.scenarios.filter((x) => x.id !== id) })),
      addQuotation: (q) => setState((s) => ({ ...s, quotations: [q, ...s.quotations].slice(0, 20) })),
      toggleSavedVehicle: (id) =>
        setState((s) => ({
          ...s,
          savedVehicleIds: s.savedVehicleIds.includes(id)
            ? s.savedVehicleIds.filter((x) => x !== id)
            : [...s.savedVehicleIds, id],
        })),
      /**
       * Adding a document writes a row; clearing one deletes it. Only the file
       * NAME travels: the file itself is never uploaded or read, here or before.
       */
      setDocument: async (id, fileName, docDate) => {
        if (authMode === 'supabase') {
          const supabase = getSupabase()
          const userId =
            state.authUserId ?? (await supabase?.auth.getUser())?.data.user?.id ?? null
          if (!supabase || !userId) {
            return { ok: false, error: 'You are not signed in. Sign in and try again.' }
          }
          const written = fileName
            ? await upsertDocument(supabase, userId, id, fileName, docDate)
            : await deleteDocument(supabase, userId, id)
          if (!written.ok) {
            setState((s) => ({ ...s, syncError: written.error }))
            return { ok: false, error: written.error }
          }
        }
        setState((s) => ({
          ...s,
          syncError: null,
          documents: s.documents.map((d) =>
            d.id === id
              ? fileName
                ? {
                    ...d,
                    fileName,
                    status: 'added',
                    addedAt: new Date().toISOString(),
                    docDate: docDate || d.docDate,
                  }
                : { ...d, fileName: '', status: 'missing', addedAt: undefined, docDate: undefined }
              : d,
          ),
        }))
        return { ok: true }
      },
      addChat: (m) => setState((s) => ({ ...s, chat: [...s.chat, m] })),
      clearChat: () => setState((s) => ({ ...s, chat: [] })),
      completeRights: (id) =>
        setState((s) => ({
          ...s,
          completedRights: s.completedRights.includes(id)
            ? s.completedRights
            : [...s.completedRights, id],
        })),
      markMarketVisited: () => setState((s) => (s.visitedMarket ? s : { ...s, visitedMarket: true })),
      markInsuranceCompared: () =>
        setState((s) => (s.comparedInsurance ? s : { ...s, comparedInsurance: true })),
      recordComparison: (event) =>
        setState((s) => ({ ...s, comparisonEvents: [...s.comparisonEvents, event].slice(-50) })),
      saveComparison: (c) =>
        setState((s) => ({ ...s, savedComparisons: [c, ...s.savedComparisons].slice(0, 20) })),
      renameComparison: (id, name) =>
        setState((s) => ({
          ...s,
          savedComparisons: s.savedComparisons.map((x) =>
            x.id === id ? { ...x, name, updatedAt: new Date().toISOString() } : x,
          ),
        })),
      removeComparison: (id) =>
        setState((s) => ({
          ...s,
          savedComparisons: s.savedComparisons.filter((x) => x.id !== id),
        })),
      createShare: (share) =>
        setState((s) => ({
          ...s,
          // Expired links are dropped on write, not merely hidden.
          comparisonShares: [share, ...s.comparisonShares.filter((x) => !isExpired(x))].slice(0, 20),
        })),
      updatePreferences: (p) =>
        setState((s) =>
          s.profile
            ? { ...s, profile: { ...s.profile, preferences: { ...preferences, ...p } } }
            : s,
        ),
      dismissSuggestion: (vehicleId) =>
        setState((s) => {
          if (!s.profile) return s
          const current = s.profile.preferences ?? DEFAULT_PREFERENCES
          if (current.dismissedSuggestionIds.includes(vehicleId)) return s
          return {
            ...s,
            profile: {
              ...s.profile,
              preferences: {
                ...current,
                dismissedSuggestionIds: [...current.dismissedSuggestionIds, vehicleId],
              },
            },
          }
        }),
      markNotificationsRead: () =>
        setState((s) => {
          const ids = notifications.map((n) => n.id)
          const merged = Array.from(new Set([...s.readNotificationIds, ...ids]))
          return merged.length === s.readNotificationIds.length ? s : { ...s, readNotificationIds: merged }
        }),
      setTheme: (t) => setState((s) => ({ ...s, theme: t })),
      /* ---- support (consumer side) ---- */
      addTicket: (t) => setState((s) => ({ ...s, tickets: [t, ...s.tickets].slice(0, 200) })),
      addTicketReply: (r) =>
        setState((s) => ({
          ...s,
          ticketReplies: [...s.ticketReplies, r],
          tickets: s.tickets.map((t) =>
            t.id === r.ticketId ? { ...t, updatedAt: r.createdAt } : t,
          ),
        })),

      /* ---- staff ---- */
      staffSignIn: (session) => setState((s) => ({ ...s, staffSession: session })),
      staffSignOut: () => setState((s) => ({ ...s, staffSession: null })),
      recordStaffAttempt: (attempt) =>
        setState((s) => ({ ...s, staffAttempts: [...s.staffAttempts, attempt].slice(-50) })),
      touchStaffSession: () =>
        setState((s) =>
          s.staffSession
            ? { ...s, staffSession: { ...s.staffSession, lastActiveAt: new Date().toISOString() } }
            : s,
        ),
      audit: (entry) => setState((s) => ({ ...s, auditLog: [entry, ...s.auditLog].slice(0, 500) })),
      updateTicket: (id, patch) =>
        setState((s) => ({
          ...s,
          tickets: s.tickets.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
          ),
        })),
      softDeleteTicket: (id) =>
        setState((s) => ({
          ...s,
          tickets: s.tickets.map((t) =>
            t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t,
          ),
        })),
      updateSystemSettings: (patch) =>
        setState((s) => ({ ...s, systemSettings: { ...s.systemSettings, ...patch } })),
      updateContent: (patch) =>
        setState((s) => ({ ...s, contentSnippets: { ...s.contentSnippets, ...patch } })),
      upsertSnippet: (snippet) =>
        setState((s) => ({
          ...s,
          supportSnippets: s.supportSnippets.some((x) => x.id === snippet.id)
            ? s.supportSnippets.map((x) => (x.id === snippet.id ? snippet : x))
            : [...s.supportSnippets, snippet],
        })),
      removeSnippet: (id) =>
        setState((s) => ({ ...s, supportSnippets: s.supportSnippets.filter((x) => x.id !== id) })),
      setGuardianRules: (rules) => setState((s) => ({ ...s, guardianRules: rules })),
      upsertStaffAccount: (account) =>
        setState((s) => ({
          ...s,
          staffAccounts: s.staffAccounts.some((a) => a.id === account.id)
            ? s.staffAccounts.map((a) => (a.id === account.id ? account : a))
            : [...s.staffAccounts, account],
        })),
      // Soft revoke: the account stays for the audit trail, it just cannot sign in.
      revokeStaffAccount: (id) =>
        setState((s) => ({
          ...s,
          staffAccounts: s.staffAccounts.map((a) => (a.id === id ? { ...a, active: false } : a)),
        })),
      toggleSuspendEmail: (email) =>
        setState((s) => ({
          ...s,
          suspendedEmails: s.suspendedEmails.includes(email)
            ? s.suspendedEmails.filter((e) => e !== email)
            : [...s.suspendedEmails, email],
        })),
      revokeAllStaffSessions: () => setState((s) => ({ ...s, staffSession: null })),

      exportData: () => {
        const { ready: _ready, ...rest } = state
        return JSON.stringify(rest, null, 2)
      },
    }
  }, [state, authMode])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider')
  return ctx
}
