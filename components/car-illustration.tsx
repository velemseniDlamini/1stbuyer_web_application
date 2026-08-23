import { cn } from '@/lib/utils'

/**
 * A friendly car, drawn rather than photographed.
 *
 * WHY AN ILLUSTRATION AND NOT A PHOTO
 *
 * A photograph of a specific car on a sign-in screen or an empty state implies
 * that car is on offer. This app is careful never to imply stock it does not
 * have, and an illustration is unmistakably decorative. It also weighs about
 * two kilobytes, works in both themes without a second asset, and never loads
 * late and shifts the layout.
 *
 * The shapes are rounded and the stance is upright on purpose: friendly and
 * approachable, not a low-slung sports car. Every colour is a theme token, so
 * it follows the warm cream and orange palette in light mode and the charcoal
 * one in dark without a second copy.
 */
export function CarIllustration({
  className,
  showRoad = true,
}: {
  className?: string
  /** The road underneath. Off for tight spaces like an empty state. */
  showRoad?: boolean
}) {
  return (
    <svg
      viewBox="0 0 200 108"
      className={cn('w-full', className)}
      role="img"
      aria-label="An illustration of a small car"
    >
      {showRoad && (
        <>
          <rect x="0" y="88" width="200" height="7" rx="3.5" fill="var(--color-muted)" />
          {/* Road markings, spaced like a real centre line. */}
          {[10, 46, 82, 118, 154].map((x) => (
            <rect
              key={x}
              x={x}
              y="90.6"
              width="18"
              height="1.8"
              rx="0.9"
              fill="var(--color-background)"
              opacity="0.85"
            />
          ))}
        </>
      )}

      {/* Body */}
      <path
        d="M18 64
           C18 54 20 50 30 49
           L58 48
           C64 30 74 25 96 25
           L120 25
           C138 25 148 32 158 44
           L178 47
           C186 48 188 54 188 62
           L188 70
           C188 74 185 76 181 76
           L25 76
           C21 76 18 74 18 70
           Z"
        fill="var(--color-primary)"
      />

      {/* Glasshouse. One shade darker than the body so it reads as glass
          without needing a second hue. */}
      <path
        d="M65 46 L68 34 C70 30 75 29 82 29 L96 29 L96 46 Z"
        fill="var(--color-foreground)"
        opacity="0.22"
      />
      <path
        d="M103 29 L118 29 C130 29 138 33 145 40 L150 46 L103 46 Z"
        fill="var(--color-foreground)"
        opacity="0.22"
      />

      {/* Lights: a warm one at the front, a red one at the back. */}
      <rect x="181" y="55" width="7" height="7" rx="3" fill="var(--color-background)" opacity="0.9" />
      <rect x="18" y="55" width="6" height="6" rx="3" fill="var(--color-destructive)" opacity="0.8" />

      {/* Door line and handle: two strokes that stop it reading as a blob. */}
      <path d="M99 30 L99 74" stroke="var(--color-foreground)" strokeWidth="1.4" opacity="0.18" />
      <rect x="88" y="53" width="9" height="2.6" rx="1.3" fill="var(--color-foreground)" opacity="0.28" />

      {/* Wheels */}
      {[58, 150].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="76" r="15" fill="var(--color-foreground)" opacity="0.88" />
          <circle cx={cx} cy="76" r="6.5" fill="var(--color-card)" />
          <circle cx={cx} cy="76" r="2.4" fill="var(--color-foreground)" opacity="0.5" />
        </g>
      ))}
    </svg>
  )
}

/**
 * The same car at badge size, for empty states.
 *
 * Detail that reads at 200px turns to mud at 48px, so this is a separate,
 * simpler silhouette rather than the illustration above scaled down.
 */
export function CarBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      className={cn('h-12 w-12', className)}
      role="img"
      aria-label="A small car"
    >
      <path
        d="M4 19
           C4 15 5 13 9 12.5
           L14 12
           C16.5 6 20 4 26 4
           L31 4
           C36 4 39 6 42 11
           L44 12.5
           C46 13 46.5 15 46.5 18
           L46.5 21
           C46.5 22.5 45.5 23 44 23
           L6 23
           C4.8 23 4 22.4 4 21
           Z"
        fill="currentColor"
      />
      <path
        d="M16 11.6 L17.5 7.8 C18.2 6.5 19.6 6 22 6 L24 6 L24 11.6 Z"
        fill="var(--color-card)"
        opacity="0.65"
      />
      <path
        d="M26 6 L30 6 C33.5 6 35.5 7.2 37.5 10 L38.5 11.6 L26 11.6 Z"
        fill="var(--color-card)"
        opacity="0.65"
      />
      <circle cx="14" cy="23" r="5" fill="currentColor" />
      <circle cx="36" cy="23" r="5" fill="currentColor" />
      <circle cx="14" cy="23" r="2" fill="var(--color-card)" />
      <circle cx="36" cy="23" r="2" fill="var(--color-card)" />
    </svg>
  )
}
