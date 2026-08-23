'use client'

import Link from 'next/link'
import { ArrowRight, TrendingUp, Wallet } from 'lucide-react'
import { Card, Notice } from '@/components/ui-kit'
import {
  AFFORDABILITY_BANDS,
  PRIME_RATE,
  bandForScore,
  estimateBuyingPower,
  isUsableScore,
  targetRateForScore,
} from '@/lib/finance'
import { formatZAR } from '@/lib/format'

/**
 * The profile's answer to "so what?".
 *
 * The screen used to show income, licence years and a buying goal as four
 * tiles: true, and useless. A first-time buyer does not need their own salary
 * read back to them, they need to know what it means for what they can buy.
 *
 * Every figure below is derived from the app's own calculator with the
 * assumptions stated next to it, and the whole panel refuses to produce a
 * dependent number when the input for it is missing. That is the same gate the
 * rest of the app applies: no instalment without a real credit score.
 */
export function AffordabilityAdvice({
  monthlyIncome,
  score,
}: {
  monthlyIncome: number
  score: number | null
}) {
  const hasIncome = monthlyIncome > 0
  const hasScore = isUsableScore(score)

  const comfortable = hasIncome ? Math.round(monthlyIncome * AFFORDABILITY_BANDS.comfortable) : null
  const ceiling = hasIncome ? Math.round(monthlyIncome * AFFORDABILITY_BANDS.stretch) : null
  const buyingPower =
    hasIncome && hasScore ? estimateBuyingPower({ monthlyIncome, score }) : null
  const band = hasScore ? bandForScore(score) : null

  if (!hasIncome) {
    return (
      <Notice tone="muted">
        <strong className="font-semibold">Add your income to get advice.</strong> Once we know what
        lands in your account each month, this becomes a monthly budget and a realistic price to
        shop at, instead of a blank space.
      </Notice>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold">What you can comfortably repay</h3>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              On take-home pay of {formatZAR(monthlyIncome)}, keep the instalment under{' '}
              <strong className="text-foreground">{formatZAR(comfortable!)}</strong> a month. Above{' '}
              {formatZAR(ceiling!)} the car starts eating the budget you need for fuel, insurance
              and maintenance.
            </p>
          </div>
        </div>

        {/* A bar is easier to read than two numbers, and it makes the gap
            between "comfortable" and "the edge" obvious at a glance. */}
        <div className="mt-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="bg-success"
              style={{ width: `${AFFORDABILITY_BANDS.comfortable * 100}%` }}
            />
            <div
              className="bg-warning"
              style={{
                width: `${(AFFORDABILITY_BANDS.stretch - AFFORDABILITY_BANDS.comfortable) * 100}%`,
              }}
            />
            <div className="flex-1 bg-destructive/70" />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Comfortable to {formatZAR(comfortable!)}</span>
            <span>Stretch to {formatZAR(ceiling!)}</span>
            <span>Risky above</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <TrendingUp className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold">The price to shop at</h3>

            {buyingPower ? (
              <>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                  {formatZAR(buyingPower)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">
                  Roughly what you could finance at your {band!.label.toLowerCase()} credit band, a
                  target rate of about {targetRateForScore(score!).toFixed(2)}%, over 72 months with
                  a 10% deposit. Prime is {PRIME_RATE}%.
                </p>
                <p className="mt-2 text-xs text-muted-foreground text-pretty">
                  This is our estimate, not an offer. A lender assesses your gross income, your
                  other debt and the car itself before it quotes you anything.
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">
                  We will not guess this one. The price you can finance depends on the interest
                  rate you are offered, and that depends on your credit score. Record it and this
                  fills in.
                </p>
                <Link
                  href="/credit"
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 text-xs font-semibold text-primary transition hover:bg-primary/20"
                >
                  Record your credit score
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </>
            )}
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-pretty">
        Guidance based on what you have recorded, not financial advice. The bands are measured
        against take-home pay, because that is the money the instalment actually comes out of.
      </p>
    </div>
  )
}
