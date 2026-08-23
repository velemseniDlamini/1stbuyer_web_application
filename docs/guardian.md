# Guardian

Guardian is the AI assistant built into 1st Buyer. It answers questions about
cars, credit, finance, dealer quotations, South African consumer rights,
insurance and the app's own tools, and it refuses everything else.

It is not a general chatbot with a car-shaped prompt. The design goal was that
Guardian should be unable to invent a price, a specification, a credit score or
a section of an Act, rather than merely discouraged from doing so.

## Architecture

```
browser
  │  components/guardian/guardian-launcher.tsx   floating button, bottom-left
  │  components/guardian/guardian-panel.tsx      the conversation (lazy-loaded)
  │  lib/guardian/client.ts                      builds the request
  ▼
POST /api/guardian/chat                          app/api/guardian/chat/route.ts
  │  validate         lib/guardian/protocol.ts
  │  retrieve         lib/guardian/retrieval.ts  ← lib/guardian/knowledge.ts
  │  assemble rules   lib/guardian/system-prompt.ts
  │  tools            lib/guardian/tools.ts      ← the app's own logic modules
  ▼
lib/guardian/gemini.ts                           the ONLY file with the API key
  ▼
Google Gemini API
  ▼
lib/guardian/render.ts                           resolves citations, drops fakes
  ▼
browser
```

The browser never talks to Gemini. `lib/guardian/gemini.ts` starts with
`import 'server-only'`, so a client component that reaches it, even
transitively, fails the build instead of shipping the key.

## The four knowledge layers

Deliberately separate files, so no one has to edit a ten-thousand-token prompt
to change a fact.

| Layer | File | What belongs in it |
| --- | --- | --- |
| System rules | `lib/guardian/system-prompt.ts` | Who Guardian is, scope, refusals, safety, tone. **Rules only, no facts.** |
| Application knowledge | `lib/guardian/app-knowledge.ts` | The seven stages, what each screen does, which routes exist. Derived from `lib/journey.ts` and `lib/navigation.ts`, so it cannot drift. |
| Domain knowledge | `lib/guardian/knowledge.ts` | Credit, finance, quotation, insurance and rights content, each with a citation. Derived from `lib/rights.ts`, `lib/finance.ts`, `lib/insurance.ts` and `lib/quotation.ts`. |
| Live context | `lib/guardian/use-guardian-context.ts` and the tools | Where the user is, what they are looking at, their own recorded figures. |

### Adding knowledge

Add an entry to `CURATED` in `lib/guardian/knowledge.ts`:

```ts
{
  id: 'finance.deposit',            // the citation handle; must be unique
  topic: 'finance',
  title: 'How a deposit changes the deal',
  keywords: ['deposit', 'upfront', 'trade-in'],
  body: '...',                      // plain facts the app already stands behind
  citationLabel: 'National Credit Act, s90',
  href: '/finance',                 // optional, must be a real route
}
```

Rights entries need no work: they are generated from `RIGHTS_MODULES`, so
adding a module to the Rights screen teaches Guardian at the same time.

There is no vector database. The corpus is about a dozen entries and keyword
scoring over it is auditable, whereas an embedding service would add a
dependency and a failure mode to search a list you can read in one screen. The
interface is what matters: replace the body of `retrieve()` in
`lib/guardian/retrieval.ts` and nothing else in Guardian changes.

## Why citations cannot be faked

A model will happily write `Consumer Protection Act, s61(4)(b)` for a claim it
invented. So Guardian is never allowed to write a citation. It writes a marker:

```
Your rights last six months. [[cite:rights.cpa-used-car]]
```

`lib/guardian/render.ts` swaps each marker for a real entry from the knowledge
base and **deletes any id that does not exist**. A fabricated citation cannot
survive the round trip. Links work the same way: `[[link:/credit|Record your
score]]` is kept only if `/credit` is a route the app actually has, so an
invented deep link becomes nothing rather than a 404.

## Tools

The model does not answer car or money questions from memory. It calls
read-only functions that run the app's own logic:

| Tool | Returns | Backed by |
| --- | --- | --- |
| `findVehicle` | Used and new cars matching a name | `lib/fuzzy.ts`, `lib/rivals.ts` |
| `getCurrentContext` | The screen and the car or comparison on it | validated request context |
| `getCreditContext` | The recorded score, band and target rate | `lib/finance.ts` |
| `estimateMonthlyCost` | Instalment, running costs, affordability | `lib/finance.ts`, `lib/running-cost.ts` |
| `getRivals` | Competitors, opposites, derivatives | `lib/rivals.ts` |
| `getMarketContext` | Whether a listing is well priced | `lib/market-value.ts` |
| `getQuotationAnalysis` | The user's own quotation findings | `lib/quotation.ts` output |
| `getJourneyProgress` | Stages done and what is next | `lib/journey.ts` |
| `getInsuranceOptions` | Cover types and how premiums are modelled | `lib/insurance.ts` |

Because the instalment comes from `estimateInstalment()`, Guardian cannot quote
a number that disagrees with the screen behind it.

**Every tool is read-only.** None takes SQL, a URL, a file path or a shell
string, so there is nothing for a prompt injection to aim at. The model cannot
write a row, change a setting or send anything.

### The sensitive slice

The user's credit score and income are **not** in the prompt. They sit in the
tool closure and reach the model only if it calls `getCreditContext`. A
question about boot space therefore never carries someone's salary to Google.
`tests/guardian.test.ts` asserts this.

## Security

