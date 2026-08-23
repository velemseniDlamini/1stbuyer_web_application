// South African consumer-law reference, for the Chatbot's citations.
//
// WHY THIS FILE EXISTS
//
// The user-facing "Know Your Rights" screen, its quizzes and its journey stage
// were removed. The law it taught was not removed with it: this app's promise
// is that every legal answer cites the statute it rests on, and deleting the
// corpus would have left the Chatbot answering CPA and NCA questions from model
// memory, which is exactly the fabrication this codebase is built to prevent.
//
// So the SCREEN is gone and the SOURCE MATERIAL stayed. Nothing here is
// rendered to a buyer directly; it is retrieved by lib/guardian/knowledge.ts and
// quoted with its citation attached.
//
// This is plain-language education, not legal advice.

export type LegalReference = {
  id: string
  title: string
  /** The statute, quoted verbatim as the citation label. */
  law: string
  summary: string
  points: string[]
}

export const LEGAL_REFERENCES: LegalReference[] = [
  {
    id: 'cpa-used-car',
    title: "Your used-car warranty",
    law: "Consumer Protection Act, s55 & s56",
    summary:
      "Every used vehicle from a registered dealer comes with an implied warranty of quality, it must be safe, of good quality, usable and durable. This applies even if the contract says \"voetstoots\".",
    points: [
      "The implied warranty lasts 6 months from delivery under s56.",
      "If the car fails, you may demand a repair, replacement or refund: your choice, not the dealer's.",
      "A \"voetstoots\" (as-is) clause does NOT override the CPA for a registered dealer.",
      "Private sales between individuals are treated differently, the CPA warranty generally does not apply.",
    ],
  },
  {
    id: 'nca-affordability',
    title: "Affordability & reckless credit",
    law: "National Credit Act, s80-83",
    summary:
      "A lender must assess whether you can actually afford the finance before granting it. Lending without a proper affordability check can be declared reckless credit.",
    points: [
      "The lender must check your income, expenses and existing debt (s81).",
      "Credit granted without this assessment can be set aside as reckless (s83).",
      "You are entitled to see the cost breakdown before signing (s92).",
      "You can settle the agreement early and pay less total interest (s125).",
    ],
  },
  {
    id: 'interest-rates',
    title: "What rate you should be quoted",
    law: "National Credit Act, s101 & prime linking",
    summary:
      "Vehicle finance is usually priced as \"prime plus a margin\". The stronger your credit record, the smaller the margin should be. The dealer's first offer is rarely their best.",
    points: [
      "The prime lending rate is currently used as the base. A strong score should get you close to prime.",
      "The NCA caps the maximum interest a lender may charge (s105 regulations).",
      "Initiation and service fees are also capped. They are not open-ended.",
      "Always ask for the rate in writing and compare it to your credit band target.",
    ],
  },
  {
    id: 'roadworthy-enatis',
    title: "Roadworthy & ownership transfer",
    law: "National Road Traffic Act & eNaTIS",
    summary:
      "Before a car can be registered in your name it needs a valid roadworthy certificate, and ownership must be transferred on eNaTIS. Do not drive away without the paperwork moving.",
    points: [
      "A roadworthy certificate is required to register a change of ownership.",
      "Change of ownership must be lodged at a registering authority (eNaTIS) within 21 days.",
      "Keep the signed NCO (Notification of Change of Ownership) form as proof.",
      "Confirm there is no outstanding finance on the vehicle before paying.",
    ],
  },
  {
    id: 'finance-docs',
    title: "The documents you will need",
    law: "FICA & lender requirements",
    summary:
      "Finance applications require FICA documents. Having them ready speeds approval and prevents the dealer from stalling on \"still waiting for paperwork\".",
    points: [
      "South African ID or passport (FICA requirement).",
      "Valid driver's licence.",
      "Proof of residence not older than 3 months.",
      "Latest payslip and 3 months of bank statements.",
    ],
  },
]
