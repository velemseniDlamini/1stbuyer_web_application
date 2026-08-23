'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { PhoneShell } from '@/components/app-frame'
import { BrandMark } from '@/components/screen-header'
import { Card, EmptyState, Notice } from '@/components/ui-kit'
import { useStore } from '@/lib/store'
import { VEHICLES } from '@/lib/data'
import {
  SHARED_VIEW_BANNER,
  SHARE_EXPIRED_MESSAGE,
  findValidShare,
  toPublicRows,
} from '@/lib/share-token'
import { formatNumber, formatZAR } from '@/lib/format'
import { Loader2, Scale } from 'lucide-react'

/**
 * The read-only view a friend opens. It reads the share record, resolves the
 * car ids to catalogue listings, and passes ONLY listing facts through
 * `toPublicRows`, the personal figures are never in scope here.
 *
 * In this build shares live in the same local store as everything else, so a
 * link only resolves on the device that created it. That limitation is stated
 * on screen rather than hidden: pretending otherwise would send someone a link
 * that silently shows nothing.
 */
export function SharedComparison({ token }: { token: string }) {
  const { ready, prunedShares } = useStore()

  const share = useMemo(
    () => findValidShare(prunedShares, token),
    [prunedShares, token],
  )

  const rows = useMemo(() => {
    if (!share) return []
    const vehicles = share.carIds
      .map((id) => VEHICLES.find((v) => v.id === id))
      .filter((v): v is (typeof VEHICLES)[number] => Boolean(v))
    return toPublicRows(vehicles)
  }, [share])

  if (!ready) {
    return (
      <PhoneShell>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p className="text-sm">Opening the shared comparison…</p>
        </div>
      </PhoneShell>
    )
  }

  return (
    <PhoneShell>
      <main className="no-scrollbar flex-1 overflow-y-auto px-4 pb-10">
        <header className="flex items-center justify-between py-4">
          <BrandMark />
          <Link href="/login" className="text-xs font-semibold text-primary">
            Sign in
          </Link>
        </header>

        {!share || rows.length === 0 ? (
          <div className="space-y-4">
            <EmptyState icon={<Scale className="h-8 w-8" />} title="This link is not available">
              {SHARE_EXPIRED_MESSAGE}
            </EmptyState>
            <Notice tone="muted">
              Share links are held on the device that created them in this build, so a link opened
              on another device or after 24 hours will not resolve. We would rather tell you that
              than show an empty page.
            </Notice>
            <Link
              href="/login"
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Open 1st Buyer
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-semibold leading-tight">
                A shared comparison
              </h1>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {rows.length} cars, side by side. Someone wants your opinion.
              </p>
            </div>

            <Notice tone="warning">{SHARED_VIEW_BANNER}</Notice>

            <div className="space-y-3">
              {rows.map((row) => (
                <Card key={row.vehicleId} className="p-4">
                  <p className="font-display text-base font-semibold leading-tight text-pretty">
                    {row.title}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">{formatZAR(row.price)}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <Row label="Year" value={String(row.year)} />
                    <Row label="Mileage" value={`${formatNumber(row.mileage)} km`} />
                    <Row label="Fuel" value={row.fuel} />
                    <Row label="Transmission" value={row.transmission} />
                    <Row label="Branch" value={row.dealer} />
                  </dl>
                </Card>
              ))}
            </div>

            <Notice tone="muted">
              Sample catalogue data, illustrative prices, not offers. Instalments, affordability and
              the sender&apos;s credit band are deliberately not included in this view.
            </Notice>

            <Link
              href="/login"
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
            >
              Get your own estimate
            </Link>
          </div>
        )}
      </main>
    </PhoneShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium text-pretty">{value}</dd>
    </div>
  )
}
