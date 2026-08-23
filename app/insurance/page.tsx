import { Suspense } from 'react'
import { AppFrame } from '@/components/app-frame'
import { InsuranceScreen } from '@/components/screens/insurance'
import { Loader2 } from 'lucide-react'

/** The screen reads ?vehicle= (handed over by Car Compare), so it needs a
 *  Suspense boundary, this is its loading state. */
function InsuranceLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <p className="text-sm">Pricing your cover…</p>
    </div>
  )
}

export default function Page() {
  return (
    <AppFrame>
      <Suspense fallback={<InsuranceLoading />}>
        <InsuranceScreen />
      </Suspense>
    </AppFrame>
  )
}
