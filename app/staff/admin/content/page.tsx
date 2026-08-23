import { StaffShell } from '@/components/staff/staff-shell'
import { ContentView } from '@/components/staff/admin-views'

export default function Page() {
  return (
    <StaffShell requires="content.manage">
      <ContentView />
    </StaffShell>
  )
}
