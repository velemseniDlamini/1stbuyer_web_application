import { StaffShell } from '@/components/staff/staff-shell'
import { AuditView } from '@/components/staff/admin-views'

export default function Page() {
  return (
    <StaffShell>
      <AuditView />
    </StaffShell>
  )
}
