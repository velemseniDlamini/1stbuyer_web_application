'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  Car,
  FileSearch,
  Gauge,
  Scale,
  ShieldCheck,
  Sparkles,
  Umbrella,
} from 'lucide-react'
import { HeroDots, HeroStack, useHeroPreload, useHeroRotation, useIsWide } from './hero-carousel'
import { HERO_IMAGES } from '@/lib/hero-images'
import { JOURNEY_STAGES } from '@/lib/journey'
import { NEW_CARS } from '@/lib/new-cars-source'
import { RIGHTS_MODULES } from '@/lib/rights'
import { PRIME_RATE } from '@/lib/finance'
import { StaffGate } from '@/components/staff/staff-gate'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * The public landing page.
 *
 * WHAT IS DELIBERATELY ABSENT
 *
 * No testimonials, no "trusted by 10,000 buyers", no five-star rating, no
 * counter of happy customers. Not one of those could be substantiated, and an
 * app that exists to stop dealerships overstating things cannot open with
 * invented social proof. Every number below is either a count of something in
 * this repository or a rate with a date on it.
 */
export function LandingPage() {
  const { systemSettings } = useStore()

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <TrustStrip />
        <Journey />
        <Tools />
        <GuardianTeaser />
        <ClosingCta />
      </main>
      <SiteFooter triggerText={systemSettings.triggerText} />
    </div>
  )
}

/* -------------------------------------------------------------- header --- */

function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'safe-x fixed inset-x-0 top-0 z-40 transition-colors duration-300',
        // Transparent over the hero, solid once the page scrolls under it.
        scrolled ? 'border-b border-border bg-background/90 backdrop-blur' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl font-display text-lg font-bold transition-colors',
              scrolled ? 'bg-primary text-primary-foreground' : 'bg-background/95 text-foreground',
            )}
          >
            1
          </span>
          <span
            className={cn(
              'font-display text-lg font-semibold tracking-tight transition-colors',
              scrolled ? 'text-foreground' : 'text-background',
            )}
          >
            1<span className="text-primary">st</span> Buyer
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(
              'hidden min-h-10 items-center rounded-full px-4 text-sm font-semibold transition sm:flex',
              scrolled ? 'text-foreground hover:bg-muted' : 'text-background hover:bg-background/10',
            )}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ---------------------------------------------------------------- hero --- */

