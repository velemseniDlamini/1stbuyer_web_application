import { StaffShell } from '@/components/staff/staff-shell'
import { LookupView } from '@/components/staff/admin-views'

export default function Page() {
  return (
    <StaffShell requires="user.lookup.masked">
      <LookupView />
    </StaffShell>
  )
}
