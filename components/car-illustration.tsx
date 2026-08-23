import { cn } from '@/lib/utils'

/**
 * The hero scene: a car on a road, under a low sun, with the horizon behind it.
 *
 * WHY AN ILLUSTRATION AND NOT A PHOTOGRAPH
 *
 * A photograph of a specific car on a sign-in screen implies that car is on
 * offer. This app is careful never to imply stock it does not have, and a
 * drawing is unmistakably decorative. It is also about three kilobytes, needs
 * no second asset for dark mode, and cannot load late and shift the layout.
 *
 * WHAT MAKES IT A HERO RATHER THAN AN ICON
 *
 * The first version was a lone car floating on flat beige, which read as a
 * placeholder. This is a composed scene: a horizon band, a sun, a road that
 * runs the full width with lane markings and a verge, hills behind, and the
 * car sitting on the surface with a contact shadow. The composition is what
 * makes it look intentional.
 *
 * Every colour is a theme token, so the warm cream palette in light mode and
 * the charcoal one in dark both work from a single drawing.
 */
export function CarIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 180"
      className={cn('w-full', className)}
      role="img"
      aria-label="An illustration of a car on an open road at sunrise"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-background)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.25" />
        </linearGradient>
        <clipPath id="skyClip">
          <rect x="0" y="0" width="320" height="126" rx="18" />
        </clipPath>
      </defs>

      {/* Sky, clipped so the scene sits in a soft rounded frame rather than a
          hard rectangle. */}
      <g clipPath="url(#skyClip)">
        <rect x="0" y="0" width="320" height="126" fill="url(#sky)" />
        <circle cx="160" cy="116" r="46" fill="url(#sun)" />

        {/* Hills, two layers for depth. */}
        <path
          d="M0 126 L0 100 C34 82 62 96 92 92 C126 87 148 70 186 78 C224 86 252 74 288 84 L320 92 L320 126 Z"
          fill="var(--color-primary)"
          opacity="0.18"
        />
        <path
          d="M0 126 L0 112 C40 100 74 110 112 106 C150 102 176 92 216 98 C252 103 286 96 320 104 L320 126 Z"
          fill="var(--color-primary)"
          opacity="0.28"
        />
      </g>

      {/* Verge, then the road itself running the full width. */}
      <rect x="0" y="122" width="320" height="8" rx="4" fill="var(--color-primary)" opacity="0.25" />
      <rect x="0" y="128" width="320" height="34" rx="6" fill="var(--color-road)" />
      <rect x="0" y="128" width="320" height="2" fill="var(--color-road-edge)" />
      <rect x="0" y="160" width="320" height="2" fill="var(--color-road-edge)" />

      {/* Lane markings, in perspective: longer and further apart toward the
          viewer, which is what stops them reading as a dashed border. */}
      {[
        { x: 8, w: 26 },
        { x: 52, w: 30 },
        { x: 102, w: 34 },
        { x: 160, w: 38 },
        { x: 224, w: 42 },
        { x: 292, w: 28 },
      ].map((dash) => (
        <rect
          key={dash.x}
          x={dash.x}
          y="143.6"
          width={dash.w}
          height="3.4"
          rx="1.7"
          fill="var(--color-road-line)"
          opacity="0.9"
        />
      ))}

      {/* Contact shadow, so the car sits on the road rather than over it. */}
      <ellipse cx="160" cy="138" rx="76" ry="7" fill="var(--color-road)" opacity="0.55" />

      {/* Car, three-quarter side view, wheels on the surface. */}
      <g transform="translate(78 62)">
        {/* Body */}
        <path
          d="M4 56
             C4 44 6 38 18 36
             L38 33
             C48 14 60 6 84 6
             L110 6
             C132 6 146 13 158 30
             L172 35
             C182 37 186 44 186 54
             L186 66
             C186 71 182 74 177 74
             L13 74
             C8 74 4 71 4 66
             Z"
          fill="var(--color-primary)"
        />
        {/* A darker sill along the bottom gives the body some form. */}
        <path
          d="M6 64 L184 64 L184 68 C184 72 181 74 177 74 L13 74 C9 74 6 72 6 68 Z"
          fill="var(--color-foreground)"
          opacity="0.16"
        />

        {/* Glass */}
        <path
          d="M44 32 L52 18 C56 12 62 10 72 10 L88 10 L88 32 Z"
          fill="var(--color-foreground)"
          opacity="0.24"
        />
        <path
          d="M96 10 L110 10 C126 10 136 15 145 27 L149 32 L96 32 Z"
          fill="var(--color-foreground)"
          opacity="0.24"
        />

        {/* Lights */}
        <rect x="176" y="44" width="11" height="9" rx="4.5" fill="var(--color-background)" opacity="0.95" />
        <rect x="4" y="44" width="9" height="8" rx="4" fill="var(--color-destructive)" opacity="0.85" />

        {/* Door cut and handle */}
        <path d="M91 12 L91 64" stroke="var(--color-foreground)" strokeWidth="1.6" opacity="0.16" />
        <rect x="76" y="43" width="12" height="3.4" rx="1.7" fill="var(--color-foreground)" opacity="0.3" />

        {/* Wheels, with arches so they look set into the body. */}
        {[46, 146].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="72" r="20" fill="var(--color-foreground)" opacity="0.9" />
            <circle cx={cx} cy="72" r="9" fill="var(--color-card)" />
            <circle cx={cx} cy="72" r="3.4" fill="var(--color-foreground)" opacity="0.45" />
          </g>
        ))}
      </g>
    </svg>
  )
}

