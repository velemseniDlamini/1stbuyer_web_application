// Single source of truth for in-app navigation.
//
// The bottom bar (mobile) and the sidebar (desktop) both read these lists, so a
// screen can never be reachable on one form factor and orphaned on the other.

import {
  Compass,
  FileSearch,
  Calculator,
  Gauge,
  Home,
  LifeBuoy,
  Map,
  Scale,
  Umbrella,
  User,
} from 'lucide-react'

export type NavLink = {
  href: string
  label: string
  icon: typeof Home
}

/** The five destinations in the mobile bottom bar (Guardian is the raised centre button). */
export const PRIMARY_TABS: NavLink[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/journey', label: 'Journey', icon: Map },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/profile', label: 'Profile', icon: User },
]

/** Drill-in tools. On mobile these are reached from dashboard tiles. */
export const TOOL_LINKS: NavLink[] = [
  { href: '/credit', label: 'Credit', icon: Gauge },
  { href: '/finance', label: 'Finance', icon: Calculator },
  { href: '/compare', label: 'Compare cars', icon: Scale },
  { href: '/documents', label: 'Documents', icon: FileSearch },
  { href: '/insurance', label: 'Insurance', icon: Umbrella },
  { href: '/support', label: 'Help and tickets', icon: LifeBuoy },
]
