'use client'

import Link from 'next/link'
import { useId } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  DIAL,
  SCORE_BANDS,
  arcPath,
  buyingPowerToFraction,
  checkpointX,
  needleAngle,
  polarPoint,
  scoreToFraction,
  ticks,
} from '@/lib/gauge-display'
import { formatZAR } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The dashboard's instrument cluster.
 *
 * PRESENTATION ONLY. Every value arrives as a prop, already computed by the
 * same code as before. These components do no arithmetic beyond turning a
 * number into an angle.
 *
 * LAYOUT RULE THAT MATTERS
 *
 * The readout sits BELOW the dial in normal flow, never overlaid on it. An
 * earlier version absolutely positioned the number over the lower half of the
 * dial, and the needle hub and tail cut straight through the digits. The sweep
 * is 170 to 10 degrees precisely so the whole lower half stays empty and no
 * needle angle can ever reach the number.
 *
 * ACCESSIBILITY
 *
 * The dial is an aria-hidden drawing. The value, its units and its band are
 * real text underneath, so a screen reader gets the fact rather than a
 * description of a picture.
 */

/* ------------------------------------------------------ shared parts ----- */

/** Tick marks around the outside of a dial. */
function Ticks({ count = 21 }: { count?: number }) {
  const { cx, cy, radius, bandWidth } = DIAL
  const outer = radius + bandWidth / 2 + 4
  return (
    <g>
      {ticks(count).map(({ fraction, major }) => {
        const angle = needleAngle(fraction)
        const a = polarPoint(cx, cy, outer, angle)
        const b = polarPoint(cx, cy, outer - (major ? 6 : 3.5), angle)
        return (
          <line
            key={fraction}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--color-foreground)"
            strokeWidth={major ? 1.6 : 1}
            strokeLinecap="round"
            opacity={major ? 0.45 : 0.22}
          />
        )
      })}
    </g>
  )
}

/**
 * A tapered needle with a weighted hub.
 *
 * Drawn as a polygon rather than a line: a stroked line has the same width at
 * the hub as at the tip, which is what made the first version look like a
 * chart default. Real instrument needles are wide at the pivot and come to a
 * point, and they cast a shadow onto the dial face.
 */
function Needle({ fraction, shadowId }: { fraction: number; shadowId: string }) {
  const { cx, cy, needleLength } = DIAL
  const angle = needleAngle(fraction)
  const tip = polarPoint(cx, cy, needleLength, angle)
  // The two shoulders sit either side of the pivot, perpendicular to the
  // needle, which is what gives the taper.
  const left = polarPoint(cx, cy, 3.4, angle + 90)
  const right = polarPoint(cx, cy, 3.4, angle - 90)
  // A short counterweight past the pivot, as on a real gauge.
  const tail = polarPoint(cx, cy, 8, angle + 180)

  return (
    <g filter={`url(#${shadowId})`}>
      <polygon
        points={`${tip.x},${tip.y} ${left.x},${left.y} ${tail.x},${tail.y} ${right.x},${right.y}`}
        fill="var(--color-foreground)"
      />
      {/* Hub: a weighted cap with a highlight, so it reads as machined metal
          rather than as a dot where two lines meet. */}
      <circle cx={cx} cy={cy} r="7" fill="var(--color-foreground)" />
      <circle cx={cx} cy={cy} r="4.2" fill="var(--color-card)" />
      <circle cx={cx} cy={cy} r="2" fill="var(--color-foreground)" opacity="0.55" />
      <circle cx={cx - 1.4} cy={cy - 1.6} r="1.2" fill="var(--color-card)" opacity="0.7" />
    </g>
  )
}

/** The soft shadow the needle casts on the dial face. */
function NeedleShadow({ id }: { id: string }) {
  return (
    <defs>
      <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow
          dx="0"
          dy="1.4"
          stdDeviation="1.6"
          floodColor="var(--color-foreground)"
          floodOpacity="0.32"
        />
      </filter>
    </defs>
  )
}

/* ------------------------------------------------------------ speedo ----- */

export function CreditScoreGauge({
  score,
  band,
  targetRate,
}: {
  score: number
  band: string
  targetRate: string
}) {
  const shadowId = useId()
  const fraction = scoreToFraction(score)
  const { cx, cy, radius, bandWidth } = DIAL

  return (
    <GaugeCard label="Credit score" href="/credit">
      <div className="mt-1">
        <svg viewBox={DIAL.viewBox} className="w-full" aria-hidden>
          <NeedleShadow id={shadowId} />

          {/* Recessed track behind the bands, so the ring has a seat. */}
          <path
            d={arcPath(cx, cy, radius, 0, 1)}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={bandWidth + 3}
            strokeLinecap="round"
          />

          {/* One rounded, gapped segment per credit band. The 1.6 degree inset
              is what separates them; butted segments read as a default pie. */}
          {SCORE_BANDS.map((b) => (
            <path
              key={b.id}
              d={arcPath(cx, cy, radius, b.from, b.to, 1.6)}
              fill="none"
              stroke={b.colour}
              strokeWidth={bandWidth}
              strokeLinecap="round"
            />
          ))}

          <Ticks />
          <Needle fraction={fraction} shadowId={shadowId} />
        </svg>
      </div>

      {/* Readout, in flow. Nothing can overlap it. */}
      <p className="mt-1 text-center font-display text-[2rem] font-semibold leading-none tabular-nums">
        {score}
      </p>
      <p className="mt-1.5 text-center text-xs text-muted-foreground text-pretty">
        <span className="font-semibold text-foreground">{band}</span> · target ~{targetRate}
      </p>
    </GaugeCard>
  )
}

