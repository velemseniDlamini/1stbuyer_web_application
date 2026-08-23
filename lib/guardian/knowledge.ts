// Guardian's knowledge base, and the only place its citations can come from.
//
// WHY THE CITATIONS LIVE HERE AND NOT IN THE MODEL
//
// A language model will happily produce "Consumer Protection Act, s61(4)(b)"
// for a claim it invented. That is the single worst failure mode for an app
// whose whole promise is that it does not make things up. So Guardian is never
// allowed to write a citation: it writes a marker, [[cite:id]], and the server
// swaps each marker for a real entry from this file, dropping any id that does
// not exist here. A fabricated citation cannot survive that round trip.
//
// Every entry below is derived from content the app already ships and already
// stands behind: the rights modules, the finance bands, the insurance model,
// the quotation benchmarks. Nothing new is asserted here. If a claim is not in
// the app, it does not get a citation, and Guardian has to say it does not know.

import { LEGAL_REFERENCES } from '../legal-references'
import { CREDIT_BANDS, PRIME_RATE, PRIME_LAST_UPDATED } from '../finance'
import { BENCHMARKS_UPDATED } from '../quotation'
import { COVER_TYPES, PREMIUMS_REVIEWED, REFERENCE_VEHICLE_PRICE } from '../insurance'
import { CATALOGUE_SOURCE } from '../data'
import { NEW_CAR_SOURCES, SOURCED_FUEL_PRICE } from '../new-cars-source'
import { MARKET_METHODOLOGY } from '../market-value'
import { formatZAR } from '../format'

export type KnowledgeTopic =
  | 'rights'
  | 'credit'
  | 'finance'
  | 'quotation'
  | 'insurance'
  | 'vehicles'
  | 'app'

export type KnowledgeEntry = {
  id: string
  topic: KnowledgeTopic
  title: string
  /** Terms that should surface this entry. Matched as whole words. */
  keywords: string[]
  /** The text handed to the model. Plain, factual, already app-approved. */
  body: string
  /** Shown to the user when the model cites this entry. */
  citationLabel: string
  /** Where to read the source inside the app. */
  href?: string
  /** External authority, where one exists. */
  url?: string
}

/* ------------------------------------------------ rights, from the app --- */

// Built from the modules the Rights screen already teaches, so Guardian and
// the screen can never disagree about what the law says.
const RIGHTS_ENTRIES: KnowledgeEntry[] = LEGAL_REFERENCES.map((module) => ({
  id: `rights.${module.id}`,
  topic: 'rights' as const,
  title: module.title,
  keywords: [
    ...module.title.toLowerCase().split(/\s+/),
    ...module.law.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/),
  ].filter((w) => w.length > 3),
  body: `${module.summary}\n\nKey points:\n${module.points.map((p) => `- ${p}`).join('\n')}`,
  citationLabel: module.law,
}))

/* ------------------------------------------------------ curated topics --- */

