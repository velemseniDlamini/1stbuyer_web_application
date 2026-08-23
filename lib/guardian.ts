import { PRIME_RATE, targetRateForScore, bandForScore, isUsableScore } from './finance'
import { VEHICLES } from './data'
import { MAX_COMPARE, MIN_COMPARE, compareHref } from './compare'

export type GuardianContext = {
  firstName?: string
  score?: number | null
  monthlyIncome?: number
  /** The question being answered, for rules that read the text itself. */
  question?: string
}

export type GuardianLink = { label: string; href: string }

export type GuardianReply = {
  matched: boolean
  title: string
  body: string
  citation?: string
  steps: string[]
  /** Every answer ends somewhere the user can act on it. */
  link?: GuardianLink
}

type Rule = {
  id: string
  keywords: string[]
  /**
   * Optional extra trigger for intent a keyword list cannot express. "Should I
   * get the Polo Vivo or the Corolla?" contains no comparison keyword at all,
   * the intent lives in the two model names. Still fully deterministic.
   */
  when?: (question: string) => boolean
  build: (ctx: GuardianContext) => GuardianReply
}

/**
 * Match model names mentioned in a question against the catalogue. Deliberately
 * simple and deterministic, a lowercase substring match on "make model" and on
 * the model alone, in catalogue order, deduplicated by model. No fuzzy scoring
 * library, no model call: Guardian stays a rule engine the team can read.
 */
export function matchVehiclesInQuestion(question: string) {
  const q = question.toLowerCase()
  const hits: typeof VEHICLES = []
  for (const v of VEHICLES) {
    const model = v.model.toLowerCase()
    const full = `${v.make} ${v.model}`.toLowerCase()
    if (!q.includes(model) && !q.includes(full)) continue
    // One listing per model: "Polo vs Corolla" means two cars, not two Polos.
    if (hits.some((h) => h.model.toLowerCase() === model)) continue
    hits.push(v)
    if (hits.length === MAX_COMPARE) break
  }
  return hits
}

