// F-15, "Ask a friend" read-only share tokens.
//
// A share link must expose the cars and nothing about the person: no credit
// band, no income, no instalment. The redaction happens HERE, in a pure
// function, so the public view cannot accidentally render a personal number,
// it never receives one.

export const SHARE_TTL_HOURS = 24

export type ComparisonShare = {
  token: string
  carIds: string[]
  createdAt: string
  expiresAt: string
}

/** URL-safe token. crypto.randomUUID is available in browsers and Node 24. */
export function createShareToken(
  carIds: readonly string[],
  now: Date = new Date(),
  uuid: () => string = () => crypto.randomUUID(),
): ComparisonShare {
  const expires = new Date(now.getTime() + SHARE_TTL_HOURS * 3600 * 1000)
  return {
    token: uuid().replace(/-/g, ''),
    carIds: [...carIds],
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  }
}

export function isExpired(share: ComparisonShare, now: Date = new Date()): boolean {
  const expiry = new Date(share.expiresAt).getTime()
  if (!Number.isFinite(expiry)) return true
  return expiry <= now.getTime()
}

export function findValidShare(
  shares: readonly ComparisonShare[],
  token: string,
  now: Date = new Date(),
): ComparisonShare | null {
  const share = shares.find((s) => s.token === token)
  if (!share || isExpired(share, now)) return null
  return share
}

/** Fields a shared view may never receive. Asserted by unit test. */
export const REDACTED_FIELDS = [
  'instalment',
  'affordability',
  'creditBand',
  'creditScore',
  'monthlyIncome',
] as const

export type PublicComparisonRow = {
  vehicleId: string
  title: string
  price: number
  year: number
  mileage: number
  fuel: string
  transmission: string
  dealer: string
}

/**
 * Strip a comparison down to what a friend may see. Takes only the listing
 * facts, personal numbers are not parameters of this function at all.
 */
export function toPublicRows(
  vehicles: readonly {
    id: string
    make: string
    model: string
    variant: string
    price: number
    year: number
    mileage: number
    fuel: string
    transmission: string
    dealer: string
  }[],
): PublicComparisonRow[] {
  return vehicles.map((v) => ({
    vehicleId: v.id,
    title: `${v.year} ${v.make} ${v.model} ${v.variant}`.trim(),
    price: v.price,
    year: v.year,
    mileage: v.mileage,
    fuel: v.fuel,
    transmission: v.transmission,
    dealer: v.dealer,
  }))
}

export const SHARED_VIEW_BANNER = 'Personalised instalments hidden, sign in for your own estimate'

export const SHARE_EXPIRED_MESSAGE =
  'This shared comparison has expired. Share links last 24 hours; ask for a fresh one.'
