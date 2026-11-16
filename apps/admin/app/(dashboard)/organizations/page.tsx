import { getDashboardContext } from '@/lib/session'
import { OrganizationManager } from './organization-manager'

export default async function OrganizationsPage() {
  const { organizations, activeOrganization } = await getDashboardContext()
  return <OrganizationManager organizations={organizations} activeId={activeOrganization?.id} />
}
