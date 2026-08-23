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

// A common lender guideline: vehicle instalment should sit under ~25% of gross
// monthly income; total debt under ~30%. We assess the instalment share.
export function assessAffordability(monthly: number, monthlyIncome: number): AffordabilityVerdict {
  const ratio = monthlyIncome > 0 ? monthly / monthlyIncome : 1
  if (ratio <= 0.2) {
    return {
      id: 'comfortable',
      label: 'Comfortable',
      tone: 'success',
      ratio,
      note: 'Under 20% of your gross income. This fits a healthy budget.',
    }
  }
  if (ratio <= 0.3) {
    return {
      id: 'stretch',
      label: 'A stretch',
      tone: 'warning',
      ratio,
      note: 'Between 20-30% of income. Workable, but leaves little slack for fuel, insurance and maintenance.',
    }
  }
  return {
    id: 'risky',
    label: 'Risky',
    tone: 'destructive',
    ratio,
    note: 'Over 30% of your gross income. Lenders may decline, and running costs will bite.',
  }
}

// Buying power: the price a buyer could target given income, band-implied rate,
// a conservative 20% instalment ceiling, a standard deposit and term.
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
  const maxInstalment = monthlyIncome * 0.2
  // Present value of an annuity gives the financeable amount.
  const financeable = r === 0 ? maxInstalment * n : (maxInstalment * (1 - Math.pow(1 + r, -n))) / r
  // Gross up for the deposit portion.
  const price = financeable / (1 - depositPct / 100)
  return Math.max(0, Math.round(price / 1000) * 1000)
}
