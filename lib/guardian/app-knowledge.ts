// What Guardian knows about the application it lives in.
//
// Derived from the same modules the navigation and the journey screen read, so
// Guardian cannot describe a screen that does not exist or miss one that was
// added. If a stage is renamed in lib/journey.ts, Guardian's answer changes
// with it and nobody has to remember to edit a prompt.

import { JOURNEY_STAGES } from '../journey'
import { PRIMARY_TABS, TOOL_LINKS } from '../navigation'
import type { PageId } from './protocol'

/** Where each page lives, so Guardian can point the user at it. */
export const PAGE_ROUTES: Record<PageId, string> = {
  dashboard: '/',
  journey: '/journey',
  explore: '/explore',
  'new-cars': '/explore',
  rivals: '/explore',
  compare: '/compare',
  credit: '/credit',
  finance: '/finance',
  documents: '/documents',
  quotation: '/documents',
  insurance: '/insurance',
  profile: '/profile',
  support: '/support',
  other: '/',
}

/** One line per screen, in the app's own words where it has them. */
export const PAGE_PURPOSE: Record<PageId, string> = {
  dashboard: 'The home screen: credit score, estimated buying power, journey progress, saved cars and the next recommended step.',
  journey: 'The seven-stage buying journey, showing which stages are done and what unlocks the next one.',
  explore: 'Browsing the vehicle catalogue: used listings, brand-new cars, rivals and dealer branches.',
  'new-cars': 'The brand-new car catalogue, with sourced list prices, engine and consumption figures and estimated running costs.',
  rivals: 'Pick one new car and see its competitors, its opposites, and other derivatives of the same nameplate, all computed from published figures.',
  compare: 'Car Compare: two or three cars side by side on price, instalment, affordability, running costs and specifications.',
  credit: 'Recording a bureau credit score and seeing the interest-rate band it should buy.',
  finance: 'The finance calculator: instalment, interest, total cost and balloon exposure.',
  documents: 'The finance document pack checklist and the dealer quotation analyser.',
  quotation: 'The quotation analyser: a dealer quote read line by line against reference benchmarks.',
  insurance: 'Indicative insurance comparison across insurers and cover types.',
  profile: 'Account details, saved data and app settings.',
  support: 'Raising a support ticket and reading replies.',
  other: 'A part of the app the assistant has no specific description for.',
}

/** The journey stages, rendered for the prompt. Kept short: this ships every request. */
export function journeySummary(): string {
  return JOURNEY_STAGES.map(
    (s) => `${s.index}. ${s.title} (${s.id}) at ${s.href}: ${s.blurb} Unlocked by: ${s.unlockedBy.toLowerCase()}.`,
  ).join('\n')
}

/** Every destination Guardian is allowed to link to. */
export function navigationSummary(): string {
  return [...PRIMARY_TABS, ...TOOL_LINKS]
    .map((link) => `${link.label}: ${link.href}`)
    .join('\n')
}

/**
 * The set of hrefs Guardian may put in a link. A model asked for a deep link
 * will cheerfully invent /cars/toyota/hilux, which 404s. Anything not on this
 * list is dropped rather than shown to the user.
 */
export const ALLOWED_HREFS: ReadonlySet<string> = new Set([
  ...Object.values(PAGE_ROUTES),
  ...PRIMARY_TABS.map((t) => t.href),
  ...TOOL_LINKS.map((t) => t.href),
  ...JOURNEY_STAGES.map((s) => s.href),
  '/chat',
])

export const APP_SUMMARY = `1st Buyer is a South African first-time car-buyer companion. It exists to close the information gap between a first-time buyer and a dealership's finance desk.

It is not a dealer, not a lender, not a credit bureau and not an insurer. It sells nothing and earns no commission.

The app is organised as a staged journey:
${journeySummary()}

Screens the user can be sent to:
${navigationSummary()}`
