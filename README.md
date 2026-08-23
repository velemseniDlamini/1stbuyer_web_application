# 1st Buyer

A South African first-time car-buyer companion. It exists to close the
information gap between a first-time buyer and a dealership's finance desk.

1st Buyer is not a dealer, not a lender, not a credit bureau and not an
insurer. It sells nothing and earns no commission.

## What it does

The app is organised as a six-stage buying journey:

1. **Know Yourself** - record a bureau credit score and see the interest-rate band it should buy
2. **Know the Market** - used listings, brand-new cars, rivals and dealer branches
3. **Know Your Deal** - instalment, interest, total cost and balloon exposure
4. **Find Your Car** - save and compare the vehicles you are serious about
5. **Seal the Deal** - a dealer quotation read line by line against benchmarks
6. **Protect Your Ride** - indicative insurance comparison

Plus **Chatbot**, an AI assistant that answers questions about cars, credit,
finance, quotations, rights and insurance, and refuses everything else. See
[docs/guardian.md](docs/guardian.md).

Signed out, the app opens on the login screen. A hidden staff portal carries a
support role and a super-admin role with live traffic analytics.

## Profile fields: what is locked

Identity and anything that feeds a calculation is fixed once the account is
created, so a figure cannot be quietly changed after estimates were built on it.

| Locked after sign-up | Editable |
| --- | --- |
| First and last name | Province |
| Date of birth | City or town |
| Licence issue date | Employment status |
| | Net monthly income |
| | Buying goal |

Locked fields are rendered as text with the reason, not as disabled inputs:
there is no control in the form to re-enable from devtools. Corrections go
through support, which leaves a record. **Account deletion was removed
entirely**, UI and store action both, so no code path wipes an account from the
interface.

## Income is NET, and the thresholds moved with it

The app asks for take-home pay, because that is the figure a buyer actually
knows. The familiar affordability guideline ("under 20 to 25 percent") is quoted
against GROSS pay, so applying it unchanged to a net figure would have made
every verdict wrong in a way that still looked plausible.

Net pay in South Africa is roughly 72% of gross after PAYE and UIF, so the bands
are scaled by 1 / 0.72: **comfortable under 28%, stretch to 42%, risky above**.
The old "lenders may decline over 30%" wording is gone, because lenders assess
gross income and total debt, not this instalment alone. See
`AFFORDABILITY_BANDS` and `NET_TO_GROSS_ASSUMPTION` in `lib/finance.ts`.

## The rule the whole codebase is built on

**Nothing is invented.**

- No instalment, affordability verdict or rate target without a real credit score
- No specification or price without a named, dated source
- Anything the app does not hold is shown as "Not listed", never estimated into place
- Chatbot cannot write a citation: it emits a marker that the server resolves
  against a fixed knowledge base, and unknown ids are deleted

The user-facing "Know Your Rights" screen was removed, but the CPA and NCA
source material it taught was kept in `lib/legal-references.ts` and is still
what Chatbot cites. Deleting the corpus would have left it answering legal
questions from model memory.

`lib/specs.ts` and `lib/reliability.ts` are deliberately empty. No sourced South
African reliability, service-cost or resale data exists in this project, so the
app says so instead of ranking cars on figures it does not have.

## Stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4,
Supabase (Postgres + Auth + RLS), Google Gemini for Guardian. Tests run on
`node --test` against compiled output, with no test framework dependency.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

`.env.local` is gitignored. `.env.example` documents every variable and
contains no real values.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server on :3000 |
| `pnpm build` | Production build |
| `pnpm test` | Type-check the tests, then run them |
| `pnpm typecheck` | Type-check the app |
| `pnpm db:migrate` | Apply pending Supabase migrations |
| `pnpm db:verify` | Assert RLS, policies and constraints against the live schema |
| `pnpm db:rls` | Connect as `anon` and prove it can read and write nothing |
| `pnpm db:verify:auth` | Create two real users and prove each sees only its own row |
| `pnpm db:verify:sync` | Round-trip credit history and documents as a signed-in user |
| `pnpm lint` | ESLint, using the flat config in `eslint.config.mjs` |

## Documentation

- [docs/guardian.md](docs/guardian.md) - Guardian's architecture, knowledge layers, security and configuration
- [supabase/README.md](supabase/README.md) - schema, migrations, RLS properties verified live, and what is still missing

## Analytics and privacy

The super-admin dashboard shows real traffic from the `app_visits` table: visits
per day, visitors, most-visited screens and device mix.

What is recorded per page view: the route, a device class, whether the visitor
was signed in, and the time. What is **not** recorded: no IP address, no user
agent, no user id, no location, no referrer. Visitors are counted with a random
token the browser rotates every 24 hours and the server stores hashed, so
someone returning tomorrow counts twice. That under-counting is the deliberate
price of not tracking people across days, and the dashboard says so on screen.

Share links are recorded as `/share/[token]`, never with the live token.

## Status, stated plainly

Server-backed today: authentication, profiles, credit history, the finance
document pack, and the brand-new car catalogue.

Still browser-local: comparisons, finance scenarios, quotations, support
tickets and the staff portal. They do not follow a user between devices, and
the profile screen says so rather than implying everything syncs.

### Before this handles real money or real personal data

These are **not** done, and none can be fixed in SQL alone:

1. **Staff authentication runs in the browser.** The portal models the roles,
   screens and audit trail; it is not an access boundary. Real enforcement
   needs the route gate moved to middleware and staff auth moved server-side.
2. **Email verification is bypassed at sign-up** (`app/api/auth/register`),
   because this project has confirmation on with no custom SMTP. Turn on a real
   mail provider before launch.
3. **No TOTP for staff**, no invite flow, no IP rate limiting.
4. **Guardian's rate limiter is in-process**, so it does not survive a restart
   or coordinate across instances.
5. **`/api/admin/analytics` is not authenticated.** It returns aggregates only
   (daily counts, top screens, device mix) and no row that could identify a
   person, but anyone who knows the URL can read them. It has to check a
   server-side staff session before this carries anything commercially
   sensitive.
6. **Credentials shared during development must be rotated**: the database
   password, the Supabase service-role key, the Gemini API key and any GitHub
   token used to push this repository.

The used-car catalogue is a sample for the prototype. Its prices, mileages and
availability are illustrative, and every screen that uses them says so.
