'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { BottomNav } from './bottom-nav'
import { SideNav } from './side-nav'
import { GuardianLauncher } from './guardian/guardian-launcher'
import { Loader2 } from 'lucide-react'

/**
 * Wraps every in-app screen: enforces the auth/profile gate, then renders the
 * shell appropriate to the viewport.
 *
 * RESPONSIVE MODEL (this replaces the fixed phone frame).
 *
 *   narrow or short: full-bleed single column with the bottom bar. This is
 *          what a phone gets in either orientation.
 *   wide: a real desktop application layout, sidebar plus a centred content
 *          column. No simulated handset bezel, because a 1920px screen showing
 *          a 448px phone mock wastes the viewport and makes dense screens
 *          (Compare, Documents, the staff portal) unusable. "wide" means at
 *          least 768px across AND 600px tall, so a rotated iPhone keeps the
 *          phone layout rather than losing 240px of its 375px of height to a
 *          sidebar.
 *
 * Both branches keep the same internal-scroll architecture: the main region
 * scrolls, the shell does not. Screens that manage their own height (Guardian's
 * chat composer) and every sticky header therefore behave identically on both.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { ready, account, profile, systemSettings } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    if (!account) router.replace('/login')
    else if (!profile) router.replace('/onboarding')
  }, [ready, account, profile, router])

  // Maintenance mode, set from the staff portal, closes the consumer app while
  // leaving the portal reachable. Nothing recorded is touched, and the message
  // says so.
  if (ready && systemSettings.maintenanceMode) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted px-5">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground">
            1
          </span>
          <h1 className="font-display text-xl font-semibold">We will be back shortly</h1>
          <p className="mt-2 text-sm text-muted-foreground text-pretty">
            {systemSettings.maintenanceMessage}
          </p>
        </div>
      </div>
    )
  }

  if (!ready || !account || !profile) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p className="text-sm">Loading your companion…</p>
        </div>
      </AppShell>
    )
  }

  return <AppShell nav>{children}</AppShell>
}

function AppShell({ children, nav = false }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className="safe-x flex h-dvh w-full overflow-hidden bg-background">
      {nav && <SideNav />}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* The bottom padding clears the floating Guardian button. Without it
            the last card on a screen sits permanently under the button and can
            never be scrolled out from beneath it, which is the difference
            between a floating control and a broken one. */}
        <main className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-28 wide:pb-24">
          {/* The content column is capped so a paragraph never stretches across
              1600px, but the cap is generous: at max-w-3xl a 1440px screen threw
              away 216px on each side, 36% of the region, which read as a phone
              layout stranded in the middle of a desktop. max-w-6xl fills a
              laptop almost edge to edge while still bounding line length, and
              the lg: grids on the dashboard and Explore finally have the room
              they were already asking for. */}
          <div className="mx-auto w-full wide:max-w-6xl wide:px-6">{children}</div>
        </main>
        {/* Guardian rides along with the app shell, so it is reachable from
            every screen without each screen knowing about it. It is inside the
            `nav` branch on purpose: there is nothing for it to help with on
            the loading, login or onboarding screens. */}
        {nav && <GuardianLauncher />}
        {nav && <BottomNav />}
      </div>
    </div>
  )
}

/**
 * Standalone card shell for screens outside the app gate (onboarding, a shared
 * comparison). Full-bleed on a phone, a centred card on a desktop.
 */
export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-muted wide:items-center wide:py-8">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background wide:h-[min(46rem,92vh)] wide:w-[30rem] wide:rounded-3xl wide:border wide:border-border wide:shadow-xl">
        {children}
      </div>
    </div>
  )
}
