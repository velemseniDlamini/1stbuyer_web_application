'use client'

import Link from 'next/link'
import { ArrowRight, Fuel } from 'lucide-react'
import {
  SCORE_BANDS,
  arcPath,
  buyingPowerToFraction,
  needleAngle,
  polarPoint,
  scoreToFraction,
} from '@/lib/gauge-display'
import { formatZAR } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The dashboard's car instruments.
 *
 * PRESENTATION ONLY. Every value arrives as a prop, already computed by the
 * same code as before. These components do no arithmetic beyond turning a
 * number into an angle, and the exact figure is always rendered as text
 * alongside the dial: a gauge is easier to read at a glance, but it is not a
 * substitute for the number, and this app does not hide figures behind
 * decoration.
 *
 * ACCESSIBILITY
 *
 * Each dial is an aria-hidden picture. The value, its units and its band are in
 * real text next to it, so a screen reader gets the fact rather than a
 * description of a drawing.
 */

/* ------------------------------------------------------------ speedo ----- */

/**
 * Credit score as a speedometer, poor on the left through excellent on the
 * right. The coloured segments are the app's own credit bands.
 */
export function CreditScoreGauge({ score, band, targetRate }: {
  score: number
  band: string
  targetRate: string
}) {
  const fraction = scoreToFraction(score)
  const angle = needleAngle(fraction)
  const tip = polarPoint(50, 50, 33, angle)
  const tail = polarPoint(50, 50, -6, angle)

  return (
    <GaugeCard label="Credit score" href="/credit">
      <div className="relative">
        <svg viewBox="0 0 100 58" className="w-full" aria-hidden>
          {/* Track */}
          <path
            d={arcPath(50, 50, 40, 0, 1)}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          {/* One stroke per credit band. Drawn slightly inset so the rounded
              track still reads as a single instrument behind them. */}
          {SCORE_BANDS.map((b) => (
            <path
              key={b.id}
              d={arcPath(50, 50, 40, b.from, b.to)}
              fill="none"
              stroke={b.colour}
              strokeWidth="9"
              strokeLinecap="butt"
              opacity={0.9}
            />
          ))}
          {/* Needle */}
          <line
            x1={tail.x}
            y1={tail.y}
            x2={tip.x}
            y2={tip.y}
            stroke="var(--color-foreground)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="4.5" fill="var(--color-foreground)" />
          <circle cx="50" cy="50" r="1.8" fill="var(--color-card)" />
        </svg>

        {/* The number sits in the dial face, where a driver would read it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <p className="font-display text-3xl font-semibold leading-none tabular-nums">{score}</p>
        </div>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground text-pretty">
        <span className="font-semibold text-foreground">{band}</span> · target ~{targetRate}
      </p>
    </GaugeCard>
  )
}

/** Shown before a score exists. The dial is empty rather than guessed at. */
export function CreditScoreEmptyGauge() {
  return (
    <Link
      href="/credit"
      className="flex flex-col justify-between rounded-2xl border border-dashed border-primary/40 bg-primary/10 p-4 transition hover:border-primary/70"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Credit score
      </p>
      <svg viewBox="0 0 100 58" className="mt-1 w-full opacity-40" aria-hidden>
        <path
          d={arcPath(50, 50, 40, 0, 1)}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="4 5"
        />
        <circle cx="50" cy="50" r="4.5" fill="var(--color-muted-foreground)" />
      </svg>
      <p className="text-sm font-medium text-pretty">Record it to unlock your target rate</p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
        Start <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </Link>
  )
}

/* -------------------------------------------------------- fuel gauge ----- */

/**
 * Buying power as a fuel gauge, empty to full.
 *
 * The "full tank" mark is a display constant, not a limit the app believes in,
 * so the rand figure is printed at full size underneath. See lib/gauge-display.
 */
export function BuyingPowerGauge({ amount, hint }: { amount: number; hint: string }) {
  const fraction = buyingPowerToFraction(amount)
  const angle = needleAngle(fraction)
  const tip = polarPoint(50, 50, 31, angle)
  const tail = polarPoint(50, 50, -5, angle)
  const empty = amount <= 0

  return (
    <GaugeCard label="Est. buying power">
      <div className="relative">
        <svg viewBox="0 0 100 58" className="w-full" aria-hidden>
          <path
            d={arcPath(50, 50, 38, 0, 1)}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* The reserve wedge, as on a real gauge. */}
          <path
            d={arcPath(50, 50, 38, 0, 0.18)}
            fill="none"
            stroke="var(--color-destructive)"
            strokeWidth="8"
            strokeLinecap="butt"
            opacity={0.55}
          />
          {!empty && (
            <path
              d={arcPath(50, 50, 38, 0, fraction)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="8"
              strokeLinecap="round"
            />
          )}

          {/* E and F, the two marks that make this unmistakably a fuel gauge. */}
          <text x="9" y="56" className="fill-muted-foreground" style={{ fontSize: 9, fontWeight: 700 }}>
            E
          </text>
          <text x="86" y="56" className="fill-muted-foreground" style={{ fontSize: 9, fontWeight: 700 }}>
            F
          </text>

          <line
            x1={tail.x}
            y1={tail.y}
            x2={tip.x}
            y2={tip.y}
            stroke="var(--color-foreground)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="4" fill="var(--color-foreground)" />
        </svg>

        <span className="pointer-events-none absolute inset-x-0 top-1 flex justify-center text-muted-foreground">
          <Fuel className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <p className="font-display text-xl font-semibold leading-tight tabular-nums">
        {empty ? 'Not yet' : formatZAR(amount)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{hint}</p>
    </GaugeCard>
  )
}

/* ------------------------------------------------------- journey road ---- */

export type RoadStage = { id: string; title: string; done: boolean }

/**
 * The journey as a road with a checkpoint per stage and the car at the
 * furthest point reached.
 *
 * The same counts the old tile showed are still printed underneath, because
 * "3 of 6" is the fact and the road is the picture of it.
 */
export function JourneyRoad({
  stages,
  doneCount,
  progress,
  className,
}: {
  stages: RoadStage[]
  doneCount: number
  progress: number
  className?: string
}) {
  const total = stages.length
  // Checkpoints sit inside the strip so the first and last are not clipped.
  const x = (i: number) => (total <= 1 ? 50 : 8 + (84 * i) / (total - 1))
  // The car sits on the last completed checkpoint, or before the first.
  const carX = doneCount === 0 ? 4 : x(Math.min(doneCount, total) - 1)

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Journey</p>

      <svg viewBox="0 0 100 26" className="mt-2 w-full" aria-hidden>
        {/* Road surface */}
        <rect x="0" y="9" width="100" height="9" rx="4.5" fill="var(--color-foreground)" opacity="0.14" />
        {/* Centre line, dashed like a real road marking */}
        <line
          x1="2"
          x2="98"
          y1="13.5"
          y2="13.5"
          stroke="var(--color-background)"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.9"
        />
        {/* The distance already travelled */}
        {doneCount > 0 && (
          <rect
            x="0"
            y="9"
            width={Math.max(carX, 6)}
            height="9"
            rx="4.5"
            fill="var(--color-primary)"
            opacity="0.9"
          />
        )}

        {stages.map((stage, i) => (
          <circle
            key={stage.id}
            cx={x(i)}
            cy="13.5"
            r={stage.done ? 3 : 2.4}
            fill={stage.done ? 'var(--color-primary)' : 'var(--color-card)'}
            stroke={stage.done ? 'var(--color-card)' : 'var(--color-muted-foreground)'}
            strokeWidth="1.2"
          />
        ))}

        {/* The car. A simple silhouette reads better than a detailed one at
            this size, and it points the way the user is travelling. */}
        <g transform={`translate(${carX - 5.5}, 2.5)`}>
          <path
            d="M0.5 5.2 L2.2 1.9 C2.5 1.3 3.1 1 3.7 1 L7.3 1 C7.9 1 8.5 1.3 8.8 1.9 L10.5 5.2 L10.5 6.6 C10.5 7 10.2 7.3 9.8 7.3 L1.2 7.3 C0.8 7.3 0.5 7 0.5 6.6 Z"
            fill="var(--color-foreground)"
          />
          <circle cx="3" cy="7.3" r="1.15" fill="var(--color-foreground)" />
          <circle cx="8" cy="7.3" r="1.15" fill="var(--color-foreground)" />
          <circle cx="3" cy="7.3" r="0.45" fill="var(--color-card)" />
          <circle cx="8" cy="7.3" r="0.45" fill="var(--color-card)" />
        </g>
      </svg>

      <p className="mt-1 font-display text-xl font-semibold leading-tight">{progress}%</p>
      <p className="text-xs text-muted-foreground">
        {doneCount} of {total} stages
      </p>
    </div>
  )
}

/* ----------------------------------------------------------- scaffold ---- */

/** The shell both dials share, so they line up with the other tiles. */
function GaugeCard({
  label,
  href,
  children,
}: {
  label: string
  href?: string
  children: React.ReactNode
}) {
  const body = (
    <div
      className={cn(
        'flex h-full flex-col rounded-2xl border border-border bg-card p-4',
        href && 'transition hover:border-primary/40',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}
