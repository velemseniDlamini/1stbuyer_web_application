'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export function ScreenHeader({
  title,
  subtitle,
  back,
  backTo = '/',
  right,
}: {
  title: string
  subtitle?: string
  back?: boolean
  /** Where to go when this screen was opened directly and there is no history
   *  to return to, a shared link, a bookmark or a browser restore. */
  backTo?: string
  right?: ReactNode
}) {
  const router = useRouter()

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(backTo)
  }
  return (
    // z-20 clears the sticky label column inside the Compare table, and the
    // background is fully opaque: at 90% the content scrolling underneath
    // ghosted through the header and read as two overlapping elements. A
    // translucent bar looks good over a photograph and bad over dense text.
    <header className="sticky top-0 z-20 border-b border-border bg-background px-4 py-3">
      <div className="flex items-center gap-2">
        {back && (
          <button
            type="button"
            onClick={goBack}
            aria-label="Go back"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function BrandMark({ small }: { small?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">
        1
      </span>
      {!small && (
        <span className="font-display text-lg font-semibold tracking-tight">
          1<span className="text-primary">st</span> Buyer
        </span>
      )}
    </Link>
  )
}
