// The photographs behind the landing hero.
//
// A NOTE ON WHAT THESE ARE, AND ARE NOT
//
// These are atmosphere. They are NOT listings, and nothing on the landing page
// implies any of these cars is for sale here or that this app can finance one.
// That distinction matters in a product whose whole promise is that it does not
// overstate what it holds: a hero shot of an R8 next to the words "get approved"
// would be exactly the kind of thing this app exists to protect people from.
//
// The order is deliberate. It opens on cars a first-time buyer in South Africa
// might realistically be shopping for, and the aspirational ones sit later in
// the loop as scenery rather than as the promise.

export type HeroImage = {
  src: string
  /** Described for a screen reader, and honest about being scenery. */
  alt: string
}

export const HERO_IMAGES: HeroImage[] = [
  { src: '/hero/hatch-suzuki-swift.webp', alt: 'A silver Suzuki Swift hatchback parked on a tree-lined street' },
  { src: '/hero/bakkie-toyota-hilux.webp', alt: 'A black Toyota Hilux double cab on rocky ground below mountains' },
  { src: '/hero/hatch-renault-kwid.webp', alt: 'A white Renault Kwid hatchback on a suburban road' },
  { src: '/hero/sedan-toyota-corolla.webp', alt: 'A white Toyota Corolla sedan parked outside a house' },
  { src: '/hero/suv-lexus-nx.webp', alt: 'A white Lexus NX crossover on a mountain pass' },
  { src: '/hero/hatch-tata-tiago.webp', alt: 'A silver Tata Tiago hatchback on a rooftop with a city skyline behind' },
  { src: '/hero/sedan-bmw-3-series.webp', alt: 'A grey BMW 3 Series sedan at sunset beside the sea' },
  { src: '/hero/hatch-hyundai-grand-i10.webp', alt: 'A white Hyundai Grand i10 hatchback outside a cafe' },
  { src: '/hero/coupe-bmw-m4.webp', alt: 'A matte black BMW M4 coupe in front of mountains' },
  { src: '/hero/van-toyota-hiace.webp', alt: 'A white Toyota HiAce minibus outside a glass building' },
  { src: '/hero/coupe-audi-r8.webp', alt: 'A blue Audi R8 on a rooftop with a city skyline at sunset' },
  { src: '/hero/bakkie-kia-k2500.webp', alt: 'A white Kia K2500 flatbed truck at a depot' },
]

/** How long each photograph holds before the crossfade. */
export const HERO_INTERVAL_MS = 2000

/** The crossfade itself. Kept well inside the hold so images never double-blur. */
export const HERO_FADE_MS = 900
