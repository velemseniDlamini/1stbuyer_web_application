import { SharedComparison } from '@/components/screens/shared-comparison'

/**
 * Public, read-only comparison view. Deliberately OUTSIDE the (app) auth gate,
 * a friend without an account must be able to open it, and deliberately
 * stripped: it never receives an instalment, an affordability verdict or a
 * credit band, because `toPublicRows()` does not accept those fields at all.
 */
export const metadata = {
  title: 'Shared car comparison, 1st Buyer',
  description: 'A read-only car comparison shared from 1st Buyer. Personalised finance figures are hidden.',
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SharedComparison token={token} />
}
