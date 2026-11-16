'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRequestSession } from './session'
import { actionResult } from './action-result'
import { withAudit } from './audit'
import { platformUsers } from './platform-users'

const target = z.object({ userId: z.uuid('无效用户') })

export const banUser = withAudit('platform-users:ban', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const result = await platformUsers.ban(session.user.id, target.parse(input).userId)
    revalidatePath('/users')
    return result
  })
})

export const unbanUser = withAudit('platform-users:unban', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const result = await platformUsers.unban(session.user.id, target.parse(input).userId)
    revalidatePath('/users')
    return result
  })
})

export const revokeUserSessions = withAudit(
  'platform-users:revokeSessions',
  async (input: unknown) => {
    const session = await requireRequestSession()
    return actionResult(async () => {
      const result = await platformUsers.revokeSessions(session.user.id, target.parse(input).userId)
      revalidatePath('/users')
      return result
    })
  },
)
