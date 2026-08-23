'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_TABS, TOOL_LINKS } from '@/lib/navigation'
import { BrandMark } from './screen-header'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Desktop navigation. Hidden below md, where the bottom bar owns navigation.
 *
 * A desktop viewport has room to expose the four tools that are otherwise
 * reachable only by drilling in from the dashboard, so the sidebar lists them
 * directly. Both surfaces read the same link definitions from lib/navigation,
 * so a route can never appear in one and not the other.
 */
export function SideNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card/40 wide:flex wide:flex-col">
      <div className="px-5 py-5">
        <BrandMark />
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-6">
        <ul className="space-y-1">
          {PRIMARY_TABS.map((tab) => (
            <NavRow key={tab.href} {...tab} active={pathname === tab.href} />
          ))}
        </ul>

        <p className="px-3 pb-2 pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tools
        </p>
        <ul className="space-y-1">
          {TOOL_LINKS.map((tool) => (
            <NavRow key={tool.href} {...tool} active={pathname === tool.href} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/chat"
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90',
            pathname === '/chat' && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
          )}
        >
          <Shield className="h-4 w-4" aria-hidden />
          Ask Chatbot
        </Link>
      </div>
    </aside>
  )
}

function NavRow({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Shield
  active: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
          active
            ? 'bg-secondary text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </Link>
    </li>
  )
}
