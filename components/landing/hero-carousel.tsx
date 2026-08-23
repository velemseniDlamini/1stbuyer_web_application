'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { HERO_FADE_MS, HERO_IMAGES, HERO_INTERVAL_MS } from '@/lib/hero-images'
import { cn } from '@/lib/utils'

/**
 * Drives the hero rotation. One clock, shared by the photographs and the dots,
 * so the caption can never describe a different car from the one on screen.
 *
 * Returns -1 for `index` until rotation is allowed, which lets the caller
 * render the first frame without committing to a transition.
 *
 * REDUCED MOTION
 *
 * A carousel that changes every two seconds is a real problem for anyone with
 * vestibular sensitivity, and WCAG 2.2.2 asks for a way out of anything that
 * auto-updates. With `prefers-reduced-motion: reduce` the rotation never
 * starts: the first photograph is shown as a still.
 */
export function useHeroRotation(total: number) {
  const [index, setIndex] = useState(0)
  const [motionAllowed, setMotionAllowed] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setMotionAllowed(!query.matches)
    apply()
    // Honour a change made while the page is open, rather than only at load.
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!motionAllowed || total < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % total), HERO_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [motionAllowed, total])

  return { index, motionAllowed }
}

/**
 * The stack of photographs.
 *
 * All of them are mounted and crossfaded with opacity rather than swapped in
 * and out of the DOM. Swapping would make the browser decode an image every
 * two seconds and flash blank on a slow line; layering means each is decoded
 * once and every later transition is a compositor job.
 *
 * The first three load eagerly. An earlier version lazy-loaded everything but
 * the first, and on a cold cache the rotation simply outran the downloads: the
 * index reached the tenth image while nine of them were still `complete:
 * false`, so the hero sat on a single frame. Eager on the leaders and lazy on
 * the tail keeps the opening seconds honest without fetching all twelve up
 * front.
 */
export function HeroStack({
  index,
  className,
  sizes,
  priorityCount = 3,
}: {
  index: number
  className?: string
  sizes: string
  priorityCount?: number
}) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)} aria-hidden>
      {HERO_IMAGES.map((image, i) => (
        <Image
          key={image.src}
          src={image.src}
          alt=""
          fill
          sizes={sizes}
          priority={i === 0}
          loading={i < priorityCount ? 'eager' : 'lazy'}
          className={cn(
            'object-cover transition-opacity ease-in-out motion-reduce:transition-none',
            i === index ? 'opacity-100' : 'opacity-0',
          )}
          style={{ transitionDuration: `${HERO_FADE_MS}ms` }}
        />
      ))}
    </div>
  )
}

/** The progress dots. Decorative: the rotation is not a control. */
export function HeroDots({ index, total }: { index: number; total: number }) {
  return (
    <ul className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <li
          key={i}
          className={cn(
            'h-1 rounded-full transition-all duration-500',
            i === index ? 'w-5 bg-current' : 'w-1 bg-current opacity-40',
          )}
        />
      ))}
    </ul>
  )
}

/**
 * Preloads the image after the current one.
 *
 * Without this the crossfade into a lazy image starts before it has bytes, and
 * the user watches the hero fade to nothing for a moment. One frame of
 * lookahead is enough at a two second interval and costs one request.
 */
export function useHeroPreload(index: number) {
  const seen = useRef(new Set<number>())

  useEffect(() => {
    const next = (index + 1) % HERO_IMAGES.length
    if (seen.current.has(next)) return
    seen.current.add(next)
    const img = new window.Image()
    img.src = HERO_IMAGES[next].src
  }, [index])
}

/**
 * Tracks the `wide` breakpoint from JavaScript.
 *
 * The hero needs this rather than CSS alone: the phone layout and the desktop
 * layout put the photographs in different places in the DOM, and hiding one
 * with `hidden` still mounts its images and still downloads them. Rendering
 * only the stack that is actually visible halves the requests.
 *
 * Returns null until mounted so the server and the first client render agree,
 * which keeps this out of the hydration diff.
 */
export function useIsWide(): boolean | null {
  const [wide, setWide] = useState<boolean | null>(null)

  useEffect(() => {
    // Same query as the `wide` Tailwind variant in globals.css.
    const query = window.matchMedia('(min-width: 48rem) and (min-height: 37.5rem)')
    const apply = () => setWide(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return wide
}
