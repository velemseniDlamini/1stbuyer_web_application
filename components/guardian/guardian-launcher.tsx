'use client'

import { Suspense, lazy, useState } from 'react'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

// Loaded only when the user first opens Guardian. Every screen in the app
// mounts this launcher, so the conversation UI and its fetch logic must not be
// in the bundle that renders the dashboard.
const GuardianPanel = lazy(() =>
  import('./guardian-panel').then((m) => ({ default: m.GuardianPanel })),
)

/**
 * The floating Guardian entry point, bottom-left on every in-app screen.
 *
 * WHY THE PANEL IS KEPT MOUNTED ONCE OPENED
 *
 * Minimising hides it with `hidden` rather than unmounting, so the
 * conversation survives closing the panel and moving between screens. A user
 * who asks about a car, taps through to Compare and comes back should find
 * the thread where they left it. A reload still clears it: this is
 * session-level memory, deliberately not persisted.
 */
export function GuardianLauncher() {
  // One state, three positions, rather than an `open` boolean plus a second
  // "has it ever been opened" flag kept in step by an effect. The pair could
  // disagree; this cannot, and "never" is what keeps the panel chunk off the
  // first paint of every screen.
  const [panel, setPanel] = useState<'never' | 'open' | 'closed'>('never')
  const open = panel === 'open'

  return (
    <>
      <button
        type="button"
        onClick={() => setPanel((p) => (p === 'open' ? 'closed' : 'open'))}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Hide Guardian' : 'Ask Guardian, your car-buying assistant'}
        className={cn(
          'group fixed z-40 flex items-center gap-2 rounded-full border border-primary/25 bg-primary py-3 pl-3.5 pr-4 text-primary-foreground shadow-lg outline-none',
          'transition hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95',
          // Phone: clear of the bottom bar and the home indicator, and on the
          // left so it never sits over the raised Guardian centre button.
          'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4',
          // Wide: the sidebar occupies the left 240px and has its own "Ask
          // Guardian" link pinned to its bottom edge. Sitting at left-5 put
          // this button directly on top of that link. Clearing the sidebar
          // means neither covers the other.
          'wide:bottom-5 wide:left-[calc(15rem+1.25rem)]',
          // Hidden behind the panel rather than layered over it.
          open && 'pointer-events-none opacity-0',
        )}
      >
        <span className="relative flex h-6 w-6 items-center justify-center">
          <Shield className="h-5 w-5" aria-hidden />
          {/* A quiet, one-off pulse. It draws the eye without becoming a
              blinking notification badge the user has to dismiss. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-primary-foreground/30 motion-safe:animate-ping motion-safe:[animation-iteration-count:3]"
          />
        </span>
        <span className="text-sm font-semibold">Guardian</span>
      </button>

      {panel !== 'never' && (
        <Suspense fallback={null}>
          <GuardianPanel
            open={open}
            onClose={() => setPanel('closed')}
            onMinimise={() => setPanel('closed')}
          />
        </Suspense>
      )}
    </>
  )
}