function Hero() {
  const { index } = useHeroRotation(HERO_IMAGES.length)
  useHeroPreload(index)
  const current = HERO_IMAGES[index]
  // Only one of the two stacks is ever mounted: see useIsWide.
  const wide = useIsWide()

  return (
    <section className="relative isolate overflow-hidden bg-foreground">
      {/* PHONE AND TABLET: the photograph is the background.
          At these widths the ~600px source is at or above the CSS width, so it
          stays sharp behind the overlay. */}
      <div className="absolute inset-0 wide:hidden">
        {wide === false && <HeroStack index={index} sizes="100vw" />}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/75 to-foreground/30" />
      </div>

      <div className="safe-x relative mx-auto w-full max-w-6xl px-4 pb-14 pt-28 sm:px-6 wide:grid wide:grid-cols-[1.05fr_1fr] wide:items-center wide:gap-12 wide:py-28">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-background/25 bg-background/10 px-3 py-1.5 text-xs font-semibold text-background backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Built for South African first-time buyers
          </p>

          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] text-background text-balance sm:text-5xl wide:text-6xl">
            Walk into the dealership knowing more than they expect.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-background/85 text-pretty sm:text-lg">
            The finance desk already knows your rate band, what the car is worth and which fees you
            will not question. 1st Buyer puts the same information in your pocket, before you sign.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90 active:scale-[0.98]"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="flex min-h-12 items-center justify-center rounded-full border border-background/30 bg-background/10 px-6 text-sm font-semibold text-background backdrop-blur transition hover:bg-background/20"
            >
              Explore the cars
            </Link>
          </div>

          <div className="mt-10 flex items-center gap-4 text-background">
            <HeroDots index={index} total={HERO_IMAGES.length} />
            <p className="text-xs opacity-60">
              Photography for illustration. Not listings, and not for sale here.
            </p>
          </div>
        </div>

        {/* DESKTOP: the photograph gets its own framed panel instead of being
            stretched across the viewport. The sources are about 600px wide, so
            a full-bleed backdrop on a 1440px screen would upscale them nearly
            three times and look soft. In a ~560px panel they render close to
            native and stay crisp. */}
        <div className="relative hidden wide:block">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-background/15 shadow-2xl bg-foreground">
            {wide && <HeroStack index={index} sizes="(min-width: 1280px) 560px, 50vw" />}
          </div>
          {/* The caption names the car on screen, so a reader is never left
              guessing what they are looking at. */}
          <p className="mt-3 text-center text-xs text-background/60">{current.alt}</p>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------- trust figures -- */

function TrustStrip() {
  // Every figure here is counted from this repository at build time, so none of
  // them can drift into a marketing claim nobody re-checks.
  const facts = [
    { value: String(JOURNEY_STAGES.length), label: 'stages, from credit score to keys' },
    { value: String(NEW_CARS.length), label: 'new cars priced from published sources' },
    { value: String(RIGHTS_MODULES.length), label: 'consumer-rights modules, each citing the Act' },
    { value: `${PRIME_RATE}%`, label: 'prime rate every estimate is built on' },
  ]

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label}>
            <p className="font-display text-3xl font-semibold text-primary sm:text-4xl">
              {fact.value}
            </p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground text-pretty">
              {fact.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- journey --- */

const STAGE_ICONS = [Gauge, Scale, Car, Calculator, Car, FileSearch, Umbrella]

function Journey() {
  return (
    <Section
      eyebrow="The journey"
      title="Seven stages, in the order that actually protects you"
      blurb="Each one unlocks the next. You record your credit score before anyone quotes you a rate, and you read the quotation before you sign it, not after."
    >
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {JOURNEY_STAGES.map((stage, i) => {
          const Icon = STAGE_ICONS[i] ?? Car
          return (
            <li
              key={stage.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-md"
            >
              <span className="absolute right-4 top-3 font-display text-5xl font-semibold text-muted/60 transition group-hover:text-primary/15">
                {stage.index}
              </span>
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="relative mt-3 font-display text-base font-semibold">{stage.title}</h3>
              <p className="relative mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                {stage.blurb}
              </p>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

/* --------------------------------------------------------------- tools --- */

const TOOLS = [
  {
    icon: Gauge,
    title: 'Know your rate band',
    body: 'Record your bureau score and see the margin over prime you should be quoted, so a dealer cannot mark you up quietly.',
  },
  {
    icon: Calculator,
    title: 'Model the real cost',
    body: 'Instalment, interest, total repayment and balloon exposure. It refuses to guess an instalment until you have recorded a real score.',
  },
  {
    icon: Car,
    title: 'Compare cars honestly',
    body: 'Two or three side by side on price, running costs and specifications, with rivals and opposites computed from published figures.',
  },
  {
    icon: FileSearch,
    title: 'Read the quotation',
    body: 'Every line of a dealer quote against reference benchmarks, with the questions worth asking, in writing, before you sign.',
  },
  {
    icon: Scale,
    title: 'Know the law',
    body: 'What the Consumer Protection Act and National Credit Act actually give you, each module citing the section it comes from.',
  },
  {
    icon: Umbrella,
    title: 'Compare cover',
    body: 'Indicative premiums across insurers and cover types, clearly labelled as modelling rather than a quote.',
  },
]

function Tools() {
  return (
    <Section
      eyebrow="What you get"
      title="Every tool the other side of the desk already has"
      blurb="Nothing here is a lead-generation form. 1st Buyer sells nothing, takes no commission and has no dealer-paid placement."
      tone="muted"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <article
            key={tool.title}
            className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <tool.icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-3 font-display text-base font-semibold">{tool.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
              {tool.body}
            </p>
          </article>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------ guardian --- */

function GuardianTeaser() {
  return (
    <Section eyebrow="Guardian" title="An assistant that will tell you when it does not know">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div>
          <p className="text-base leading-relaxed text-muted-foreground text-pretty">
            Ask about a balloon payment, a fee on your quote, or what your score means. Guardian
            answers from what this app can actually source, cites the law it is relying on, and says
            plainly when a figure is not held rather than inventing one.
          </p>
          <ul className="mt-5 space-y-2.5">
            {[
              'Refuses to estimate an instalment without your real credit score',
              'Cites the Act, and cannot invent a section number',
              'Says "this app has no sourced data for that" instead of guessing',
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-pretty">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* A worked example, not a screenshot: it stays true if the styling
            changes and it cannot go stale against a redesign. */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-semibold">Guardian</p>
              <p className="text-[11px] text-muted-foreground">Your car-buying assistant</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
              Which is more reliable, the Swift or the Starlet?
            </p>
            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-border bg-background px-3.5 py-2.5">
              <p className="text-sm leading-relaxed text-pretty">
                This app holds no sourced South African reliability data, so ranking them would be
                guessing. I can compare what it does hold: price, engine, claimed consumption and
                running costs.
              </p>
              <p className="mt-2 border-t border-border pt-2 text-[11px] font-medium text-primary">
                1st Buyer catalogue provenance
              </p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------- close --- */

function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden border-t border-border">
      <Image
        src="/hero/sedan-bmw-3-series.webp"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        aria-hidden
      />
      <div className="absolute inset-0 bg-foreground/80" />
      <div className="safe-x relative mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-display text-3xl font-semibold text-background text-balance sm:text-4xl">
          Your first car should not cost you twice.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-background/80 text-pretty">
          Free to use. No commission, no dealer-paid placement, and no figure it cannot show you the
          source for.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90 active:scale-[0.98]"
        >
          Create your free account
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- footer --- */

function SiteFooter({ triggerText }: { triggerText: string }) {
  return (
    <footer className="safe-x border-t border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <span className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-base font-bold text-primary-foreground">
                1
              </span>
              <span className="font-display text-base font-semibold">
                1<span className="text-primary">st</span> Buyer
              </span>
            </span>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground text-pretty">
              Independent, and aligned to the buyer alone. 1st Buyer is not a dealer, a lender, a
              credit bureau or an insurer, and earns no commission on anything you buy.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 text-sm">
            {[
              { href: '/login', label: 'Sign in' },
              { href: '/login', label: 'Create account' },
              { href: '/rights', label: 'Know your rights' },
              { href: '/support', label: 'Help' },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="flex min-h-11 items-center text-muted-foreground transition hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-8 border-t border-border pt-5 text-xs text-muted-foreground text-pretty">
          Educational information, not financial or legal advice. Estimates are modelling, not
          offers: only a lender or insurer can quote you. Vehicle photography is for illustration
          and does not represent stock.
        </p>

        {/* The staff entrance. Fine print that looks like fine print. */}
        <StaffGate triggerText={triggerText} />
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------ scaffold --- */

function Section({
  eyebrow,
  title,
  blurb,
  children,
  tone = 'default',
}: {
  eyebrow: string
  title: string
  blurb?: string
  children: React.ReactNode
  tone?: 'default' | 'muted'
}) {
  return (
    <section className={cn('safe-x border-b border-border', tone === 'muted' && 'bg-muted/40')}>
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold text-balance sm:text-3xl">
          {title}
        </h2>
        {blurb && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
            {blurb}
          </p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )
}
