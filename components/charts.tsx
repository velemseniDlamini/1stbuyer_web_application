'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Charts, drawn as plain SVG.
 *
 * WHY NOT A CHART LIBRARY
 *
 * Recharts and friends add 100kB+ to a bundle that currently ships no charting
 * code at all, for three chart types on one admin screen. These are a few dozen
 * lines of path arithmetic, they inherit the app's own colour tokens
 * automatically, and they carry no upgrade treadmill.
 *
 * ACCESSIBILITY
 *
 * Every chart is followed by the same numbers in a real table, visually hidden.
 * A chart that only exists as a picture is unreadable to a screen reader, and
 * "we have a dashboard" is not a reason to lock someone out of the figures.
 */

const EMPTY_NOTE = 'No data recorded yet.'

/* ------------------------------------------------------------ area line -- */

export type SeriesPoint = { label: string; value: number; secondary?: number }

export function AreaChart({
  data,
  height = 180,
  label,
  secondaryLabel,
  format = (n: number) => String(n),
}: {
  data: SeriesPoint[]
  height?: number
  label: string
  secondaryLabel?: string
  format?: (n: number) => string
}) {
  const gradientId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const geometry = useMemo(() => {
    if (data.length === 0) return null
    const width = 100 // viewBox units; the SVG scales to its container
    // A flat series must not divide by zero, and a max of 0 should still draw
    // a baseline rather than NaN paths.
    const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)))
    const step = data.length > 1 ? width / (data.length - 1) : 0
    const y = (v: number) => 100 - (v / max) * 100

    const points = data.map((d, i) => ({ x: i * step, y: y(d.value), d }))
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    const area = `${line} L${width},100 L0,100 Z`

    const secondary = data.some((d) => d.secondary !== undefined)
      ? data
          .map((d, i) => `${i === 0 ? 'M' : 'L'}${i * step},${y(d.secondary ?? 0)}`)
          .join(' ')
      : null

    return { line, area, secondary, points, max, step }
  }, [data])

  if (!geometry) return <ChartEmpty height={height} />

  const active = hover === null ? null : data[hover]

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`${label} over ${data.length} days. Peak ${format(geometry.max)}.`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Baselines. vectorEffect keeps hairlines hairlines despite the
              non-uniform scale that preserveAspectRatio="none" introduces. */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              opacity={y === 100 ? 1 : 0.45}
            />
          ))}

          <path d={geometry.area} fill={`url(#${gradientId})`} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {geometry.secondary && (
            <path
              d={geometry.secondary}
              fill="none"
              stroke="var(--color-muted-foreground)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {hover !== null && geometry.points[hover] && (
            <>
              <line
                x1={geometry.points[hover].x}
                x2={geometry.points[hover].x}
                y1="0"
                y2="100"
                stroke="var(--color-primary)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                opacity="0.5"
              />
              <circle
                cx={geometry.points[hover].x}
                cy={geometry.points[hover].y}
                r="4"
                fill="var(--color-primary)"
                stroke="var(--color-background)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* Hover targets sit above the SVG so a non-uniform scale cannot
            distort the hit areas. */}
        <div className="absolute inset-0 flex" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <button
              key={d.label}
              type="button"
              tabIndex={-1}
              aria-hidden
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              className="h-full flex-1 cursor-default"
            />
          ))}
        </div>

        {active && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-lg">
            <span className="font-semibold">{active.label}</span>
            <span className="ml-2 tabular-nums">{format(active.value)} {label.toLowerCase()}</span>
            {active.secondary !== undefined && secondaryLabel && (
              <span className="ml-2 text-muted-foreground tabular-nums">
                {format(active.secondary)} {secondaryLabel.toLowerCase()}
              </span>
            )}
          </div>
        )}
      </div>

      <figcaption className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span className="flex items-center gap-3">
          <Key colour="var(--color-primary)" text={label} />
          {secondaryLabel && <Key colour="var(--color-muted-foreground)" text={secondaryLabel} dashed />}
        </span>
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>

      <DataTable
        caption={`${label} by day`}
        head={['Day', label, secondaryLabel].filter(Boolean) as string[]}
        rows={data.map((d) => [
          d.label,
          format(d.value),
          ...(secondaryLabel ? [format(d.secondary ?? 0)] : []),
        ])}
      />
    </figure>
  )
}

/* ------------------------------------------------------------ bar chart -- */

export function BarChart({
  data,
  format = (n: number) => String(n),
  emptyNote = EMPTY_NOTE,
}: {
  data: { label: string; value: number; hint?: string }[]
  format?: (n: number) => string
  emptyNote?: string
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyNote}</p>
  }
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <figure className="m-0">
      <ul className="space-y-2.5">
        {data.map((d) => (
          <li key={d.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium">{d.label}</span>
              {/* The value and the hint are two different counts, so they get a
                  visible separator. Without one, "2" next to "1 visitor" reads
                  as "21 visitor" to anything that flattens the markup, which
                  includes screen readers. */}
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {format(d.value)}
                {d.hint && (
                  <>
                    <span aria-hidden className="mx-1.5 opacity-40">
                      /
                    </span>
                    <span className="opacity-70">{d.hint}</span>
                  </>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <DataTable
        caption="Values"
        head={['Item', 'Value']}
        rows={data.map((d) => [d.label, format(d.value)])}
      />
    </figure>
  )
}

/* ---------------------------------------------------------- donut chart -- */

const DONUT_TONES = [
  'var(--color-primary)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-muted-foreground)',
]

export function DonutChart({
  data,
  size = 140,
}: {
  data: { label: string; value: number }[]
  size?: number
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return <ChartEmpty height={size} />

  const radius = 42
  const circumference = 2 * Math.PI * radius

  // The running offset is computed up front rather than accumulated inside the
  // map callback. Mutating a variable while rendering is a real hazard: React
  // may re-enter or abandon a render, and the arcs would then be laid out from
  // a half-finished total.
  const segments: { label: string; dash: number; offset: number; tone: string }[] = []
  let running = 0
  for (const [i, d] of data.entries()) {
    const dash = (d.value / total) * circumference
    segments.push({
      label: d.label,
      dash,
      offset: running,
      tone: DONUT_TONES[i % DONUT_TONES.length],
    })
    running += dash
  }

  return (
    <figure className="m-0 flex items-center gap-5">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }} role="img" aria-label="Share by device">
        {segments.map((segment) => (
          <circle
            key={segment.label}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={segment.tone}
            strokeWidth="12"
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={-segment.offset}
            // Start at twelve o'clock rather than three.
            transform="rotate(-90 50 50)"
          />
        ))}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground font-semibold"
          style={{ fontSize: 14 }}
        >
          {total.toLocaleString('en-ZA')}
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: DONUT_TONES[i % DONUT_TONES.length] }}
            />
            <span className="flex-1 truncate capitalize">{d.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/* ------------------------------------------------------------- helpers --- */

function Key({ colour, text, dashed }: { colour: string; text: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn('h-0.5 w-4 rounded-full', dashed && 'opacity-60')}
        style={{
          background: dashed ? `repeating-linear-gradient(90deg, ${colour} 0 3px, transparent 3px 6px)` : colour,
        }}
      />
      {text}
    </span>
  )
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
      style={{ height }}
    >
      {EMPTY_NOTE}
    </div>
  )
}

/** The same figures as a real table, for screen readers. */
function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string
  head: string[]
  rows: string[][]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
