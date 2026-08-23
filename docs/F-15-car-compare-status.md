# F-15 Car Compare, delivery status

Status vocabulary follows the PRD: **Implemented** (works today, end to end),
**Partial** (visible but not fully wired), **Missing** (must be built),
**Deferred** (out of scope for this version by decision, recorded as a Q-item).

## Architecture note, read before the table

The brief specifies a Supabase-backed architecture: `contexts/`, `supabase/`,
`lib/db.ts`, `lib/finance-estimate.ts`, a `PageHeader` component, a `cars` table
and `profile.credit_bureau === "Not connected"`. **None of those exist in this
repository.** This build is the localStorage rebuild: state lives in
`lib/store.tsx`, finance maths in `lib/finance.ts`, the header component is
`ScreenHeader`, and the catalogue is the `VEHICLES` constant in `lib/data.ts`.

The feature is therefore built against the architecture that exists, with each
requirement mapped one-for-one:

| Brief says | Built against | Consequence |
| --- | --- | --- |
| `lib/finance-estimate.ts` | `lib/finance.ts` | Same pure functions, reused not re-derived. The rate composition here is prime + credit-band spread; there is no age/licence loading in the finance module (that loading lives in `lib/insurance.ts` and is applied to premiums). |
| `profile.credit_bureau === "Not connected"` | `currentScore === null` plus `isUsableScore()` | Same gate, stricter: 0, NaN and out-of-range values are also "no score". |
| `cars` table + migration | `VEHICLES` constant + migration file | Migrations are written and correct but **not executed by the running app**, see `supabase/README.md`. |
| Dealer-compare bottom sheet | Same component, now extracted to `components/bottom-sheet.tsx` | One overlay primitive, used by dealer compare and the credit gate. |

## The 25 requirements

### 1-6 Core comparison surface

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 1 | `/compare` route, gated, same shell/rhythm; entry from Explore and Guardian | **Implemented** | `app/compare/page.tsx` inside `AppFrame` (auth + profile gate). Compare toggle on every Explore vehicle card; Guardian returns a `compare` deep-link chip. |
| 2 | Up to 3 cars, 4th visibly disabled | **Implemented** | `toggleCompareId()` refuses the fourth; the button renders "Max 3", `disabled`, at 50% opacity, with an explanatory notice. Verified in-browser: 3 selected, 5 buttons disabled. |
| 3 | Mobile swipe layout with sticky label rail; real grid from `md` | **Implemented** | One `<table>`; `<md` it scrolls horizontally inside its own container with `th[scope=row]` pinned via `position: sticky`, `md:table-fixed` above. Trade-off recorded in a block comment at the top of `components/screens/compare.tsx`. Verified at 320px: page `scrollWidth` 320, rail scrolls, labels stay pinned. |
| 4 | One label set, fixed order, every car | **Implemented** | `COMPARE_ATTRIBUTES` is the single source; a unit test asserts every car answers the identical key set, and that no label or id is duplicated. |
| 5 | Remove / clear-all ≥44px, URL persistence `?cars=` | **Implemented** | Per-car remove is 44×44; clear-all and every control are `min-h-11`. State lives in the URL, so refresh and sharing both work. The header back button was also raised 36→44px. |
| 6 | Empty state, never blank | **Implemented** | Prompt, direct link into Explore, plus saved comparisons if any exist. |

### 7-11 Credit gating and financial honesty

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 7 | Hard gate: no score → no instalment/affordability number, sheet with copy + `/credit` button | **Implemented** | Cells render `kind: 'locked'`, never a figure. The sheet uses the shared `BottomSheet` (no third overlay) and carries the exact required sentence. Tests assert no locked cell contains a digit. |
| 8 | Reuse the pure instalment logic; agree with Explore | **Implemented** | `estimateInstalment()` added to `lib/finance.ts`; Explore was refactored to call it. Test asserts equality with Explore's figure across four score cases; verified in-browser (R 5 999/mo on both screens). |
| 9 | Affordability badge, same three bands, meaning in the text | **Implemented** | `assessAffordability()` reused verbatim; badge label carries the meaning, colour only reinforces. Threshold tests pin 20%/30% boundaries. |
| 10 | Never compute a number the data doesn't support | **Implemented** | `specCell()` never calls its formatter for a null; absent values render "Not listed". Test asserts the formatter is not invoked. |
| 11 | Score of 0 / implausible values guarded | **Implemented** | `isUsableScore()` rejects 0, negatives, >999, NaN and Infinity; all route to the gate rather than to a synthesised entitlement. |

