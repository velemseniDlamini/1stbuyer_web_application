export type JourneyStageId =
  | 'know-yourself'
  | 'know-rights'
  | 'know-market'
  | 'know-deal'
  | 'find-car'
  | 'seal-deal'
  | 'protect-ride'

export type JourneyStage = {
  id: JourneyStageId
  index: number
  title: string
  blurb: string
  action: string
  href: string
  unlockedBy: string
}

export const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 'know-yourself',
    index: 1,
    title: 'Know Yourself',
    blurb: 'Record your credit score and see the rate band you should be quoted.',
    action: 'Record your credit score',
    href: '/credit',
    unlockedBy: 'Recording a credit score',
  },
  {
    id: 'know-rights',
    index: 2,
    title: 'Know Your Rights',
    blurb: 'Learn the CPA and NCA protections that apply the moment you sign.',
    action: 'Complete a rights module',
    href: '/rights',
    unlockedBy: 'Completing one rights module',
  },
  {
    id: 'know-market',
    index: 3,
    title: 'Know the Market',
    blurb: 'Browse listings, then put two cars side by side on the same questions.',
    action: 'Explore the market',
    href: '/explore',
    unlockedBy: 'Opening the market view, or comparing two cars with a recorded score',
  },
  {
    id: 'know-deal',
    index: 4,
    title: 'Know Your Deal',
    blurb: 'Model instalment, interest, total cost and balloon exposure.',
    action: 'Run the finance calculator',
    href: '/finance',
    unlockedBy: 'Saving a finance scenario',
  },
  {
    id: 'find-car',
    index: 5,
    title: 'Find Your Car',
    blurb: 'Save the vehicles you are serious about and compare them.',
    action: 'Save a vehicle',
    href: '/explore',
    unlockedBy: 'Saving at least one vehicle',
  },
  {
    id: 'seal-deal',
    index: 6,
    title: 'Seal the Deal',
    blurb: 'Analyse a dealer quote line by line and get negotiation points.',
    action: 'Analyse a quotation',
    href: '/documents',
    unlockedBy: 'Analysing a quotation',
  },
  {
    id: 'protect-ride',
    index: 7,
    title: 'Protect Your Ride',
    blurb: 'Compare indicative insurance premiums across six insurers.',
    action: 'Compare insurance',
    href: '/insurance',
    unlockedBy: 'Comparing insurance',
  },
]
