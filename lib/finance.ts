// Prime rate is a hard-coded constant. In production this must be sourced live.
export const PRIME_RATE = 11.75
export const PRIME_LAST_UPDATED = '2026-07-18'

export type CreditBand = {
  id: string
  label: string
  min: number
  max: number
  spread: number // percentage points over prime
  tone: 'success' | 'warning' | 'destructive' | 'primary'
  summary: string
}

// Self-reported bureau score bands (TransUnion-style 0-999 scale) mapped to a
// realistic South African rate expectation over prime.
export const CREDIT_BANDS: CreditBand[] = [
  {
    id: 'excellent',
    label: 'Excellent',
    min: 767,
    max: 999,
    spread: 0.5,
    tone: 'success',
    summary: 'Lenders should compete for you. Target Prime + 0.5% or better.',
  },
  {
    id: 'good',
    label: 'Good',
    min: 681,
    max: 766,
    spread: 1.5,
    tone: 'primary',
    summary: 'A healthy profile. Push back on anything above Prime + 1.5%.',
  },
  {
    id: 'favourable',
    label: 'Favourable',
    min: 614,
    max: 680,
    spread: 2.5,
    tone: 'warning',
    summary: 'You will be approved, but the dealer has room to mark you up.',
  },
  {
    id: 'average',
    label: 'Average',
    min: 583,
    max: 613,
    spread: 3.5,
    tone: 'warning',
    summary: 'Expect a higher rate. A larger deposit will help materially.',
  },
  {
    id: 'below',
    label: 'Needs work',
    min: 0,
    max: 582,
    spread: 5,
    tone: 'destructive',
    summary: 'Finance is possible but expensive. Consider improving first.',
  },
]

/**
 * A score is only usable if the user actually provided one. A recorded 0, a
 * NaN, or an out-of-range value is treated as "no score", we never synthesise
 * a rate entitlement from a number that was never really given.
 */
export function isUsableScore(score: number | null | undefined): score is number {
  if (typeof score !== 'number') return false
  if (!Number.isFinite(score)) return false
  return score >= 1 && score <= 999
}

/**
 * The estimate convention shown on vehicle cards in Explore and in Car Compare.
 * Both screens read it from here so the same car can never quote two different
 * instalments on two screens.
 */
export const CARD_ESTIMATE = {
  depositPct: 10,
  termMonths: 72,
  balloonPct: 0,
} as const

/** Rate a buyer should target: their band's spread over prime, or the
 *  unscored fallback. Callers that must not guess should gate on
 *  isUsableScore() first rather than relying on this fallback. */
export function rateForScore(score: number | null | undefined): number {
  return isUsableScore(score) ? targetRateForScore(score) : PRIME_RATE + 2.5
}

/** The instalment figure shown on a vehicle card, for one buyer, one car. */
export function estimateInstalment(price: number, score: number | null | undefined): number {
  return calculateFinance({
    price,
    depositPct: CARD_ESTIMATE.depositPct,
    annualRatePct: rateForScore(score),
    termMonths: CARD_ESTIMATE.termMonths,
    balloonPct: CARD_ESTIMATE.balloonPct,
  }).monthly
}

export function bandForScore(score: number): CreditBand {
  return (
    CREDIT_BANDS.find((b) => score >= b.min && score <= b.max) ??
    CREDIT_BANDS[CREDIT_BANDS.length - 1]
  )
}

export function targetRateForScore(score: number): number {
  return PRIME_RATE + bandForScore(score).spread
}

export type FinanceInput = {
  price: number
  depositPct: number
  annualRatePct: number
  termMonths: number
  balloonPct: number
}

export type FinanceResult = {
  deposit: number
  balloon: number
  principal: number // financed amount before balloon PV handling
  monthly: number
  totalInterest: number
  totalCost: number
  balloonDue: number
}

