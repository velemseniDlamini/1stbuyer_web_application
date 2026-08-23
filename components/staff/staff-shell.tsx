'use client'

import { useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { buildAuditEntry } from '@/lib/staff'
import { can, isStaff, type Capability } from '@/lib/support'
import {
  Cog,
  FileText,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  ScrollText,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * DESKTOP-NATIVE LAYOUT, and the only one in the product.
 *
 * The consumer app is mobile-first with a responsive desktop shell. The staff
 * portal is the opposite: a workflow tool built for a desk, with a persistent
 * sidebar and a wide content area, because ticket queues and audit tables are
 * dense tabular data that a narrow column cannot serve. It inherits the design
 * tokens (same canvas, same gold accent, same Inter) so it still looks like the
 * same product, but its information density is deliberately different.
 *
 * ACCESS. The gate below is a client-side role check against local state, which
 * is a routing convenience, not a security control. Anyone who can open the
 * browser console can set the role. Real enforcement is the RLS policy set in
 * supabase/migrations, which requires the backend this build does not have.
 * A uniform redirect to /login is used for every rejection so the portal's
 * routes cannot be probed by comparing 404s to 403s.
 */
const NAV: { href: string; label: string; icon: typeof Gauge; capability?: Capability }[] = [
  { href: '/staff/support', label: 'Ticket queue', icon: LifeBuoy },
  { href: '/staff/lookup', label: 'User lookup', icon: Users, capability: 'user.lookup.masked' },
  { href: '/staff/audit', label: 'Audit log', icon: ScrollText },
  { href: '/staff/admin', label: 'Admin overview', icon: LayoutDashboard, capability: 'staff.manage' },
  { href: '/staff/admin/staff', label: 'Staff accounts', icon: Users, capability: 'staff.manage' },
  { href: '/staff/admin/settings', label: 'System settings', icon: Cog, capability: 'settings.manage' },
  { href: '/staff/admin/content', label: 'Content and rules', icon: FileText, capability: 'content.manage' },
]

export function StaffShell({
  children,
  requires,
}: {
  children: ReactNode
  /** Capability the route needs. Missing it redirects, it does not 404. */
  requires?: Capability
}) {
  const store = useStore()
  const { ready, staffSession } = store
  const router = useRouter()
  const pathname = usePathname()

  const role = staffSession?.role
  const allowed = isStaff(role) && (!requires || can(role, requires))

  useEffect(() => {
    if (!ready) return
    if (!staffSession) {
      router.replace('/login')
      return
    }
    if (requires && !can(staffSession.role, requires)) {
      // Support hitting an admin route lands on their own dashboard rather
      // than a 404 that would confirm the route exists.
      router.replace('/staff/support?denied=1')
    }
  }, [ready, staffSession, requires, router])

  // Any activity extends the session; inactivity expires it in the store.
  useEffect(() => {
    if (staffSession) store.touchStaffSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!ready || !allowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    )
  }

  const visibleNav = NAV.filter((item) => !item.capability || can(staffSession!.role, item.capability))

  function signOut() {
    if (staffSession) {
      store.audit(buildAuditEntry({ session: staffSession, action: 'staff.sign_out' }))
    }
    store.staffSignOut()
    router.replace('/login')
  }

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border px-5 py-4">
          <p className="font-display text-lg font-semibold">1st Buyer</p>
          <p className="text-xs text-muted-foreground">Staff portal</p>
        </div>

        <nav aria-label="Staff" className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
                pathname === item.href
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            {staffSession!.name}
            <span className="block font-semibold uppercase tracking-wide text-primary">
              {staffSession!.role === 'super_admin' ? 'Super admin' : 'Support'}
            </span>
          </p>
          <button
            onClick={signOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-destructive"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Compact nav for narrow screens: the portal is desk-first but must
            not become unusable on a laptop in a coffee shop. */}
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold',
                pathname === item.href ? 'bg-secondary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </Link>
          ))}
          <button onClick={signOut} className="min-h-11 shrink-0 px-3 text-xs font-semibold text-destructive">
            Sign out
          </button>
        </div>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

export function StaffPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
