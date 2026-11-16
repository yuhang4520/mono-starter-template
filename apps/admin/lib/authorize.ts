'use server'

import { headers } from 'next/headers'
import { auth } from './auth'
import { statements } from './permissions'
import { requireRequestSession } from './session'
import { workspace, WorkspaceError } from '@your-project/workspace'

export async function authorize(permissions: {
  [Key in keyof typeof statements]?: (typeof statements)[Key][number][]
}) {
  const session = await requireRequestSession()
  const uid = session.user.id
  if (session.user.role === 'admin') {
    const { success } = await auth.api.userHasPermission({ body: { permissions, userId: uid } })
    return { granted: success, uid, organizationId: undefined, memberId: undefined, role: 'admin' }
  }
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return { granted: false, uid }
  try {
    const member = await workspace.requireMember(uid, organizationId)
    const { success } = await auth.api.hasPermission({
      headers: await headers(),
      body: { permissions, organizationId },
    })
    return { granted: success, uid, organizationId, memberId: member.memberId, role: member.role }
  } catch (error) {
    if (
      error instanceof WorkspaceError &&
      (error.code === 'FORBIDDEN' || error.code === 'NOT_FOUND')
    )
      return { granted: false, uid }
    throw error
  }
}
