import { cn } from '@/lib/utils'

/**
 * Content-aware skeleton: sized to the bounding box of the text it replaces, so
 * the row occupies its final height before the value arrives and nothing shifts
 * when it does. No circular spinners anywhere in the comparison.
 *
 * `lines` renders a stacked value + note pair, matching the two-line cells used
 * throughout the comparison table.
 */
export function Skeleton({
  className,
  width = '100%',
  height = '1rem',
}: {
  className?: string
  width?: string
  height?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('block rounded bg-muted motion-safe:animate-pulse', className)}
      style={{ width, height }}
    />
  )
}

export function CellSkeleton({ withNote = true }: { withNote?: boolean }) {
  return (
    <span className="block" aria-hidden>
      <Skeleton width="4.5rem" height="0.875rem" />
      {withNote && <Skeleton className="mt-1" width="6rem" height="0.625rem" />}
    </span>
  )
}
