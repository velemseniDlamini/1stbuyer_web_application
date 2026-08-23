import { StaffShell } from '@/components/staff/staff-shell'
import { StaffAccountsView } from '@/components/staff/admin-views'

export default function Page() {
  return (
    <StaffShell requires="staff.manage">
      <StaffAccountsView />
    </StaffShell>
  )
}
