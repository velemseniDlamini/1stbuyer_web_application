'use client'

import { Pill } from '@/components/ui-kit'
import { CellSkeleton } from '@/components/skeleton'
import { PriceSparkline } from '@/components/sparkline'
import { COMPARE_ATTRIBUTES, type CarComparison, type CompareCell, type CompareSection } from '@/lib/compare'
import type { DeltaVerdict } from '@/lib/compare-helpers'
import { priceHistoryFor } from '@/lib/price-history'
import { BadgeAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * LAYOUT TRADE-OFF (recorded deliberately).
 *
 * The app is a framed handset, a 28rem column even on a 1920px desktop, which
 * is a recorded product decision. This screen does not fight it, but it does not
 * inherit its narrowness either: a dense comparison grid crushed into 448px is
 * the "one layout, four contexts" mistake.
 *
 *   < md : one column per car in a scroll-snapped rail the user swipes, with the
 *          attribute labels pinned in a sticky left column, a "window" effect
 *          where the question never leaves the screen.
 *   ≥ md : the same markup, now wide enough for a genuine side-by-side grid.
 *
 * One real <table> in both cases, with explicit aria-rowindex/aria-colindex so a
 * screen reader announces "Asking price, row 3, column 2" instead of dumping the
 * user into a linear swipe through dozens of unrelated cells.
 */
export function ComparisonTable({
  comparisons,
  sections,
  cheapestId,
  diffs,
  personalisedReady,
  onRemove,
}: {
  comparisons: CarComparison[]
  sections: CompareSection[]
  cheapestId: string | null
  diffs: Record<string, Record<string, DeltaVerdict>>
  /** False until the profile has hydrated; personalised cells show skeletons. */
  personalisedReady: boolean
  onRemove: (id: string) => void
}) {
  // Header row is aria-rowindex 1; body rows continue from 2, including the
  // section header rows, so the announced index matches the visual position.
  //
  // Computed up front rather than with a counter incremented inside JSX. A
  // `rowIndex++` in the middle of a render is a mutation during render: React
  // is free to re-enter or bail out of a render, and the lint rule that flags
  // it (react-hooks/purity) is right that the numbering would then be wrong.
  // This builds the same sequence declaratively.
  const sectionRowIndex = new Map<string, number>()
  const attrRowIndex = new Map<string, number>()
  {
    let next = 2 // 1 is the header row
    for (const section of sections) {
      sectionRowIndex.set(section, next++)
      for (const attr of COMPARE_ATTRIBUTES.filter((a) => a.section === section)) {
        attrRowIndex.set(attr.id, next++)
      }
    }
  }

  return (
    <div
      className="compare-rail -mx-1 overflow-x-auto overscroll-x-contain px-1"
      // Spring-like snap without a gesture library: the browser's own physics.
      style={{ scrollSnapType: 'x mandatory' }}
    >
      <table
        className="w-full min-w-max border-collapse text-sm md:min-w-0 md:table-fixed"
        aria-rowcount={
          1 + sections.length + COMPARE_ATTRIBUTES.length
        }
        aria-colcount={comparisons.length + 1}
      >
        <caption className="sr-only">
          Vehicle comparison. Column 1 holds the attribute names; each further column is a car, and
          every row asks every car the same question.
        </caption>
        <thead>
          <tr aria-rowindex={1}>
            <th
              scope="col"
              aria-colindex={1}
              aria-label="Attribute names"
              className="compare-rail-label sticky left-0 z-10 w-28 min-w-28 bg-background text-left align-bottom"
            >
              <span className="sr-only">Attribute names</span>
            </th>
            {comparisons.map((c, i) => (
              <th
                key={c.vehicle.id}
                scope="col"
                aria-colindex={i + 2}
                className="w-48 min-w-48 px-1.5 pb-2 align-bottom md:w-auto md:min-w-0"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex flex-col gap-1.5 text-left">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-display text-sm font-semibold leading-tight text-pretty">
                      {c.vehicle.make} {c.vehicle.model}
                    </span>
                    <button
                      onClick={() => onRemove(c.vehicle.id)}
                      aria-label={`Remove ${c.vehicle.make} ${c.vehicle.model} from the comparison`}
                      className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-destructive"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <span className="text-xs font-normal text-muted-foreground text-pretty">
                    {c.vehicle.variant}
                  </span>
                  {cheapestId === c.vehicle.id && <Pill tone="success">Lowest instalment</Pill>}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {sections.map((section) => (
          <tbody key={section} className="border-t border-border">
            <tr aria-rowindex={sectionRowIndex.get(section)}>
              <th
                scope="colgroup"
                colSpan={comparisons.length + 1}
                className="compare-rail-label sticky left-0 bg-background py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {section}
              </th>
            </tr>
            {COMPARE_ATTRIBUTES.filter((a) => a.section === section).map((attr) => (
              <tr
                key={attr.id}
                aria-rowindex={attrRowIndex.get(attr.id)}
                className="border-t border-border/60 align-top"
              >
                <th
                  scope="row"
                  aria-colindex={1}
                  className="compare-rail-label sticky left-0 z-10 bg-background py-2.5 pr-2 text-left text-xs font-medium text-muted-foreground"
                >
                  <span className="block text-pretty">{attr.label}</span>
                  {attr.hint && (
                    <span className="mt-0.5 block text-[10px] font-normal leading-snug text-muted-foreground/80 text-pretty">
                      {attr.hint}
                    </span>
                  )}
                </th>
                {comparisons.map((c, i) => {
                  const diff = diffs[attr.id]?.[c.vehicle.id]
                  const isPersonalised = attr.id === 'instalment' || attr.id === 'affordability'
                  const history = attr.id === 'price' ? priceHistoryFor(c.vehicle.id) : []
                  return (
                    <td
                      key={c.vehicle.id}
                      aria-colindex={i + 2}
                      // Materiality tint, never colour alone: the title attribute
                      // and the cell note both carry the same information.
                      className={cn(
                        'min-h-11 px-1.5 py-2.5',
                        diff?.material && 'compare-material bg-muted/40',
                      )}
                      title={diff?.material ? diff.explanation : undefined}
                      style={{ scrollSnapAlign: 'start' }}
                    >
                      {isPersonalised && !personalisedReady ? (
                        <CellSkeleton />
                      ) : (
                        <>
                          <Cell cell={c.cells[attr.id]} />
                          {diff?.material && (
                            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground text-pretty">
                              {diff.explanation}
                            </span>
                          )}
                          {attr.id === 'price' && (
                            <PriceSparkline
                              snapshots={history}
                              label={`${c.vehicle.make} ${c.vehicle.model}`}
                            />
                          )}
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

export function Cell({ cell }: { cell: CompareCell }) {
  if (cell.kind === 'missing') {
    return (
      // Dimmed, and annotated, the user must be able to see where the
      // uncertainty lives rather than reading an absence as a zero.
      <span className="block opacity-70">
        <span className="text-sm font-medium text-muted-foreground">{cell.display}</span>
        {cell.note && (
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground/80 text-pretty">
            {cell.note}
          </span>
        )}
      </span>
    )
  }

  if (cell.kind === 'locked') {
    return (
      <span className="block">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-warning-foreground">
          <BadgeAlert className="h-3.5 w-3.5" aria-hidden />
          {cell.display}
        </span>
        <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground text-pretty">
          {cell.note}
        </span>
      </span>
    )
  }

  if (cell.kind === 'badge') {
    return (
      <span className="block">
        {/* The badge text carries the meaning; colour only reinforces it. */}
        <Pill tone={cell.tone === 'default' ? 'muted' : cell.tone}>{cell.display}</Pill>
        {cell.note && (
          <span className="mt-1 block text-[10px] leading-snug text-muted-foreground text-pretty">
            {cell.note}
          </span>
        )}
      </span>
    )
  }

  if (cell.kind === 'link') {
    return (
      <span className="block">
        <a
          href={cell.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-2"
        >
          {cell.display}
        </a>
        {cell.note && (
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground text-pretty">
            {cell.note}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className="block">
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          cell.tone === 'success' && 'text-success',
          cell.tone === 'destructive' && 'text-destructive',
          cell.tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {cell.display}
      </span>
      {cell.note && (
        <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground text-pretty">
          {cell.note}
        </span>
      )}
    </span>
  )
}
