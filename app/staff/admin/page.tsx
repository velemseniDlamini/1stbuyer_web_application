import { StaffShell } from '@/components/staff/staff-shell'
import { AdminOverview } from '@/components/staff/admin-views'

export default function Page() {
  return (
    <StaffShell requires="staff.manage">
      <AdminOverview />
    </StaffShell>
  )
}
