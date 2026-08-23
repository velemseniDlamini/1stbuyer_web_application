import { Suspense } from 'react'
import { StaffShell } from '@/components/staff/staff-shell'
import { TicketQueue } from '@/components/staff/ticket-queue'

export default function Page() {
  return (
    <StaffShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the queue…</p>}>
        <TicketQueue />
      </Suspense>
    </StaffShell>
  )
}
