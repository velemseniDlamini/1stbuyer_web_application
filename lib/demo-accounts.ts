// Quick sign-in profiles.
//
// These are SAMPLE accounts for trying the app without typing a form. They are
// created on this device, exactly like any account in this build, and they are
// labelled as samples everywhere they appear. Nothing here pretends to be a
// real person's credit record.
//
// Each persona exists to reach a genuinely different state of the product, so
// the states that are hardest to reach by hand (no score, empty account) are
// one tap away:
//
//   ready      a returning buyer with a score, saved cars and history
//   unscored   a full profile with NO credit score, so every personalised
//              number is correctly locked
//   fresh      an account with no profile at all, landing in onboarding
//
// The seed is a pure function of the persona plus "now", so signing in twice
// gives the same shape with current dates rather than dates from 2026.

import type { CreditEntry, Profile, SavedComparison } from './store'
import { DEFAULT_DOCS, type DocItem } from './documents'

export type DemoPersonaId = 'ready' | 'unscored' | 'fresh'

export type DemoSeed = {
  email: string
  profile: Profile | null
  credit: CreditEntry[]
  savedVehicleIds: string[]
  documents: DocItem[]
  savedComparisons: SavedComparison[]
  visitedMarket: boolean
}

export type DemoPersona = {
  id: DemoPersonaId
  name: string
  /** What the tester will see. Stated plainly, no marketing. */
  summary: string
  /** The state this persona is useful for exercising. */
  demonstrates: string
  initials: string
  build: (now: Date) => DemoSeed
}

function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}

function dateYearsAgo(now: Date, years: number): string {
  const d = new Date(now)
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

/** Copy of the pack definition with one item filled in, for the ready persona. */
function packWith(now: Date, ids: string[]): DocItem[] {
  return DEFAULT_DOCS.map((doc) =>
    ids.includes(doc.id)
      ? {
          ...doc,
          fileName: `${doc.id}-sample.pdf`,
          status: 'added' as const,
          addedAt: isoDaysAgo(now, 3),
          docDate: doc.maxAgeMonths ? isoDaysAgo(now, 20).slice(0, 10) : undefined,
        }
      : doc,
  )
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'ready',
    name: 'Thandi Mokoena',
    initials: 'TM',
    summary: 'Score 712, two saved cars, a finance pack in progress',
    demonstrates: 'The returning buyer. Every personalised number is unlocked.',
    build: (now) => ({
      email: 'thandi.demo@demo.1stbuyer.co.za',
      profile: {
        firstName: 'Thandi',
        lastName: 'Mokoena',
        city: 'Johannesburg',
        province: 'Gauteng',
        employment: 'Permanently employed',
        monthlyIncome: 32000,
        dob: dateYearsAgo(now, 29),
        licenceDate: dateYearsAgo(now, 7),
        goal: 'My first car',
      },
      credit: [
        { score: 668, bureau: 'TransUnion MyCreditCheck', date: isoDaysAgo(now, 120) },
        { score: 712, bureau: 'TransUnion MyCreditCheck', date: isoDaysAgo(now, 14) },
      ],
      savedVehicleIds: ['v1', 'v5'],
      documents: packWith(now, ['id', 'licence', 'residence']),
      savedComparisons: [
        {
          id: 'demo-comparison-1',
          carIds: ['v1', 'v5'],
          name: 'Polo vs i20',
          createdAt: isoDaysAgo(now, 2),
        },
      ],
      visitedMarket: true,
    }),
  },
  {
    id: 'unscored',
    name: 'Sipho Ndlovu',
    initials: 'SN',
    summary: 'Full profile, no credit score recorded',
    demonstrates: 'The credit gate. Instalment and affordability stay locked.',
    build: (now) => ({
      email: 'sipho.demo@demo.1stbuyer.co.za',
      profile: {
        firstName: 'Sipho',
        lastName: 'Ndlovu',
        city: 'Cape Town',
        province: 'Western Cape',
        employment: 'Contract / temporary',
        monthlyIncome: 18500,
        dob: dateYearsAgo(now, 23),
        licenceDate: dateYearsAgo(now, 1),
        goal: 'My first car',
      },
      credit: [],
      savedVehicleIds: [],
      documents: DEFAULT_DOCS,
      savedComparisons: [],
      visitedMarket: false,
    }),
  },
  {
    id: 'fresh',
    name: 'Empty account',
    initials: 'NA',
    summary: 'Signed in with no profile yet',
    demonstrates: 'First run. Lands in onboarding with nothing recorded.',
    build: () => ({
      email: 'new.demo@demo.1stbuyer.co.za',
      profile: null,
      credit: [],
      savedVehicleIds: [],
      documents: DEFAULT_DOCS,
      savedComparisons: [],
      visitedMarket: false,
    }),
  },
]

export function personaById(id: string): DemoPersona | null {
  return DEMO_PERSONAS.find((p) => p.id === id) ?? null
}

/**
 * Password for every sample account. It is written down here on purpose:
 * these are shared demo logins, not anyone's private credential, and a
 * secret that three buttons on a public sign-in screen all use is not a
 * secret. Real accounts never share a password.
 */
export const DEMO_PASSWORD = 'SampleProfile2026'

export const DEMO_DISCLOSURE =
  'Sample profiles for trying the app. They create a real account in the database with sample details and no real credit data. Anyone with this app can sign into them, so do not put anything private in one.'
