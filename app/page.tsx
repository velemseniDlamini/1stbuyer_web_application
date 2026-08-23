'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AppFrame } from '@/components/app-frame'
import { Dashboard } from '@/components/screens/dashboard'
import { useStore } from '@/lib/store'

/**
 * The root route.
 *
 * Signed in, this is the dashboard. Signed out, it sends straight to the login
 * screen: there is no marketing landing page in front of the product.
 *
 * The redirect lives here rather than in AppFrame because AppFrame renders a
 * loading shell first, and a signed-out visitor should reach the login form
 * without a flash of app chrome they cannot use.
 */
export default function Page() {
  const { ready, account, profile } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    if (!account) router.replace('/login')
    // An account with no profile is mid-onboarding and belongs there.
    else if (!profile) router.replace('/onboarding')
  }, [ready, account, profile, router])

  // Hydration guard. Rendering the dashboard before the store has read
  // localStorage would flash empty figures at a signed-in user.
  if (!ready || !account || !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  return (
    <AppFrame>
      <Dashboard />
    </AppFrame>
  )
}
