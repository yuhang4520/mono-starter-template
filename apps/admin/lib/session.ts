import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { workspace, WorkspaceError } from '@your-project/workspace'
import { auth } from './auth'

/** Request-local only: never share an authenticated session across requests. */
export const getRequestSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  if (!session) return null
  try {
    const currentUser = await workspace.getUser(session.user.id)
    return { ...session, user: { ...session.user, ...currentUser } }
  } catch (error) {
    if (error instanceof WorkspaceError && error.code === 'UNAUTHORIZED') return null
    throw error
  }
})

export async function requireRequestSession() {
  const session = await getRequestSession()
  if (!session) redirect('/login')
  return session
}

export const getDashboardContext = cache(async () => {
  const session = await requireRequestSession()
  const organizations = await workspace.listOrganizations(session.user.id)
  const activeOrganization = organizations.find(
    organization =>
      organization.id === session.session.activeOrganizationId &&
      !organization.locked &&
      ['owner', 'admin', 'member'].includes(organization.role),
  )
  return { session, organizations, activeOrganization }
})