// Guardian is a transparent, deterministic keyword matcher for v1, NOT a
// language model. It cites South African statute and gives concrete steps.
const RULES: Rule[] = [
  {
    id: 'interest-rate',
    keywords: ['interest', 'rate', 'prime', 'apr', 'percentage'],
    build: (ctx) => {
      const scoreLine = ctx.score
        ? `Your recorded score puts you in the "${bandForScore(ctx.score).label}" band, so aim for about Prime + ${(targetRateForScore(ctx.score) - PRIME_RATE).toFixed(1)}%, roughly ${targetRateForScore(ctx.score).toFixed(2)}%.`
        : `Record your credit score in the Credit tab and I can tell you the exact rate to target. As a rule, a strong score should sit close to prime (${PRIME_RATE}%).`
      return {
        matched: true,
        title: 'What interest rate should you accept?',
        body: `Vehicle finance is priced as prime plus a margin. The prime rate is currently ${PRIME_RATE}%. ${scoreLine} The dealer's first offer is a starting point, not a fixed rate.`,
        citation: 'National Credit Act, s101 & s105 (rate and fee caps).',
        steps: [
          'Get a pre-approval from your own bank first. It is your strongest bargaining chip.',
          'Ask the dealer for the rate in writing before signing anything.',
          'Compare it to your credit-band target and negotiate the margin down.',
        ],
      }
    },
  },
  {
    id: 'balloon',
    keywords: ['balloon', 'residual', 'lump sum', 'final payment'],
    build: () => ({
      matched: true,
      title: 'Balloon payments explained',
      body: 'A balloon (residual) payment lowers your monthly instalment by deferring a large chunk of the price to the end of the term. That deferred amount keeps accruing interest, and a five- or six-figure sum falls due when the term ends. You do not own the car outright until it is paid.',
      citation: 'National Credit Act, s92 (pre-agreement cost disclosure).',
      steps: [
        'Ask what the exact balloon amount will be in rands, not just a percentage.',
        'Plan how you will settle it, cash, refinance, or trade-in, before you sign.',
        'Model it in the Finance calculator to see the true total cost.',
      ],
    }),
  },
  {
    id: 'warranty',
    keywords: ['warranty', 'voetstoots', 'defect', 'faulty', 'broken', 'used car', 'second hand'],
    build: () => ({
      matched: true,
      title: 'Your used-car warranty rights',
      body: 'A used vehicle from a registered dealer carries an implied warranty of quality under the Consumer Protection Act, it must be safe, usable and durable. A "voetstoots" clause does not remove this for a dealer. The warranty runs for 6 months from delivery.',
      citation: 'Consumer Protection Act, s55 & s56.',
      steps: [
        'Report the defect to the dealer in writing as soon as you notice it.',
        'You may demand a repair, replacement or refund, the choice is yours.',
        'If refused, escalate to the Motor Industry Ombudsman of South Africa (MIOSA).',
      ],
    }),
  },
  {
    id: 'credit-check',
    keywords: ['credit', 'score', 'bureau', 'record', 'transunion', 'experian'],
    build: () => ({
      matched: true,
      title: 'Checking your credit position',
      body: 'You are entitled to one free credit report per year from each registered bureau. Knowing your score before you negotiate tells you what interest rate to expect and stops a dealer marking you up.',
      citation: 'National Credit Act, s72 (right to access your credit record).',
      steps: [
        'Get your score from TransUnion, Experian, ClearScore or XDS.',
        'Record it in the Credit tab to see your target rate band.',
        'Dispute any errors on your report before applying for finance.',
      ],
    }),
  },
  {
    id: 'affordability',
    keywords: ['afford', 'affordability', 'budget', 'income', 'salary', 'too expensive'],
    build: (ctx) => ({
      matched: true,
      title: 'Can you afford this deal?',
      body: `This app works from your take-home pay, and treats an instalment under about 28% of it as comfortable, since running costs come out of the same money.${ctx.monthlyIncome ? ` On your recorded income that is roughly R${Math.round(ctx.monthlyIncome * 0.28).toLocaleString('en-ZA')} a month.` : ''} A lender must run an affordability assessment before granting credit.`,
      citation: 'National Credit Act, s78-81 (affordability assessment).',
      steps: [
        'Add fuel, insurance, tyres and maintenance to the instalment. That is the real monthly cost.',
        'Use the Finance calculator to test different deposits and terms.',
        'If a lender skips the affordability check, that can be reckless credit (s83).',
      ],
    }),
  },
  {
    id: 'tradein',
    keywords: ['trade', 'trade-in', 'trade in', 'my current car', 'old car'],
    build: () => ({
      matched: true,
      title: 'Trading in your current car',
      body: 'A trade-in is convenient but the dealer will offer trade (wholesale) value, which is below retail. That gap is often where a "good rate" is quietly clawed back. Know your car\'s value independently before you discuss it.',
      steps: [
        'Get an independent valuation (e.g. TransUnion Auto / dealer-neutral guides) first.',
        'Negotiate the car price and finance rate BEFORE mentioning a trade-in.',
        'Check the trade-in settles any outstanding finance on your old car.',
      ],
    }),
  },
  {
    id: 'insurance',
    keywords: ['insurance', 'insure', 'cover', 'premium', 'credit life'],
    build: () => ({
      matched: true,
      title: 'Insurance and credit life',
      body: 'Lenders require comprehensive insurance and usually add credit life cover (which settles the debt if you die or are disabled). Both are frequently marked up at the F&I desk. Credit life is capped by regulation and you may use your own provider.',
      citation: 'National Credit Act credit life regulations (2017 caps).',
      steps: [
        'You are not obliged to take the dealer\'s insurance, shop your own comprehensive cover.',
        'Ask for the credit life premium as a separate line and compare it to the cap.',
        'Use the Insurance tab to compare indicative premiums across insurers.',
      ],
    }),
  },
  {
    id: 'roadworthy',
    keywords: ['roadworthy', 'roadworthiness', 'certificate', 'register', 'registration'],
    build: () => ({
      matched: true,
      title: 'Roadworthy & registration',
      body: 'A valid roadworthy certificate is required before a car can be registered in your name. Change of ownership must be lodged within 21 days at a registering authority via eNaTIS.',
      citation: 'National Road Traffic Act & eNaTIS procedures.',
      steps: [
        'Confirm the car has (or will get) a roadworthy certificate before you pay.',
        'Keep the signed Notification of Change of Ownership (NCO) form.',
        'Lodge the change of ownership within 21 days.',
      ],
    }),
  },
  // Deliberately placed AFTER the topic rules: "compare insurance premiums"
  // should reach the insurance answer, not the car-comparison answer. Only a
  // question that matched nothing more specific lands here.
  {
    id: 'compare',
    keywords: ['compare', 'versus', ' vs ', 'vs.', 'better buy', 'which car', 'which one'],
    // Two catalogue models in one question is a comparison, however it is phrased.
    when: (question) => matchVehiclesInQuestion(question).length >= MIN_COMPARE,
    build: (ctx) => {
      const matches = matchVehiclesInQuestion(ctx.question ?? '')
      const named = matches.map((v) => `${v.make} ${v.model}`)

      if (matches.length >= MIN_COMPARE) {
        const steps = [
          'Open the comparison below, the cars are already loaded.',
          'Read the affordability badge, not just the instalment: the cheaper car can still be the risky one.',
          'Compare insurance for each from the comparison screen before you decide.',
        ]
        // Same gate as the Compare screen: say plainly that the personalised
        // columns stay locked rather than letting the user expect numbers.
        if (!isUsableScore(ctx.score)) {
          steps.unshift(
            'Record your credit score first, without it the instalment and affordability columns stay locked.',
          )
        }
        return {
          matched: true,
          title: `Comparing the ${named.join(' and the ')}`,
          body: 'I can put those side by side on the same questions: price, mileage, your instalment at your own credit band, affordability against your income, and indicative running costs. I will not rank them on reliability, because I have no sourced South African reliability data for these models yet, and an invented rating is worse than an empty row.',
          steps,
          link: { label: `Compare the ${named.join(' vs ')}`, href: compareHref(matches.map((v) => v.id)) },
        }
      }

      return {
        matched: true,
        title: 'Comparing two cars properly',
        body: `Tell me which models you are weighing up, for example "compare the Polo and the Swift", and I will load them side by side.${matches.length === 1 ? ` I spotted the ${named[0]} in your question, but I need a second car to compare it against.` : ''} You can also pick two or three cars in Explore and tap Compare on each card.`,
        steps: [
          'Pick two or three cars in Explore using the Compare button on each card.',
          'Record your credit score first, or the instalment and affordability columns stay locked.',
          'Compare the total monthly cost, instalment plus fuel plus insurance, not the sticker price.',
        ],
        link: matches.length === 1
          ? { label: `Start with the ${named[0]}`, href: compareHref(matches.map((v) => v.id)) }
          : { label: 'Pick cars to compare', href: '/explore' },
      }
    },
  },
  {
    id: 'documents',
    keywords: ['document', 'documents', 'paperwork', 'fica', 'payslip', 'proof of residence'],
    build: () => ({
      matched: true,
      title: 'Documents you need for finance',
      body: 'Finance applications are FICA-regulated. Having your pack ready prevents delays and stops a dealer stalling.',
      citation: 'Financial Intelligence Centre Act (FICA).',
      steps: [
        'Prepare: ID/passport, driver\'s licence, proof of residence (under 3 months).',
        'Add your latest payslip and 3 months of bank statements.',
        'Track them in the Documents tab so nothing is missing on the day.',
      ],
    }),
  },
]