/** Shown before a score exists. The dial is empty rather than guessed at. */
export function CreditScoreEmptyGauge() {
  const { cx, cy, radius, bandWidth } = DIAL
  return (
    <Link
      href="/credit"
      className="flex flex-col rounded-2xl border border-dashed border-primary/45 bg-primary/[0.07] p-4 shadow-soft transition hover:border-primary/70 hover:shadow-lift"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Credit score
      </p>
      <svg viewBox={DIAL.viewBox} className="mt-1 w-full" aria-hidden>
        <path
          d={arcPath(cx, cy, radius, 0, 1)}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeWidth={bandWidth}
          strokeLinecap="round"
          strokeDasharray="3 7"
          opacity="0.4"
        />
        <circle cx={cx} cy={cy} r="6" fill="var(--color-muted-foreground)" opacity="0.35" />
      </svg>
      <p className="mt-1 text-center text-sm font-medium text-pretty">
        Record it to unlock your target rate
      </p>
      <span className="mt-2 inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary">
        Start <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </Link>
  )
}

/* -------------------------------------------------------- fuel gauge ----- */

/** A fuel pump, drawn to match the filled weight of the rest of the cluster. */
function PumpIcon({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity="0.55">
      {/* Tank body */}
      <path
        d="M0 11 L0 1.6 C0 0.7 0.7 0 1.6 0 L7.4 0 C8.3 0 9 0.7 9 1.6 L9 11 Z"
        fill="var(--color-foreground)"
      />
      {/* Window */}
      <rect x="1.7" y="1.8" width="5.6" height="3.4" rx="0.7" fill="var(--color-card)" />
      {/* Base */}
      <rect x="-0.9" y="11" width="10.8" height="1.7" rx="0.85" fill="var(--color-foreground)" />
      {/* Hose and nozzle arm */}
      <path
        d="M9.6 4.2 L11.4 4.2 C12.2 4.2 12.8 4.8 12.8 5.6 L12.8 9.2 C12.8 9.9 13.3 10.4 14 10.4"
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </g>
  )
}

export function BuyingPowerGauge({ amount, hint }: { amount: number; hint: string }) {
  const shadowId = useId()
  const fraction = buyingPowerToFraction(amount)
  const { cx, cy, radius, bandWidth } = DIAL
  const empty = amount <= 0

  // E and F sit just inside the ends of the arc, on the dial face.
  const eMark = polarPoint(cx, cy, radius - bandWidth - 6, needleAngle(0))
  const fMark = polarPoint(cx, cy, radius - bandWidth - 6, needleAngle(1))

  return (
    <GaugeCard label="Est. buying power">
      <div className="mt-1">
        <svg viewBox={DIAL.viewBox} className="w-full" aria-hidden>
          <NeedleShadow id={shadowId} />

          <path
            d={arcPath(cx, cy, radius, 0, 1)}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={bandWidth + 3}
            strokeLinecap="round"
          />

          {/* The reserve wedge, as on a real gauge. */}
          <path
            d={arcPath(cx, cy, radius, 0, 0.16, 1.6)}
            fill="none"
            stroke="var(--color-destructive)"
            strokeWidth={bandWidth}
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* How full the tank is. */}
          {!empty && (
            <path
              d={arcPath(cx, cy, radius, 0, fraction, 1.6)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={bandWidth}
              strokeLinecap="round"
            />
          )}

          {/* Quarter marks: E, 1/4, 1/2, 3/4, F. */}
          <Ticks count={17} />

          <text
            x={eMark.x}
            y={eMark.y + 3}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}
          >
            E
          </text>
          <text
            x={fMark.x}
            y={fMark.y + 3}
            textAnchor="middle"
            className="fill-foreground"
            style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}
          >
            F
          </text>

          <PumpIcon x={63} y={30} scale={0.85} />
          <Needle fraction={fraction} shadowId={shadowId} />
        </svg>
      </div>

      <p className="mt-1 text-center font-display text-[1.6rem] font-semibold leading-none tabular-nums">
        {empty ? 'Not yet' : formatZAR(amount)}
      </p>
      <p className="mt-1.5 text-center text-xs text-muted-foreground text-pretty">{hint}</p>
    </GaugeCard>
  )
}

/* ------------------------------------------------------- journey road ---- */

export type RoadStage = { id: string; title: string; done: boolean }

