'use client'

import Link from 'next/link'
import { ScreenHeader } from '@/components/screen-header'
import { Card, Pill } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import { JOURNEY_STAGES } from '@/lib/journey'
import { Check, Lock, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function JourneyScreen() {
  const { journeyDone } = useStore()

  const stages = JOURNEY_STAGES
  const completed = stages.filter((s) => journeyDone[s.id]).length
  const pct = Math.round((completed / stages.length) * 100)

  // The active stage is the first incomplete one.
  const activeIndex = stages.findIndex((s) => !journeyDone[s.id])

  return (
    <div className="pb-8">
      <ScreenHeader
        title="Your buying journey"
        subtitle={`${completed} of ${stages.length} stages complete`}
      />

      <div className="space-y-5 px-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Overall progress</p>
            <span className="font-display text-lg font-semibold text-primary">{pct}%</span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground text-pretty">
            Each stage unlocks as you do the real work of buying a car, not by ticking boxes. Take
            them in order for the smoothest ride.
          </p>
        </Card>

        <ol className="relative space-y-3 pl-2">
          {/* connecting line */}
          <span
            aria-hidden
            className="absolute bottom-6 left-[1.4rem] top-6 w-px bg-border"
          />
          {stages.map((stage, i) => {
            const done = journeyDone[stage.id]
            const isActive = i === activeIndex
            const locked = !done && !isActive && i > activeIndex && activeIndex !== -1
            return (
              <li key={stage.id} className="relative">
                <div className="flex gap-3">
                  <div
                    className={cn(
                      'z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                      done
                        ? 'border-success bg-success text-white'
                        : isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : stage.index}
                  </div>

                  <Card
                    className={cn(
                      'flex-1 p-3.5',
                      isActive && 'ring-2 ring-primary/40',
                      locked && 'opacity-70',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{stage.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                          {stage.blurb}
                        </p>
                      </div>
                      {done ? (
                        <Pill tone="success">Done</Pill>
                      ) : isActive ? (
                        <Pill tone="primary">Now</Pill>
                      ) : (
                        <Pill tone="muted">Soon</Pill>
                      )}
                    </div>

                    {!done && (
                      <Link
                        href={stage.href}
                        className={cn(
                          'mt-3 inline-flex items-center gap-1.5 text-sm font-semibold',
                          isActive ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {stage.action}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                    {done && (
                      <p className="mt-2 text-xs text-success">Unlocked by: {stage.unlockedBy}</p>
                    )}
                  </Card>
                </div>
              </li>
            )
          })}
        </ol>

        {completed === stages.length && (
          <Card className="border-success/30 bg-success/10 p-4 text-center">
            <p className="font-display text-lg font-semibold text-success">
              You are a confident 1st buyer.
            </p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              You have worked through every stage. Walk into that dealership knowing your rights,
              your rate and your numbers.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
