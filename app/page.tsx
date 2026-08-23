'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AppFrame } from '@/components/app-frame'
import { Dashboard } from '@/components/screens/dashboard'
import { LandingPage } from '@/components/landing/landing-page'
import { useStore } from '@/lib/store'

/**
 * The root route serves two different products.
 *
 * Signed out, "/" is the public landing page: this app has to explain itself to
 * someone who has never heard of it, and bouncing a first-time visitor straight
 * to a sign-in form told them nothing about what they were signing into.
 *
 * Signed in, "/" is the dashboard, unchanged.
 *
 * The auth gate stays in AppFrame for every other screen. Only this route needs
 * to branch, so only this route knows about it.
 */
export default function Page() {
  const { ready, account, profile } = useStore()
  const router = useRouter()

  useEffect(() => {
    // An account with no profile is mid-onboarding and belongs there, not on a
    // marketing page and not on a dashboard with nothing to show.
    if (ready && account && !profile) router.replace('/onboarding')
  }, [ready, account, profile, router])

  // Hydration guard. Rendering the landing page before the store has read
  // localStorage would flash marketing copy at someone who is already signed in.
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (!account) return <LandingPage />

  return (
    <AppFrame>
      <Dashboard />
    </AppFrame>
  )
}