### 12-16 Specs, running costs, reliability

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 12 | `car_specs` migration with real spec fields | **Partial** | Migration written (`supabase/migrations/…_car_specs.sql`) with nullable columns, range checks, RLS and a `car_specs_requires_source` constraint. `lib/specs.ts` mirrors it. **The registry is empty**: no spec is stored without a citable source, so every spec row currently renders "Not listed". Populating it needs a real ingestion, that is the honest state, not a stub. |
| 13 | Reliability from a named real source or absent | **Implemented (as absence)** | `lib/reliability.ts` names the Cars.co.za Ownership Satisfaction Survey (with Lightstone), the AA-Kinsey Report and AA AutoFacts, with links. No rating is invented; every model shows "Reliability data not yet available for this model" plus where the data will come from. |
| 14 | Indicative running cost, insurance from existing logic, labelled | **Implemented** | Fuel = user-editable ℓ/100km × price × km; insurance = cheapest comprehensive premium from `lib/insurance.ts`. "Indicative, not a quote" is shown, and the screen states whether consumption came from a spec sheet or the user's assumption. Servicing is reported as *excluded*, not estimated. |
| 15 | TCO / depreciation out of scope, recorded | **Deferred (recorded)** | `TCO_DEFERRED_NOTE` is rendered on the screen and repeated in the exported summary. Open question: **Q-15.1, which South African residual-value dataset do we license?** No estimate ships without one. |
| 16 | One outbound research link per vehicle | **Implemented** | Cars.co.za model search, `target="_blank" rel="noopener noreferrer"`. Labelled "Look up on Cars.co.za" because it is a search on the model, not this specific listing, the catalogue holds no per-listing URL. |

### 17-21 Integration

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 17 | Feeds the buying journey as a real event | **Implemented** | `buildComparisonEvent()` appends to `comparisonEvents`; `satisfiesKnowTheMarket()` grants stage 3 only for ≥2 cars *and* a usable score. Verified by setting `visitedMarket: false` and observing stage 3 complete from the event log alone. |
| 18 | Insurance handoff, closing the hard-coded-vehicle defect | **Implemented** | `lib/vehicle-context.ts` built once, used by both screens. `/insurance?vehicle=v4` prices the Ranger and says "carried over from your comparison". |
| 19 | Guardian `compare` intent with catalogue matching | **Implemented** | Deterministic keyword rule plus a `when()` predicate that fires when two catalogue models appear in the question, so "should I get the Polo Vivo or the Corolla Cross?" works with no comparison keyword at all. No model call. Placed after the topic rules so "compare insurance" still reaches insurance (tested). |
| 20 | Export as downloadable text | **Implemented** | `buildComparisonSummary()` (pure, tested) → `car-comparison.txt`, same client-side pattern as `negotiation-points.txt`. Locked and missing values export as locked and missing. |
| 21 | Dashboard card only once genuinely persisted | **Implemented** | `RecentComparison` returns `null` when nothing is saved; no new static tile. |

### 22-25 Data model, quality, testing, analytics

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
| 22 | `saved_comparisons` with full RLS | **Partial** | Migration written with `profile_id` FK cascading, 2-3 element check constraint, and all four `auth.uid()`-scoped policies. The **running app persists to `localStorage`** in the same shape, because this build has no Supabase client. Not executed against a database. |
| 23 | Flag non-live catalogue data | **Implemented** | `CATALOGUE_SOURCE` in `lib/data.ts`; Compare renders the warning whenever `kind !== 'live'`, which is always in this build. Ready to read a real fallback signal when `lib/db.ts` exists. |
| 24 | Unit tests for the pure logic | **Implemented** | 63 tests, all passing, zero new dependencies (`node --test` on Node 24). Run with `pnpm test`. Covers: spec parity/"not listed", running-cost maths, affordability thresholds, the credit-gate boolean, selection/URL parsing, journey events, export text, Guardian matching, and analytics sanitisation. Includes the required test that two users in different credit bands see different instalments for the identical car. |
| 25 | Privacy-safe analytics | **Implemented** | `cars_compared`, `comparison_saved`, `comparison_shared` emit ids, brands and count only. `sanitiseEvent()` strips money/credit/identity keys at the transmission point, not at the call site. Verified live: payload was `{car_ids, brands, count}`. |

## Bugs found and fixed while building

1. **Analytics deny-list was eating its own payload.** A substring match on
   `rand` dropped the `brands` field. Replaced with token-based matching
   (`tokeniseKey`), so `brands` passes and `totalRandAmount` still does not.
2. **Guardian missed the most natural phrasing.** "Should I get the X or the Y?"
   contains no comparison keyword; added a deterministic `when()` predicate that
   fires on two catalogue model names.
3. **Guardian didn't mention the gate.** A comparison answer for a user with no
   score now leads with "record your credit score first", matching the screen.
4. **Stale-closure in the Explore compare toggle.** Two taps in one frame could
   overwrite each other; converted to a functional state update, as the dealer
   tray already used.

## Open questions

- **Q-15.1** Residual-value dataset for depreciation/TCO (blocks #15).
- **Q-15.2** Licensing for the Cars.co.za/Lightstone OSS and AA-Kinsey data
  (blocks #13 showing any figure).
- **Q-15.3** Source and cadence for manufacturer spec ingestion (blocks #12).
- **Q-15.4** Fuel price is a dated assumption the user edits. Is a live fuel-price
  feed in scope, and if so whose?
