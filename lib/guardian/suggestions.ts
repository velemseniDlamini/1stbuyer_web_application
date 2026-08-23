// Page-aware opening prompts, and the route-to-page mapping behind them.
//
// Pure functions with no React and no store, so both can be unit-tested and
// neither can drift from what the panel actually shows.

import type { PageId } from './protocol'

/**
 * Map a pathname to the page id Guardian reasons about.
 *
 * The Explore screen hosts Used, Brand new, Rivals and Dealers as tabs on one
 * route, so the tab is passed separately rather than read from the URL.
 */
export function pageIdFor(pathname: string, exploreTab?: string): PageId {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'

  if (path === '/') return 'dashboard'
  if (path.startsWith('/journey')) return 'journey'
  if (path.startsWith('/explore')) {
    if (exploreTab === 'new') return 'new-cars'
    if (exploreTab === 'rivals') return 'rivals'
    return 'explore'
  }
  if (path.startsWith('/compare')) return 'compare'
  if (path.startsWith('/credit')) return 'credit'
  if (path.startsWith('/finance')) return 'finance'
  if (path.startsWith('/documents')) return 'documents'
  if (path.startsWith('/insurance')) return 'insurance'
  if (path.startsWith('/profile')) return 'profile'
  if (path.startsWith('/support')) return 'support'
  return 'other'
}

/**
 * What to offer before the user has typed anything.
 *
 * Four per screen, phrased the way a first-time buyer would actually ask, and
 * relevant to what is on screen: "Explain this premium" belongs on the
 * insurance screen and nowhere else.
 */
const BY_PAGE: Record<PageId, string[]> = {
  dashboard: [
    'Where am I in the buying journey?',
    'What should I do next?',
    'What can I realistically afford?',
    'How do I use this app?',
  ],
  journey: [
    'What does this stage need from me?',
    'Why does the order of the stages matter?',
    'What unlocks the next stage?',
    'Which stage matters most before I visit a dealer?',
  ],
  explore: [
    'What should I check on a used car?',
    'Is this a good price for this car?',
    'What will this cost me a month?',
    'How do I compare two cars properly?',
  ],
  'new-cars': [
    'What will this car cost me to run?',
    'Why is there no power figure for some cars?',
    'Is a new car better value than a used one?',
    'What is not included in a list price?',
  ],
  rivals: [
    'What are this car\'s main competitors?',
    'How were these rivals chosen?',
    'What should I compare beyond price?',
    'Which of these is cheapest to run?',
  ],
  compare: [
    'Which of these should I pick?',
    'What is the real difference between them?',
    'Why is one instalment higher?',
    'What is this comparison not telling me?',
  ],
  credit: [
    'Explain my credit score',
    'What interest rate should I be quoted?',
    'What can improve my position?',
    'How does my score affect affordability?',
  ],
  finance: [
    'What should I know about a balloon payment?',
    'Why is this instalment so high?',
    'Is a longer term a good idea?',
    'How much deposit should I put down?',
  ],
  documents: [
    'What documents do I need for finance?',
    'Why do the dates on documents matter?',
    'What fees should I question on a quotation?',
    'What should I ask the dealer?',
  ],
  quotation: [
    'Explain this quotation',
    'What fees should I question?',
    'Are there unusual charges here?',
    'What should I ask the dealer about this?',
  ],
  insurance: [
    'Explain this premium',
    'What does the excess mean?',
    'What cover does a financed car need?',
    'What should I compare between insurers?',
  ],
  profile: [
    'What does this app do with my data?',
    'Where am I in the buying journey?',
    'What should I do next?',
    'How do I use this app?',
  ],
  support: [
    'What should I include in a ticket?',
    'Can you help before I raise a ticket?',
    'Where am I in the buying journey?',
    'How do I use this app?',
  ],
  other: [
    'What can you help me with?',
    'Where am I in the buying journey?',
    'What should I do next?',
    'Explain my credit score',
  ],
}

export function suggestionsFor(page: PageId): string[] {
  return BY_PAGE[page] ?? BY_PAGE.other
}
