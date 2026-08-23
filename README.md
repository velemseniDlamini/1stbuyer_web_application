# 1st Buyer

A South African first-time car-buyer companion. It exists to close the
information gap between a first-time buyer and a dealership's finance desk.

1st Buyer is not a dealer, not a lender, not a credit bureau and not an
insurer. It sells nothing and earns no commission.

## What it does

The app is organised as a seven-stage buying journey:

1. **Know Yourself** - record a bureau credit score and see the interest-rate band it should buy
2. **Know Your Rights** - CPA and NCA modules, each with a short quiz
3. **Know the Market** - used listings, brand-new cars, rivals and dealer branches
4. **Know Your Deal** - instalment, interest, total cost and balloon exposure
5. **Find Your Car** - save and compare the vehicles you are serious about
6. **Seal the Deal** - a dealer quotation read line by line against benchmarks
7. **Protect Your Ride** - indicative insurance comparison

Plus **Guardian**, an AI assistant that answers questions about cars, credit,
finance, quotations, rights and insurance, and refuses everything else. See
[docs/guardian.md](docs/guardian.md).

A public landing page introduces the product to signed-out visitors, and a
hidden staff portal carries a support role and a super-admin role with live
traffic analytics.

## The rule the whole codebase is built on

**Nothing is invented.**

- No instalment, affordability verdict or rate target without a real credit score
- No specification or price without a named, dated source
- Anything the app does not hold is shown as "Not listed", never estimated into place
- Guardian cannot write a citation: it emits a marker that the server resolves
  against a fixed knowledge base, and unknown ids are deleted

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
