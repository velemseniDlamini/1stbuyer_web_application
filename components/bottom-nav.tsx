'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Home } from 'lucide-react'
import { PRIMARY_TABS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="relative z-20 border-t border-border bg-card wide:hidden"
    >
      {/* Raised Guardian action */}
      <div className="pointer-events-none absolute inset-x-0 -top-7 flex justify-center">
        <Link
          href="/chat"
          aria-label="Ask Chatbot"
          className={cn(
            'pointer-events-auto flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg transition active:scale-95',
            pathname === '/chat' && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
          )}
        >
          <Bot className="h-6 w-6" aria-hidden />
        </Link>
      </div>

      <ul className="grid grid-cols-5 items-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {PRIMARY_TABS.slice(0, 2).map((t) => (
          <NavItem key={t.href} {...t} active={pathname === t.href} />
        ))}
        <li aria-hidden className="flex justify-center">
          <span className="mt-6 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Chatbot
          </span>
        </li>
        {PRIMARY_TABS.slice(2).map((t) => (
          <NavItem key={t.href} {...t} active={pathname === t.href} />
        ))}
      </ul>
    </nav>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Home
  active: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="h-5 w-5" aria-hidden />
        {label}
      </Link>
    </li>
  )
}
