'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * The one overlay primitive in the app. Extracted from the dealer-compare sheet
 * in Explore so Car Compare's credit gate reuses it instead of introducing a
 * third, subtly-different modal.
 *
 * Behaviour: backdrop click and Escape dismiss, clicks inside do not propagate,
 * focus moves to the panel on open and returns to the opener on close, and the
 * panel scrolls internally at 80vh rather than pushing the page.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  dismissible = true,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  /** A gate sheet still closes: it must never trap the user on a dead screen. */
  dismissible?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement
    panelRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const opener = openerRef.current
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-background p-4 outline-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-pretty">{title}</h2>
          {dismissible && (
            <button
              onClick={onClose}
              aria-label={`Close ${title}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