| Concern | How it is handled |
| --- | --- |
| Key exposure | Server-side only, `import 'server-only'`, never `NEXT_PUBLIC_`. Verified absent from `.next/static`. |
| Prompt injection from the client | A `role: "system"` in the body is downgraded to `guardian`. The system prompt is assembled from constants. |
| Injection via context | Client context lands in the prompt as a short factual block and as JSON tool results, never as instructions. |
| Invented authority | Citations resolve against the knowledge base; unknown ids are deleted. |
| Invented routes | Links are checked against `ALLOWED_HREFS`. |
| Score spoofing | `parseGuardianRequest` rejects scores outside 1-999; the rules forbid accepting a score asserted in conversation. |
| Error leakage | Provider errors are classified into a kind and discarded. The browser gets one of five sentences; the detail goes to the server log only. |
| Payload abuse | 1 500 characters per message, 20 turns, 3 compare ids, all enforced server-side. |
| XSS from model output | Rendered by splitting the string, never `dangerouslySetInnerHTML`. |
| Logging | The log records the page, turn count and tool names. Never the question, the answer or any figure. |

## Rate limiting

`lib/guardian/rate-limit.ts` is an in-process fixed-window counter: 12 requests
per caller per minute, 120 globally, both configurable.

**Know what this is not.** It does not survive a restart and does not
coordinate across instances, so on serverless the limit is per-instance. It
protects a free-tier key from a render loop, a stuck retry and one impatient
browser, which is most of the real risk today. Anything stronger needs shared
state (Upstash, Redis, or a small Supabase table).

Google's own quota is the tighter constraint. On the free tier
`gemini-3.5-flash` allows **5 requests a minute**, which is roughly one user at
a time; `gemini-3.5-flash-lite` is far more generous. When Google returns a
429 the route passes its own retry hint through to the user.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Google AI Studio key. **Blank disables the AI** (see below). |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Any current model. |
| `GUARDIAN_RATE_LIMIT` | `12` | Requests per caller per window. |
| `GUARDIAN_RATE_WINDOW_MS` | `60000` | Window length. |
| `GUARDIAN_GLOBAL_RATE_LIMIT` | `120` | Requests across all callers per window. |
| `GUARDIAN_TIMEOUT_MS` | `25000` | Budget for one exchange, tool round trips included. |
| `GUARDIAN_MAX_TOOL_ROUNDS` | `3` | Tool round trips before giving up. |

### Changing the model

Set `GEMINI_MODEL` and restart. No code change. Verify the name against
Google's current model list first: `gemini-2.5-flash` and every other 2.x name
are retired and now return 404 for new keys.

### Disabling Guardian

Leave `GEMINI_API_KEY` blank. The route returns 503 and the panel falls back to
the app's original deterministic rule engine (`lib/guardian.ts`), which still
cites real statute and still gives concrete steps. Each such answer is labelled
in the UI, so the user is never misled about which one replied. Guardian is
narrower without a key, not broken.

To remove it from the interface entirely, drop `<GuardianLauncher />` from
`components/app-frame.tsx`.

## Local setup

```bash
cp .env.example .env.local     # then paste your key into GEMINI_API_KEY
pnpm install
pnpm dev
```

Guardian appears bottom-left on every signed-in screen.

## Production

Set `GEMINI_API_KEY` and `GEMINI_MODEL` as server-side environment variables in
the host (Vercel: Project Settings, Environment Variables, **not** prefixed
with `NEXT_PUBLIC_`). The route is `runtime = 'nodejs'` and
`dynamic = 'force-dynamic'`: it needs the Node runtime for the SDK and must not
be cached, since every answer depends on the caller's own state.

Before real traffic, replace the in-process rate limiter with shared state.

## Testing

```bash
pnpm test                              # 242 unit tests, includes Guardian
node scripts/guardian-probe.mjs        # drives the live endpoint, needs pnpm dev
node scripts/guardian-probe.mjs adversarial
```

The probe covers in-scope, out-of-scope and adversarial prompts: prompt
extraction, key extraction, role override, score spoofing, approval prediction
and questions about cars the app does not hold. It is paced so it does not trip
Guardian's own rate limiter.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Guardian is not switched on in this environment" | `GEMINI_API_KEY` unset | Set it in `.env.local` and restart. |
| Every request 429s after a few questions | Google free-tier quota | Use `gemini-3.5-flash-lite`, or wait out the window. |
| Server log shows `kind=model_unavailable` | Retired or misspelled model | Check `GEMINI_MODEL` against Google's current list. |
| Server log shows `kind=auth` | Key invalid, revoked, or restricted | Reissue in AI Studio. |
| Answers arrive with no citations | Retrieval found nothing for the question | Add a knowledge entry; do not loosen the citation rule. |
| A link Guardian mentions does not appear | Route not in `ALLOWED_HREFS` | Add the real route, or leave it dropped. |
| Build fails with a `server-only` error | A client component imports `gemini.ts` | That is the guard working. Import through the API route instead. |

## Known limits

1. **Rate limiting is per-instance and in-memory.** Not a distributed control.
2. **Conversations are not persisted from the panel.** Session memory only, by
   choice: a conversation about someone's credit position is not something to
   store by default. The full `/chat` screen does keep history, in the existing
   local store.
3. **Guardian is only as good as the catalogue.** The used listings are a
   prototype sample, so its market judgements describe that sample and it says
   so.
4. **No reliability, service-cost or resale data exists in the app,** so
   Guardian refuses those questions rather than answering them from training
   data. That refusal is deliberate and should not be "fixed" by loosening the
   rules; it is fixed by sourcing the data.
