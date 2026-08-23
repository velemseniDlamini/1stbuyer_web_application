import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AppFrame } from '@/components/app-frame'
import { CompareScreen } from '@/components/screens/compare'
import { VEHICLES } from '@/lib/data'
import { parseCompareIds } from '@/lib/compare'
import { Loader2 } from 'lucide-react'

/**
 * A shared comparison link must preview properly in WhatsApp. The car ids are
 * in the query string, so the title and description are generated from the
 * catalogue server-side, real vehicle names, never a generic app blurb.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ cars?: string }>
}): Promise<Metadata> {
  const { cars } = await searchParams
  const ids = parseCompareIds(cars ?? null, VEHICLES)
  const names = ids
    .map((id) => VEHICLES.find((v) => v.id === id))
    .filter((v): v is (typeof VEHICLES)[number] => Boolean(v))
    .map((v) => `${v.make} ${v.model}`)

  if (names.length === 0) {
    return {
      title: 'Compare cars, 1st Buyer',
      description:
        'Put two or three cars side by side on the same questions: price, instalment at your own credit band, affordability and running costs.',
    }
  }

  const title = `1st Buyer: Comparing ${names.join(' vs ')}`
  const description = `${names.join(' vs ')}, compared on price, specification, instalment and running costs. Personalised figures require your own credit score.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  }
}

/** useSearchParams needs a Suspense boundary; this is the screen's loading state. */
function CompareLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <p className="text-sm">Lining up your cars…</p>
    </div>
  )
}

export default function Page() {
  return (
    <AppFrame>
      <Suspense fallback={<CompareLoading />}>
        <CompareScreen />
      </Suspense>
    </AppFrame>
  )
}