// Amortisation with a residual (balloon) value. The balloon is a future value
// that is NOT amortised but still accrues interest across the term.
export function calculateFinance(input: FinanceInput): FinanceResult {
  const price = Math.max(0, input.price)
  const deposit = (Math.min(100, Math.max(0, input.depositPct)) / 100) * price
  const balloon = (Math.min(100, Math.max(0, input.balloonPct)) / 100) * price
  const financed = Math.max(0, price - deposit)
  const n = Math.max(1, Math.round(input.termMonths))
  const r = Math.max(0, input.annualRatePct) / 100 / 12

  let monthly: number
  if (r === 0) {
    monthly = (financed - balloon) / n
  } else {
    // PMT for principal (financed - PV of balloon) + interest carried by balloon
    const balloonPv = balloon / Math.pow(1 + r, n)
    const amortised = financed - balloonPv
    monthly = (amortised * r) / (1 - Math.pow(1 + r, -n))
  }
  monthly = Math.max(0, monthly)

  const totalOfPayments = monthly * n + balloon
  const totalInterest = totalOfPayments - financed
  const totalCost = deposit + totalOfPayments

  return {
    deposit,
    balloon,
    principal: financed,
    monthly,
    totalInterest: Math.max(0, totalInterest),
    totalCost,
    balloonDue: balloon,
  }
}

export type AffordabilityVerdict = {
  id: 'comfortable' | 'stretch' | 'risky'
  label: string
  tone: 'success' | 'warning' | 'destructive'
  ratio: number // instalment as fraction of income
  note: string
}

/*
 * AFFORDABILITY IS ASSESSED AGAINST NET INCOME, AND THAT CHANGED THE NUMBERS.
 *
 * The familiar guideline, "keep the instalment under 20 to 25 percent", is
 * quoted against GROSS pay, because that is what a lender's affordability
 * assessment starts from. This app asks for NET income instead: it is the
 * figure a first-time buyer actually knows, and typing a gross number they had
 * to estimate would poison every calculation downstream.
 *
 * Applying gross thresholds to a net figure would have made the app wrong in a
 * way that always looked plausible. Net pay in South Africa is roughly 72% of
 * gross once PAYE and UIF come off, so the equivalent bands are scaled by
 * 1 / 0.72, which is where 28% and 42% come from.
 *
 * The wording changed too. The old copy said "lenders may decline over 30%",
 * which is now doubly wrong: lenders assess gross, and they assess total debt,
 * not this instalment alone. What this function can honestly say is whether the
 * instalment leaves room for fuel, insurance and maintenance.
 */
export const NET_TO_GROSS_ASSUMPTION = 0.72

/** Instalment as a share of NET pay. See the note above for where these come from. */
export const AFFORDABILITY_BANDS = {
  comfortable: 0.28,
  stretch: 0.42,
} as const

export function assessAffordability(monthly: number, monthlyIncome: number): AffordabilityVerdict {
  const ratio = monthlyIncome > 0 ? monthly / monthlyIncome : 1
  const pct = Math.round(ratio * 100)

  if (ratio <= AFFORDABILITY_BANDS.comfortable) {
    return {
      id: 'comfortable',
      label: 'Comfortable',
      tone: 'success',
      ratio,
      note: `${pct}% of your take-home pay. That leaves room for fuel, insurance and maintenance on top.`,
    }
  }
  if (ratio <= AFFORDABILITY_BANDS.stretch) {
    return {
      id: 'stretch',
      label: 'A stretch',
      tone: 'warning',
      ratio,
      note: `${pct}% of your take-home pay. Workable, but running costs will use most of what is left.`,
    }
  }
  return {
    id: 'risky',
    label: 'Risky',
    tone: 'destructive',
    ratio,
    note: `${pct}% of your take-home pay, before fuel, insurance and maintenance. A lender assesses your gross income and your other debt, so this is our view of your budget, not a prediction of their decision.`,
  }
}

// Buying power: the price a buyer could target given NET income, the
// band-implied rate, the comfortable instalment ceiling above, a standard
// deposit and term.
export function estimateBuyingPower(params: {
  monthlyIncome: number
  score: number | null
  depositPct?: number
  termMonths?: number
}): number {
  const { monthlyIncome } = params
  if (!monthlyIncome || monthlyIncome <= 0) return 0
  const rate = params.score ? targetRateForScore(params.score) : PRIME_RATE + 2.5
  const n = params.termMonths ?? 72
  const depositPct = params.depositPct ?? 10
  const r = rate / 100 / 12
  const maxInstalment = monthlyIncome * AFFORDABILITY_BANDS.comfortable
  // Present value of an annuity gives the financeable amount.
  const financeable = r === 0 ? maxInstalment * n : (maxInstalment * (1 - Math.pow(1 + r, -n))) / r
  // Gross up for the deposit portion.
  const price = financeable / (1 - depositPct / 100)
  return Math.max(0, Math.round(price / 1000) * 1000)
}
