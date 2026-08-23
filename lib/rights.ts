export type QuizQuestion = {
  q: string
  options: string[]
  answer: number
  explain: string
}

export type RightsModule = {
  id: string
  title: string
  law: string
  summary: string
  points: string[]
  quiz: QuizQuestion[]
}

// Plain-language South African consumer-law content. Each module cites the
// relevant statute. This is education, not legal advice.
export const RIGHTS_MODULES: RightsModule[] = [
  {
    id: 'cpa-used-car',
    title: 'Your used-car warranty',
    law: 'Consumer Protection Act, s55 & s56',
    summary:
      'Every used vehicle from a registered dealer comes with an implied warranty of quality, it must be safe, of good quality, usable and durable. This applies even if the contract says "voetstoots".',
    points: [
      'The implied warranty lasts 6 months from delivery under s56.',
      'If the car fails, you may demand a repair, replacement or refund: your choice, not the dealer\'s.',
      'A "voetstoots" (as-is) clause does NOT override the CPA for a registered dealer.',
      'Private sales between individuals are treated differently, the CPA warranty generally does not apply.',
    ],
    quiz: [
      {
        q: 'A dealer says the car is sold "voetstoots" so you have no comeback. Are they correct?',
        options: ['Yes, voetstoots means no warranty', 'No, the CPA implied warranty still applies', 'Only if you paid cash'],
        answer: 1,
        explain: 'For a registered dealer, s55/s56 of the CPA give a 6-month implied warranty regardless of a voetstoots clause.',
      },
      {
        q: 'How long does the CPA implied warranty last on a used car from a dealer?',
        options: ['30 days', '6 months', '2 years'],
        answer: 1,
        explain: 'Section 56 provides a 6-month implied warranty from the date of delivery.',
      },
    ],
  },
  {
    id: 'nca-affordability',
    title: 'Affordability & reckless credit',
    law: 'National Credit Act, s80-83',
    summary:
      'A lender must assess whether you can actually afford the finance before granting it. Lending without a proper affordability check can be declared reckless credit.',
    points: [
      'The lender must check your income, expenses and existing debt (s81).',
      'Credit granted without this assessment can be set aside as reckless (s83).',
      'You are entitled to see the cost breakdown before signing (s92).',
      'You can settle the agreement early and pay less total interest (s125).',
    ],
    quiz: [
      {
        q: 'A lender approves finance without checking your other debts. This may be:',
        options: ['Perfectly normal', 'Reckless credit under the NCA', 'Illegal to even ask about'],
        answer: 1,
        explain: 'Failing to conduct an affordability assessment can make the agreement reckless credit under s80-83.',
      },
    ],
  },
  {
    id: 'interest-rates',
    title: 'What rate you should be quoted',
    law: 'National Credit Act, s101 & prime linking',
    summary:
      'Vehicle finance is usually priced as "prime plus a margin". The stronger your credit record, the smaller the margin should be. The dealer\'s first offer is rarely their best.',
    points: [
      `The prime lending rate is currently used as the base. A strong score should get you close to prime.`,
      'The NCA caps the maximum interest a lender may charge (s105 regulations).',
      'Initiation and service fees are also capped. They are not open-ended.',
      'Always ask for the rate in writing and compare it to your credit band target.',
    ],
    quiz: [
      {
        q: 'The dealer offers Prime + 3.5% but your score is excellent. You should:',
        options: ['Accept, dealers set the rate', 'Negotiate; a strong score should get closer to prime', 'Walk away entirely'],
        answer: 1,
        explain: 'An excellent score should be quoted close to prime. The margin is negotiable, especially with a bank pre-approval.',
      },
    ],
  },
  {
    id: 'roadworthy-enatis',
    title: 'Roadworthy & ownership transfer',
    law: 'National Road Traffic Act & eNaTIS',
    summary:
      'Before a car can be registered in your name it needs a valid roadworthy certificate, and ownership must be transferred on eNaTIS. Do not drive away without the paperwork moving.',
    points: [
      'A roadworthy certificate is required to register a change of ownership.',
      'Change of ownership must be lodged at a registering authority (eNaTIS) within 21 days.',
      'Keep the signed NCO (Notification of Change of Ownership) form as proof.',
      'Confirm there is no outstanding finance on the vehicle before paying.',
    ],
    quiz: [
      {
        q: 'How long do you have to notify the change of ownership after buying?',
        options: ['21 days', '90 days', 'No time limit'],
        answer: 0,
        explain: 'Change of ownership should be lodged within 21 days at a registering authority via eNaTIS.',
      },
    ],
  },
  {
    id: 'finance-docs',
    title: 'The documents you will need',
    law: 'FICA & lender requirements',
    summary:
      'Finance applications require FICA documents. Having them ready speeds approval and prevents the dealer from stalling on "still waiting for paperwork".',
    points: [
      'South African ID or passport (FICA requirement).',
      'Valid driver\'s licence.',
      'Proof of residence not older than 3 months.',
      'Latest payslip and 3 months of bank statements.',
    ],
    quiz: [
      {
        q: 'How recent must your proof of residence usually be?',
        options: ['Within 3 months', 'Within 2 years', 'Any date is fine'],
        answer: 0,
        explain: 'FICA generally requires proof of residence not older than 3 months.',
      },
    ],
  },
]