const CURATED: KnowledgeEntry[] = [
  {
    id: 'credit.bands',
    topic: 'credit',
    title: 'How this app maps a credit score to a rate expectation',
    keywords: ['score', 'band', 'bands', 'credit', 'bureau', 'rate', 'interest', 'prime', 'expect'],
    body: [
      `1st Buyer uses a 0-999 bureau-style scale and maps it to a target margin over prime. Prime is ${PRIME_RATE}% (recorded ${PRIME_LAST_UPDATED}).`,
      ...CREDIT_BANDS.map(
        (b) => `- ${b.label} (${b.min}-${b.max}): target Prime + ${b.spread}%. ${b.summary}`,
      ),
      'These are the app\'s own targets for negotiation, not offers. No lender has seen this buyer, and a lender prices on far more than a score: affordability, employment, deposit, the vehicle itself and its own appetite at the time.',
    ].join('\n'),
    citationLabel: '1st Buyer credit bands',
    href: '/credit',
  },
  {
    id: 'credit.limits',
    topic: 'credit',
    title: 'What a score cannot tell you',
    keywords: ['approve', 'approved', 'approval', 'reject', 'decline', 'guarantee', 'qualify', 'chances'],
    body: [
      'A credit score does not decide an application on its own and this app cannot predict a lender\'s decision.',
      'The score in this app is self-reported: the user typed in what their bureau told them. 1st Buyer does not pull bureau data and is not a credit provider.',
      'Under the National Credit Act a lender must run its own affordability assessment before granting credit, so the outcome depends on income, expenses and existing debt, not the score alone.',
    ].join('\n'),
    citationLabel: 'National Credit Act, s80-s83 (affordability assessment)',
  },
  {
    id: 'finance.balloon',
    topic: 'finance',
    title: 'Balloon payments',
    keywords: ['balloon', 'residual', 'lump', 'final', 'payment', 'deferred'],
    body: [
      'A balloon (residual) payment defers part of the purchase price to the end of the term. It lowers the monthly instalment because the buyer is financing less each month, not because the car costs less.',
      'The deferred amount keeps accruing interest for the whole term, so the total paid is higher than the same deal without a balloon.',
      'When the term ends the balloon falls due as a single amount. It must be settled in cash, refinanced (a new agreement at whatever rate applies then), or covered by trading the car in, which only works if the car is worth more than the balloon.',
      'A buyer can be in negative equity for most of a ballooned term: owing more than the car is worth.',
    ].join('\n'),
    citationLabel: 'National Credit Act, s92 (pre-agreement cost disclosure)',
    href: '/finance',
  },
  {
    id: 'finance.calculator',
    topic: 'finance',
    title: 'How the app calculates an instalment',
    keywords: ['instalment', 'installment', 'monthly', 'calculate', 'deposit', 'term', 'repayment', 'total'],
    body: [
      'The Finance screen uses a standard amortisation on the financed amount: price, minus deposit, plus fees, over the chosen term at the chosen rate, with any balloon deducted from the amortised balance and settled at the end.',
      'Every instalment shown anywhere in the app is an estimate produced by that calculator from figures the user entered. It is not a quotation and no lender has priced it.',
      'The app refuses to estimate an instalment at all until the user records a real credit score, because a rate assumption without a score is a guess presented as a number.',
    ].join('\n'),
    citationLabel: '1st Buyer finance calculator',
    href: '/finance',
  },
  {
    id: 'quotation.benchmarks',
    topic: 'quotation',
    title: 'How the app reads a dealer quotation',
    keywords: ['quotation', 'quote', 'fee', 'fees', 'markup', 'mark', 'initiation', 'admin', 'tracking', 'credit life', 'line'],
    body: [
      `The Quotation Analyser compares each line against market reference points reviewed ${BENCHMARKS_UPDATED}, and scores the quote out of 100.`,
      'It looks at: the interest rate against the buyer\'s own credit-band target, the initiation fee, the monthly admin fee, credit life cover, tracking, and balloon exposure.',
      'A flagged line means the figure sits outside the app\'s reference range and is worth asking the dealer to explain. It does not mean the dealer has done anything unlawful: initiation fees, admin fees, credit life and tracking are all legitimate charges, and the NCA caps some of them rather than banning them.',
      'The right response to a flag is a question to the dealer, in writing, not an accusation.',
    ].join('\n'),
    citationLabel: '1st Buyer quotation benchmarks',
    href: '/documents',
  },
  {
    id: 'insurance.model',
    topic: 'insurance',
    title: 'What the insurance comparison actually is',
    keywords: ['insurance', 'premium', 'excess', 'cover', 'comprehensive', 'insurer', 'third party'],
    body: [
      `The Insurance screen models indicative monthly premiums. It is NOT a quote: no insurer has seen this driver or this car. Base premiums are placeholders benchmarked against a ${formatZAR(REFERENCE_VEHICLE_PRICE)} vehicle and last reviewed ${PREMIUMS_REVIEWED}.`,
      ...COVER_TYPES.map((c) => `- ${c.label}: ${c.blurb}`),
      'The excess is the amount the policyholder pays out of their own pocket on each claim. A lower premium usually means a higher excess.',
      'A financed car normally has to carry comprehensive cover for the whole term: that is a condition of the finance agreement, not a legal requirement.',
      'Real premiums depend on the driver\'s age, licence history, claims history, where the car sleeps and the insurer\'s own rating. Only a real quote settles it.',
    ].join('\n'),
    citationLabel: '1st Buyer insurance model',
    href: '/insurance',
  },
  {
    id: 'vehicles.data',
    topic: 'vehicles',
    title: 'Where the app\'s vehicle figures come from, and where they stop',
    keywords: ['spec', 'specs', 'specification', 'consumption', 'fuel', 'listing', 'price', 'mileage', 'catalogue', 'reliability'],
    body: [
      `Used listings: ${CATALOGUE_SOURCE.label}. ${CATALOGUE_SOURCE.detail}`,
      `The brand-new catalogue is different: every row was read off a published article and carries the publisher, the URL and the publication date. Sources include ${Object.values(NEW_CAR_SOURCES).map((s) => s.publisher).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.`,
      `Running costs use a pump price of R${SOURCED_FUEL_PRICE.pricePerLitre} a litre unless the user changes it.`,
      'Consumption figures are manufacturer claims quoted by the source, measured on a laboratory cycle. Real-world use is worse, for every car.',
      'The app holds NO sourced South African reliability, service-cost or resale data. Guardian must say so rather than rank cars on reliability.',
    ].join('\n'),
    citationLabel: '1st Buyer catalogue provenance',
    href: '/explore',
  },
  {
    id: 'vehicles.market',
    topic: 'vehicles',
    title: 'How the app judges whether a listing is priced well',
    keywords: ['deal', 'overpriced', 'cheap', 'expensive', 'market', 'value', 'worth', 'fair'],
    body: [
      MARKET_METHODOLOGY.summary,
      'It needs enough comparable cars before it will state a range at all. With too few peers it says so instead of inventing a market value.',
      'This is a sample catalogue, so a "good deal" verdict describes this data set, not the national market.',
    ].join('\n'),
    citationLabel: '1st Buyer market-value method',
    href: '/explore',
  },
  {
    id: 'app.honesty',
    topic: 'app',
    title: 'The rule the whole app is built on',
    keywords: ['sure', 'certain', 'accurate', 'trust', 'guess', 'estimate', 'know'],
    body: [
      '1st Buyer never fills a gap with an invented value. A figure it does not hold is shown as "Not listed" rather than estimated.',
      'It will not produce an instalment, an affordability verdict or a rate target without a real credit score from the user.',
      'Everything derived rather than sourced is labelled as an estimate, with its assumptions shown.',
    ].join('\n'),
    citationLabel: '1st Buyer data policy',
  },
]

export const KNOWLEDGE: KnowledgeEntry[] = [...RIGHTS_ENTRIES, ...CURATED]

/** Fast lookup for turning a [[cite:id]] marker back into a real citation. */
export const KNOWLEDGE_BY_ID: Map<string, KnowledgeEntry> = new Map(
  KNOWLEDGE.map((entry) => [entry.id, entry]),
)