// Each rule hands the user off to the tool that turns the answer into action.
const RULE_LINKS: Record<string, GuardianLink> = {
  'interest-rate': { label: 'Model this rate', href: '/finance' },
  balloon: { label: 'Model the balloon', href: '/finance' },
  warranty: { label: 'Ask about your rights', href: '/chat' },
  'credit-check': { label: 'Record your score', href: '/credit' },
  affordability: { label: 'Test affordability', href: '/finance' },
  tradein: { label: 'Check the market', href: '/explore' },
  insurance: { label: 'Compare insurance', href: '/insurance' },
  roadworthy: { label: 'Ask about roadworthy rules', href: '/chat' },
  documents: { label: 'Build your pack', href: '/documents' },
}

export function askGuardian(question: string, ctx: GuardianContext): GuardianReply {
  const q = question.toLowerCase()
  const withQuestion: GuardianContext = { ...ctx, question }
  for (const rule of RULES) {
    if (rule.keywords.some((k) => q.includes(k)) || rule.when?.(question)) {
      const reply = rule.build(withQuestion)
      // A rule may compute its own deep link (Car Compare pre-populates the
      // set); otherwise it gets the static one for its topic.
      return { ...reply, link: reply.link ?? RULE_LINKS[rule.id] }
    }
  }
  return {
    matched: false,
    title: "I don't have a sourced answer for that yet",
    body: "I only answer where I can cite South African consumer law and give concrete steps, so I won't guess. I've logged your question to improve future coverage. Try asking about interest rates, balloon payments, used-car warranties, affordability, trade-ins, insurance, roadworthy certificates, credit checks or finance documents.",
    steps: [
      'Rephrase using one of the topics above.',
      'For urgent legal help, contact the National Consumer Commission or MIOSA.',
    ],
  }
}

export const GUARDIAN_SUGGESTIONS = [
  'What interest rate should I accept?',
  'How does a balloon payment work?',
  'Is the car covered if it breaks down?',
  'Can I afford this deal?',
  'How do I trade in my old car?',
  'Compare the Polo and the Swift',
]