/**
 * The journey as a road seen from the side, with the car driving along it.
 *
 * The first version was a progress bar with dashes and floating circles, which
 * is exactly what it looked like. This is built as a road: an asphalt strip
 * with a kerb edge, proper lane markings painted along the centre line,
 * milestone posts standing on the verge, and the car sitting ON the surface
 * with its wheels touching, at the furthest checkpoint reached.
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
  const carX = doneCount === 0 ? 6 : checkpointX(Math.min(doneCount, total) - 1, total)

  // Road surface geometry, in viewBox units.
  const roadTop = 40
  const roadHeight = 16
  const centreLine = roadTop + roadHeight / 2

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft',
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Journey</p>

      <svg viewBox="0 0 100 62" className="mt-2 w-full" aria-hidden>
        {/* Asphalt. A dedicated token: foreground-at-opacity paints a white
            road in dark mode. */}
        <rect x="0" y={roadTop} width="100" height={roadHeight} rx="2" fill="var(--color-road)" />
        {/* Kerb edges, lighter than the surface, top and bottom. */}
        <rect x="0" y={roadTop} width="100" height="1.1" fill="var(--color-road-edge)" />
        <rect x="0" y={roadTop + roadHeight - 1.1} width="100" height="1.1" fill="var(--color-road-edge)" />

        {/* Lane markings: long dashes with wide gaps, the proportions of real
            road paint rather than a dashed border. */}
        <line
          x1="2"
          x2="98"
          y1={centreLine}
          y2={centreLine}
          stroke="var(--color-road-line)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="7 6"
          opacity="0.9"
        />

        {/* The stretch already driven, tinted over the asphalt. */}
        {doneCount > 0 && (
          <rect
            x="0"
            y={roadTop}
            width={Math.max(carX, 6)}
            height={roadHeight}
            rx="2"
            fill="var(--color-primary)"
            opacity="0.28"
          />
        )}

        {/* Milestone posts on the verge above the road. */}
        {stages.map((stage, i) => {
          const x = checkpointX(i, total)
          return (
            <g key={stage.id}>
              <line
                x1={x}
                y1={roadTop - 1}
                x2={x}
                y2={roadTop - 8}
                stroke={stage.done ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
                strokeWidth="1.3"
                strokeLinecap="round"
                opacity={stage.done ? 1 : 0.5}
              />
              {/* A marker head: filled once the stage is done, hollow before. */}
              <circle
                cx={x}
                cy={roadTop - 10.5}
                r="3.1"
                fill={stage.done ? 'var(--color-primary)' : 'var(--color-card)'}
                stroke={stage.done ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
                strokeWidth="1.2"
                opacity={stage.done ? 1 : 0.65}
              />
              {stage.done && (
                <path
                  d={`M ${x - 1.4} ${roadTop - 10.6} l 1 1.1 l 1.9 -2.1`}
                  fill="none"
                  stroke="var(--color-primary-foreground)"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          )
        })}

        {/* The car, sitting on the road with its wheels on the surface. */}
        <g transform={`translate(${carX - 9} ${roadTop - 12.5})`}>
          <ellipse cx="9" cy="13.4" rx="8.4" ry="1.1" fill="var(--color-road)" opacity="0.45" />
          <path
            d="M1.2 9.4
               C1.2 7.7 1.6 7 3 6.8
               L5.1 6.5
               C6.2 3.4 7.7 2.2 10.2 2.2
               L12.3 2.2
               C14.4 2.2 15.7 3.1 17 5.4
               L17.9 6.6
               C18.7 6.9 19 7.6 19 9
               L19 10.9
               C19 11.6 18.6 11.9 17.9 11.9
               L2.3 11.9
               C1.6 11.9 1.2 11.6 1.2 10.9
               Z"
            fill="var(--color-foreground)"
          />
          <path
            d="M6.3 6.3 L7.1 4.6 C7.6 3.7 8.4 3.4 9.6 3.4 L10.4 3.4 L10.4 6.3 Z"
            fill="var(--color-card)"
            opacity="0.55"
          />
          <path
            d="M11.4 3.4 L12.4 3.4 C13.8 3.4 14.6 3.9 15.4 5.1 L16.1 6.3 L11.4 6.3 Z"
            fill="var(--color-card)"
            opacity="0.55"
          />
          <circle cx="6.2" cy="11.9" r="2.1" fill="var(--color-foreground)" />
          <circle cx="14.2" cy="11.9" r="2.1" fill="var(--color-foreground)" />
          <circle cx="6.2" cy="11.9" r="0.85" fill="var(--color-card)" />
          <circle cx="14.2" cy="11.9" r="0.85" fill="var(--color-card)" />
        </g>
      </svg>

      <p className="mt-1.5 font-display text-2xl font-semibold leading-none">{progress}%</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {doneCount} of {total} stages
      </p>
    </div>
  )
}

/* ----------------------------------------------------------- scaffold ---- */

/** The shell both dials share, so they read as one instrument cluster. */
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
        'flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-soft',
        href && 'transition hover:border-primary/40 hover:shadow-lift',
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
  return href ? (
    <Link href={href} className="h-full">
      {body}
    </Link>
  ) : (
    body
  )
}
