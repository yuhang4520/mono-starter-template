import { notFound } from 'next/navigation'
import { requireRequestSession } from '@/lib/session'
import { platformUsers } from '@/lib/platform-users'
import { UsersPanel } from './users-panel'

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await requireRequestSession()
  if (session.user.role !== 'admin') notFound()
  const requestedPage = Number((await searchParams).page ?? 1)
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 5001) : 1
  const { items, total } = await platformUsers.list(session.user.id, {
    offset: (page - 1) * 20,
    limit: 20,
  })
  return <UsersPanel users={items} total={total} page={page} actorId={session.user.id} />
}
