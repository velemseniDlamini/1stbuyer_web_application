import { StaffShell } from '@/components/staff/staff-shell'
import { SettingsView } from '@/components/staff/admin-views'

export default function Page() {
  return (
    <StaffShell requires="settings.manage">
      <SettingsView />
    </StaffShell>
  )
}
