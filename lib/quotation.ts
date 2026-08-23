import { PRIME_RATE } from './finance'
import type { QuotationFinding } from './store'

// Dated, sourced-style benchmarks. These are market reference points for a
// prototype, NOT guaranteed offers. Reviewed against typical SA F&I norms.
export const BENCHMARKS_UPDATED = '2026-07-01'

export type QuoteInput = {
  vehicle: string
  price: number
  interestRate: number
  initiationFee: number
  adminFeeMonthly: number
  creditLifeMonthly: number
  trackingMonthly: number
  balloonPct: number
  financedAmount: number
  targetRate: number | null // from user's credit band
}

export function analyseQuotation(q: QuoteInput): { findings: QuotationFinding[]; score: number } {
  const findings: QuotationFinding[] = []
  let penalty = 0

  // Interest rate vs the buyer's band target (or prime + 2.5 fallback)
  const target = q.targetRate ?? PRIME_RATE + 2.5
  if (q.interestRate <= target + 0.25) {
    findings.push({
      label: 'Interest rate',
      value: `${q.interestRate.toFixed(2)}%`,
      status: 'ok',
      note: `In line with your target of about ${target.toFixed(2)}%. This is fair.`,
    })
  } else if (q.interestRate <= target + 1.5) {
    penalty += 12
    findings.push({
      label: 'Interest rate',
      value: `${q.interestRate.toFixed(2)}%`,
      status: 'watch',
      note: `Above your ~${target.toFixed(2)}% target. Ask them to match a bank pre-approval.`,
    })
  } else {
    penalty += 25
    findings.push({
      label: 'Interest rate',
      value: `${q.interestRate.toFixed(2)}%`,
      status: 'flag',
      note: `Well above your ~${target.toFixed(2)}% target. This is where most of the mark-up hides, negotiate hard.`,
    })
  }

  // Initiation fee, NCA cap is R1 207.50 incl. VAT (as at 2024 regs)
  const initCap = 1207.5
  if (q.initiationFee <= initCap + 1) {
    findings.push({
      label: 'Initiation fee',
      value: `R${q.initiationFee.toLocaleString('en-ZA')}`,
      status: 'ok',
      note: `Within the NCA cap of R${initCap.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}.`,
    })
  } else {
    penalty += 15
    findings.push({
      label: 'Initiation fee',
      value: `R${q.initiationFee.toLocaleString('en-ZA')}`,
      status: 'flag',
      note: `Above the NCA cap of R${initCap.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}. This should be challenged directly.`,
    })
  }

  // Monthly admin/service fee, NCA cap R69/month
  const adminCap = 69
  if (q.adminFeeMonthly <= adminCap) {
    findings.push({
      label: 'Admin / service fee',
      value: `R${q.adminFeeMonthly}/mo`,
      status: 'ok',
      note: `At or under the NCA cap of R${adminCap}/month.`,
    })
  } else {
    penalty += 10
    findings.push({
      label: 'Admin / service fee',
      value: `R${q.adminFeeMonthly}/mo`,
      status: 'flag',
      note: `Above the NCA service-fee cap of R${adminCap}/month.`,
    })
  }

  // Credit life, should be modest relative to financed amount
  const clExpected = (q.financedAmount * 0.0004) // rough indicative benchmark
  if (q.creditLifeMonthly <= clExpected * 1.2 || q.creditLifeMonthly <= 60) {
    findings.push({
      label: 'Credit life premium',
      value: `R${q.creditLifeMonthly}/mo`,
      status: 'ok',
      note: 'Reasonable. Remember you may use your own credit-life provider.',
    })
  } else {
    penalty += 12
    findings.push({
      label: 'Credit life premium',
      value: `R${q.creditLifeMonthly}/mo`,
      status: 'watch',
      note: 'Looks marked up. You are entitled to substitute your own credit-life cover.',
    })
  }

  // Tracking device fee
  if (q.trackingMonthly <= 150) {
    findings.push({
      label: 'Tracking fee',
      value: `R${q.trackingMonthly}/mo`,
      status: 'ok',
      note: 'In the normal range for a tracking subscription.',
    })
  } else {
    penalty += 6
    findings.push({
      label: 'Tracking fee',
      value: `R${q.trackingMonthly}/mo`,
      status: 'watch',
      note: 'On the high side, compare against Tracker/Netstar/Cartrack direct pricing.',
    })
  }

  // Balloon exposure
  if (q.balloonPct <= 0) {
    findings.push({
      label: 'Balloon payment',
      value: 'None',
      status: 'ok',
      note: 'No residual lump sum at the end. You own the car outright when paid.',
    })
  } else if (q.balloonPct <= 20) {
    penalty += 6
    findings.push({
      label: 'Balloon payment',
      value: `${q.balloonPct}% (R${Math.round((q.balloonPct / 100) * q.price).toLocaleString('en-ZA')})`,
      status: 'watch',
      note: 'Moderate balloon. Make sure you have a plan to settle it at term end.',
    })
  } else {
    penalty += 14
    findings.push({
      label: 'Balloon payment',
      value: `${q.balloonPct}% (R${Math.round((q.balloonPct / 100) * q.price).toLocaleString('en-ZA')})`,
      status: 'flag',
      note: 'Large balloon. A six-figure sum could fall due at the end of the term.',
    })
  }

  const score = Math.max(0, Math.min(100, 100 - penalty))
  return { findings, score }
}

export function buildNegotiationPack(vehicle: string, findings: QuotationFinding[], score: number): string {
  const lines: string[] = []
  lines.push('1ST BUYER, NEGOTIATION POINTS')
  lines.push('================================')
  lines.push(`Vehicle: ${vehicle || 'Not specified'}`)
  lines.push(`Generated: ${new Date().toLocaleString('en-ZA')}`)
  lines.push(`Fairness score: ${score}/100`)
  lines.push(`Benchmarks last reviewed: ${BENCHMARKS_UPDATED}`)
  lines.push('')
  const flags = findings.filter((f) => f.status === 'flag')
  const watch = findings.filter((f) => f.status === 'watch')
  if (flags.length) {
    lines.push('RAISE THESE FIRST (flagged):')
    flags.forEach((f, i) => lines.push(`  ${i + 1}. ${f.label}, ${f.value}\n     ${f.note}`))
    lines.push('')
  }
  if (watch.length) {
    lines.push('ALSO WORTH QUESTIONING:')
    watch.forEach((f, i) => lines.push(`  ${i + 1}. ${f.label}, ${f.value}\n     ${f.note}`))
    lines.push('')
  }
  lines.push('FULL BREAKDOWN:')
  findings.forEach((f) => lines.push(`  [${f.status.toUpperCase()}] ${f.label}: ${f.value}, ${f.note}`))
  lines.push('')
  lines.push('These are benchmark-based estimates, not offers or legal advice.')
  lines.push('1st Buyer is independent and takes no commission.')
  return lines.join('\n')
}
