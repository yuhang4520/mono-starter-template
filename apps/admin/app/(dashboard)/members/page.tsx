import { workspace } from '@your-project/workspace'
import { getDashboardContext } from '@/lib/session'
import { OrganizationRequired } from '@/components/organization-required'
import { MembersManager } from './members-manager'

export default async function MembersPage() {
  const { session, activeOrganization } = await getDashboardContext()
  if (!activeOrganization) return <OrganizationRequired />
  const members = await workspace.listMembers(session.user.id, activeOrganization.id)
  return (
    <MembersManager
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      members={members}
      currentRole={activeOrganization.role}
    />
  )
}
