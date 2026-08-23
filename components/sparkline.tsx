import { sparklinePoints, priceChange, type PriceSnapshot } from '@/lib/price-history'
import { formatZAR } from '@/lib/format'

/**
 * 30-day asking-price sparkline. Inline SVG, no charting dependency for a
 * 60×20 line.
 *
 * Renders NOTHING when there are fewer than two real observations. There is no
 * placeholder flat line: a flat line is a claim that the price held steady, and
 * we would be making it up.
 */
export function PriceSparkline({
  snapshots,
  label,
}: {
  snapshots: readonly PriceSnapshot[]
  label: string
}) {
  const points = sparklinePoints(snapshots)
  if (points.length < 2) return null

  const change = priceChange(snapshots)
  const w = 60
  const h = 20
  const path = points.map((p) => `${(p.x * w).toFixed(1)},${(p.y * (h - 2) + 1).toFixed(1)}`).join(' ')

  const direction = !change ? 'unchanged' : change.delta < 0 ? 'down' : change.delta > 0 ? 'up' : 'unchanged'
  const description = change
    ? `${label}: asking price ${direction === 'down' ? 'down' : direction === 'up' ? 'up' : 'unchanged'} ${formatZAR(Math.abs(change.delta))} over the last 30 days, from ${snapshots.length} recorded observations.`
    : `${label}: ${snapshots.length} recorded price observations.`

  return (
    <span className="mt-1 flex items-center gap-1.5">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={description}
        className="overflow-visible"
      >
        <polyline
          points={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            direction === 'down' ? 'text-success' : direction === 'up' ? 'text-destructive' : 'text-muted-foreground'
          }
        />
      </svg>
      {change && (
        <span className="text-[10px] font-medium text-muted-foreground">
          {change.delta === 0 ? 'flat' : `${change.delta < 0 ? '−' : '+'}${formatZAR(Math.abs(change.delta))}`} / 30d
        </span>
      )}
    </span>
  )
}
