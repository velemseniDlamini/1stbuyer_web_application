'use client'

// Assembles what Guardian is told about the user's situation.
//
// One hook, so the floating panel and the full Guardian screen cannot disagree
// about what the user is looking at.

import { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useStore } from '../store'
import { VEHICLE_PARAM } from '../vehicle-context'
import { pageIdFor, suggestionsFor } from './suggestions'
import type { GuardianContext, GuardianPrivateContext } from './protocol'
import { COMPARE_PARAM } from '../compare'

export type GuardianLiveContext = {
  context: GuardianContext
  private: GuardianPrivateContext
  suggestions: string[]
}

export function useGuardianContext(): GuardianLiveContext {
  const pathname = usePathname()
  const params = useSearchParams()
  const { profile, currentScore, journeyDone, quotations } = useStore()

  const vehicleId = params.get(VEHICLE_PARAM)
  const compareParam = params.get(COMPARE_PARAM)

  return useMemo(() => {
    const page = pageIdFor(pathname ?? '/')

    const context: GuardianContext = {
      page,
      vehicleId,
      // Car Compare carries its set in the URL, which is also what makes a
      // comparison shareable, so reading it here needs no extra state.
      compareIds: compareParam ? compareParam.split(',').filter(Boolean).slice(0, 3) : [],
      newCarId: null,
    }

    // The sensitive half. It leaves the browser on every request, but the
    // server keeps it out of the prompt until a tool asks for it, so an
    // unrelated question never carries it to the model.
    const priv: GuardianPrivateContext = {
      creditScore: currentScore,
      monthlyIncome: profile?.monthlyIncome ?? null,
      firstName: profile?.firstName ?? null,
      completedStages: Object.entries(journeyDone)
        .filter(([, done]) => done)
        .map(([id]) => id),
      quotation: quotations[0]
        ? {
            vehicle: quotations[0].vehicle,
            score: quotations[0].score,
            findings: quotations[0].findings,
          }
        : null,
    }

    return { context, private: priv, suggestions: suggestionsFor(page) }
  }, [pathname, vehicleId, compareParam, currentScore, profile, journeyDone, quotations])
}
