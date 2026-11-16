import { workspace } from '@your-project/workspace'
import { getDashboardContext } from '@/lib/session'
import { OrganizationRequired } from '@/components/organization-required'
import { NotesPanel } from './notes-panel'

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { session, activeOrganization } = await getDashboardContext()
  if (!activeOrganization) return <OrganizationRequired />
  const requestedPage = Number((await searchParams).page ?? 1)
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 5001) : 1
  const pageSize = 20
  const { items, total } = await workspace.listNotes(session.user.id, {
    organizationId: activeOrganization.id,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  })
  return (
    <NotesPanel
      key={activeOrganization.id}
      organizationId={activeOrganization.id}
      notes={items}
      total={total}
      page={page}
      pageSize={pageSize}
      canWrite={activeOrganization.role === 'owner' || activeOrganization.role === 'admin'}
    />
  )
}
