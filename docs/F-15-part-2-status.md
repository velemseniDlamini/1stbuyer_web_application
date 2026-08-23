# F-15 Car Compare, part 2 (smart comparison, polish, ecosystem)

Status vocabulary: **Implemented** / **Partial** / **Missing** / **Deferred**.
Numbering follows the brief. Note the brief skips 35; there is no requirement 35.

## Architecture mapping (unchanged from part 1)

Still the localStorage build: no Supabase client, no `contexts/`, `lib/store.tsx`
rather than `lib/db.ts`. Migrations are shipped as forward-looking schema and are
**not executed by the running app** (`supabase/README.md` says so on line one).
`profile.preferences` is a real field on the local `Profile` type, mirroring the
`profiles.preferences` jsonb column the migration set assumes.

## Requirements

| # | Requirement | Status | Notes |
| --- | --- | --- | --- |
|, | Smart suggestions (3 strategies, chips, dismissible) | **Implemented** | `lib/suggestions.ts`. Strategy (a) same brand ±20% price, (b) same fuel+transmission, newer or ≥5 000 km less, (c) most-compared-with from a **count-only** pair aggregate built from saved comparisons (no user ids, no timestamps). Chips, not modals. Dismissal persists to `profile.preferences.dismissedSuggestionIds`, verified live: dismissing the Corolla Cross wrote `["v2"]` and it never returned. |
| 26 | "Why am I seeing this?" | **Implemented** | Every chip carries its own reason ("Similar price, newer, 14 700 km less", "Compared with the Polo 1 time in saved comparisons"), plus an expandable note naming all three rules. A unit test asserts no reason ever matches /recommended\|for you/. |
| 27 | Spec-mismatch conflict resolution | **Implemented** | `runningCostConflict()` detects a mixed basis across the set and renders "Not like for like: … consumption not listed for X, so the estimate uses the editable class assumption (clearly marked)". Missing cells render dimmed (`opacity-70`) with the reason beneath. |
| 28 | Weighted decision helper | **Implemented** | `lib/decision-score.ts`, collapsible panel, five weighted criteria. A criterion with no data is **excluded and renormalised**, never zeroed, and the UI states "Score excludes reliability reputation, dealer proximity and specification, data not yet available." Verified live. |
| 29 | Honest pros/cons | **Implemented** | `buildInsights()`. Every line carries a `basis` string rendered as "from your recorded income and credit band". Produces "Instalment is 13% of your income, comfortable" exactly as specified. Silent when there is no instalment or no income; falls back to "No strong advantages or risks identified yet". |
| 30 | Deal-quality indicator | **Implemented (honest-absence today)** | `lib/market-value.ts` compares the asking price to the **median of its own catalogue peers** (same make/model/year ±1) and only when ≥3 peers exist. The 8-car sample has no such peer groups, so every card currently reads "Market context not yet available" with a methodology link, never a neutral badge implying fairness. Unit tests cover below/at/above with synthetic peers. |
| 31 | Price-history sparkline | **Implemented (dormant, by design)** | `lib/price-history.ts` + `components/sparkline.tsx` (inline SVG, no chart dependency). Renders only from ≥2 real observations; the registry is empty, so **no sparkline and no placeholder line** appear. `price_snapshots` migration added. |
| 32 | Spec-diff highlighting | **Implemented** | Thresholds live in `lib/compare-helpers.ts` with the reasoning in comments: 15% relative for power/torque (below ~15% is imperceptible), 20% engine capacity, 15% boot, 10% consumption, 5% price, and an absolute 15 000 km for mileage (~one SA year). Tint + `title` + a visible sentence in the cell, never colour alone. Verified live: R40 000 price gap tinted with "Best of the set, R 40 000 less than the weakest here." |
| 33 | "Too similar to compare?" guard | **Implemented** | `similarityGuard()` fires on same make+model+year within 5% price and mileage, with the required wording. Unit-tested; the sample catalogue holds no such pair, so it is dormant on real data. |
| 34 | Natural-language input | **Implemented** | `lib/fuzzy.ts`, shared with Guardian (one matcher, two entry points, Guardian was refactored onto it). Splits on vs/versus/or/and, top 2 distinct models per term. Verified live: "Polo Vivo vs Corolla Cross" → VW Polo, and Corolla Cross + T-Cross as the two candidates for term 2. |
| 36 | Photo comparison mode | **Implemented** | Toggle switches the table for a scroll-snapped photo rail (grid from `md`), tap to expand in the shared `BottomSheet`. Uses the existing catalogue image with the existing placeholder fallback. |
| 37 | 360° / interior view | **Implemented as honest absence** | The schema holds no `interior_images` or `three_sixty_url` and no listing has one, so **no chip is rendered** and the photo panel says why. No second lightbox was built, expansion reuses `BottomSheet`. |
| 38 | Haptics | **Implemented** | `lib/haptics.ts`: 10 ms on add, `[20,30,20]` on remove, feature-detected, wrapped in try/catch, and suppressed under `prefers-reduced-motion`. |
| 39 | Spring-physics swipe | **Implemented** | CSS `scroll-snap-type: x mandatory` with `scroll-snap-align: start` per column, the browser's own physics, no gesture library. Verified live on the rail; the sticky label column stays fixed during the swipe. |
| 40 | Skeletons, not spinners | **Implemented** | `components/skeleton.tsx` sized to the final text box; personalised cells show them until the store hydrates. No circular spinner inside the comparison. |
| 41 | Zero layout shift | **Partial** | Skeletons match the final bounding box, rows carry `min-h-11`, and the table reserves every row before data arrives, so shift is designed out. **Not measured**: the repo has no Lighthouse CI (the brief's "existing Lighthouse CI setup" does not exist here), so I cannot assert CLS < 0.05, I will not claim a number I did not measure. |
| 42 | Screen-reader optimised table | **Implemented** | Real `<table>` with `aria-rowcount`/`aria-colcount` and explicit `aria-rowindex`/`aria-colindex` on every row and cell; the label rail is `aria-label="Attribute names"`. Verified live: Mileage is row 5, columns 2 and 3. |
| 43 | High-contrast support | **Implemented** | `@media (prefers-contrast: more)` adds 1px solid borders to every comparison cell and converts the materiality tint into a 2px outline, so no meaning rests on a background wash. Rule confirmed present in the served stylesheet. |
| 44 | Reduced motion | **Implemented** | `prefers-reduced-motion` disables snap and smooth scroll, suppresses haptics, and the existing global rule already neutralises animation. |
| 45 | Sticky "at a glance" bar | **Implemented** | Appears once the vehicle headers scroll away, shows names, prices and affordability verdicts, dismissible to `preferences.glanceBarDismissed`. Verified live. |
| 46 | Dealer proximity & reputation | **Partial (honest)** | We hold **no branch coordinates**, so no distance is computed or faked. Instead: same-city / same-province / other-province from the user's profile, a real Google Maps directions link, and "Add your city to see how far this branch is" when the profile has none. Ratings stay `null` with an explicit statement that we publish none. |
| 47 | Service-network proximity | **Implemented as honest absence** | "Service network data not yet available for {make} in {province}", with why it matters in SA. No dataset is licensed; none is invented. |
| 48 | Load-shedding / charging note | **Implemented (conditional)** | Electric → charging + load-shedding note. Hybrid → states plainly that the listing does not say whether the model plugs in, so the note may not apply. Petrol/diesel → nothing. No public-charger counts are invented. |
| 49 | Insurance variance by province | **Implemented** | The insurance model adjusts for cover, value, tracker, garaging and driver, **not** province, so the note says exactly that rather than implying regional pricing exists. |
| 50 | Negotiation leverage | **Implemented** | `negotiationLeverage()` from the same pure functions: above-market price → mileage above the 20 000 km/year SA average → missing service history. Falls back to "No obvious negotiation flags identified". |
| 51 | History & versioning | **Implemented** | "Save this comparison as…" with a custom name, `HistorySheet` (reusing `BottomSheet`) listing saved sets with timestamps, restore, rename and delete, plus a "Prices and availability may have changed" banner past 30 days. |
| 52 | Rich shareable link | **Implemented (metadata)** | `generateMetadata` reads `?cars=` server-side and emits real names, verified live, the tab title read "1st Buyer: Comparing Volkswagen Polo vs Hyundai i20", with matching OG and Twitter tags. **No OG *image* is generated**; the brief's stated minimum (a static meta description listing the vehicles) is what shipped. |
| 53 | "Ask a friend" read-only view | **Partial** | Token creation (24 h TTL), expiry, `/share/[token]` public route outside the auth gate, and the banner all work, verified live end to end. Redaction is structural: `toPublicRows()` cannot receive an instalment or a band. **Limitation stated on screen**: with no backend, the token record lives on the creating device, so the link resolves only there. `comparison_shares` migration with full RLS + a token-scoped, non-enumerable anon read policy is ready for the backend. |
| 54 | Print / PDF stylesheet | **Implemented** | `@media print`: white canvas, no phone chrome, no sticky positioning, bordered table, and `a[href]::after` printing full URLs. A "Print / PDF" action calls `window.print()`. |
| 55 | Dashboard integration | **Implemented** | Card shows the name, car count and "last updated today / N days ago", and links to `/compare?restore=<id>`. Renders only when a real saved comparison exists. Verified live including the restore round-trip. |

## Non-functional

| Constraint | Status | Notes |
| --- | --- | --- |
| Performance budget (FCP < 1.2 s, TTI < 2.5 s on 4G/mid Android) | **Partial** | The engineering requirement is met, static spec rows render immediately and only personalised cells stream in behind skeletons. The **measurement** is not: no Lighthouse CI exists in this repo, and I did not fabricate numbers. |
| Zero client-side math duplication | **Implemented** | Every money figure comes from one named function in `lib/` (`estimateInstalment`, `assessAffordability`, `calculateRunningCost`, `quoteFor`). A test pins Compare's instalment to Explore's; verified live at R 5 999/mo on both. |
| No new colour palette | **Implemented** | Only existing tokens; hierarchy comes from spacing, weight and the single gold accent. |
| No new dependencies for solved problems | **Implemented, with one addition** | Swipe = CSS scroll-snap; sparkline = inline SVG; modals = the existing `BottomSheet`. **`zod` was added**, the brief explicitly requires Zod schemas in `lib/validations.ts`, and validation was not already solved in-app. It is imported only by `lib/validations.ts` and the tests, so it does not ship in the `/compare` client bundle. |
| Every new table = migration + type + Zod + RLS + test | **Partial** | Migrations, TypeScript types and Zod schemas exist for `car_specs`, `saved_comparisons`, `comparison_shares` and `price_snapshots`, each with full RLS. The RLS **test is not** a service-role-vs-anon `supabase-js` comparison, that is impossible without a project, and I did not fake it. Instead `tests/schema-rls.test.ts` asserts against the shipped SQL: RLS enabled, all four verbs present, every owner policy scoped through `auth.uid()`, cascade on delete, catalogue tables read-only to `authenticated`, and the share policy non-enumerable. |
| Honest-empty > fake-full | **Implemented** | Specs, reliability, sparklines, dealer ratings, service network and market context all degrade to stated absence. |

## Bugs found and fixed while building this wave

1. **320px overflow in the suggestion chip.** `flex-1` without `min-w-0` refuses
   to shrink below content width; the chip ran 17px past the viewport. Fixed and
   re-verified at 320px.
2. **Glance bar never appeared.** It used an `IntersectionObserver` rooted on the
   viewport while the app scrolls inside the phone shell's `<main>`. Replaced
   with a passive scroll listener on the nearest scrollable ancestor.
3. **Suggestions were silent on real data.** Strategy (b) required a 15 000 km
   advantage, the materiality threshold, which no catalogue pair met. Lowered
   to a documented 5 000 km discovery threshold, distinct from the tinting
   threshold, with the exact figure stated on the chip.
4. **Awkward exclusion copy.** "reliability and dealer proximity and
   specification" now reads "reliability reputation, dealer proximity and
   specification" via a `listJoin` helper.

## Verification

- `tsc --noEmit` clean; `next build` green with `/compare` and `/share/[token]`.
- **129 unit tests, all passing**, zero test-runner dependencies (`pnpm test`).
- Live walkthrough at 375px and 320px: suggestions + dismissal persistence,
  spec-diff tint and title text, decision panel with exclusion disclosure, photo
  mode and lightbox, natural-language search, ask-a-friend token → public share
  view (confirmed to contain no instalment, affordability or band), save-as with
  a custom name, dashboard card and restore round-trip, glance bar, scroll-snap
  and sticky rail, aria row/column indices. Console clean on a fresh tab.

## Open questions (carried forward)

- **Q-15.1** Residual-value dataset for depreciation/TCO.
- **Q-15.2** Licensing for Cars.co.za/Lightstone OSS and AA-Kinsey.
- **Q-15.3** Manufacturer spec ingestion source and cadence.
- **Q-15.4** Live fuel-price feed, or keep it a user-owned assumption.
- **Q-15.5** Branch coordinates, so dealer distance can be real (blocks #46 and
  the `dealerDistance` criterion in the decision helper).
- **Q-15.6** OG **image** generation for shared links (#52), needs a decision on
  runtime and font embedding.