/**
 * The same car at badge size, for empty states.
 *
 * Detail that reads at 300px turns to mud at 48px, so this is a separate,
 * simpler silhouette rather than the scene above scaled down. It inherits
 * `currentColor` so a caller can tint it to match its surroundings.
 */
export function CarBadge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 40"
      className={cn('h-14 w-14', className)}
      role="img"
      aria-label="A small car"
    >
      {/* A short piece of road, so even the badge is not floating. */}
      <rect x="2" y="32" width="60" height="4" rx="2" fill="currentColor" opacity="0.18" />
      <rect x="10" y="33.4" width="10" height="1.4" rx="0.7" fill="currentColor" opacity="0.45" />
      <rect x="27" y="33.4" width="10" height="1.4" rx="0.7" fill="currentColor" opacity="0.45" />
      <rect x="44" y="33.4" width="10" height="1.4" rx="0.7" fill="currentColor" opacity="0.45" />

      <path
        d="M6 22
           C6 18 7 16 11 15.4
           L17 14.6
           C19.6 8 23.4 5.6 30 5.6
           L37 5.6
           C43 5.6 46.6 7.6 50 13
           L54 14.6
           C57 15.2 58 17 58 20
           L58 25
           C58 26.6 57 27.4 55.4 27.4
           L8.6 27.4
           C7 27.4 6 26.6 6 25
           Z"
        fill="currentColor"
      />
      <path
        d="M19.5 14.2 L21.4 9.8 C22.4 7.8 24 7.2 27 7.2 L29.5 7.2 L29.5 14.2 Z"
        fill="var(--color-card)"
        opacity="0.6"
      />
      <path
        d="M32 7.2 L36.6 7.2 C41 7.2 43.4 8.6 45.8 12 L47.2 14.2 L32 14.2 Z"
        fill="var(--color-card)"
        opacity="0.6"
      />
      <circle cx="18" cy="27.4" r="5.6" fill="currentColor" />
      <circle cx="46" cy="27.4" r="5.6" fill="currentColor" />
      <circle cx="18" cy="27.4" r="2.2" fill="var(--color-card)" />
      <circle cx="46" cy="27.4" r="2.2" fill="var(--color-card)" />
    </svg>
  )
}
