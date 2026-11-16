import { and, asc, count, desc, eq, inArray, ne } from 'db'
import { db, type Database } from 'db/client'
import { users, sessions } from 'db/schema'
import { WorkspaceError, isUserBanned } from '@your-project/workspace'
import { z } from 'zod'

/** Platform administration is separate from tenant membership and never inferred from a menu. */
export function createPlatformUserService(database: Database) {
  async function requireAdmin(actorId: string) {
    const actor = await database.query.users.findFirst({ where: eq(users.id, actorId) })
    if (!actor || isUserBanned(actor)) throw new WorkspaceError('UNAUTHORIZED', '登录状态已失效')
    if (actor.role !== 'admin') throw new WorkspaceError('FORBIDDEN', '需要平台管理员权限')
    return actor
  }

  async function change(actorId: string, targetId: string, operation: 'ban' | 'unban' | 'revoke') {
    z.uuid().parse(actorId)
    z.uuid().parse(targetId)
    if (actorId === targetId) throw new WorkspaceError('FORBIDDEN', '不能对当前账号执行此操作')
    return database.transaction(async tx => {
      // Lock both identities in deterministic order. A concurrent role change
      // cannot make an already-authorized mutation act on a newly promoted admin.
      const rows = await tx
        .select()
        .from(users)
        .where(inArray(users.id, [actorId, targetId]))
        .orderBy(asc(users.id))
        .for('update')
      const actor = rows.find(row => row.id === actorId)
      const target = rows.find(row => row.id === targetId)
      if (!actor || isUserBanned(actor)) throw new WorkspaceError('UNAUTHORIZED', '登录状态已失效')
      if (actor.role !== 'admin') throw new WorkspaceError('FORBIDDEN', '需要平台管理员权限')
      if (!target) throw new WorkspaceError('NOT_FOUND', '用户不存在')
      if (target.role && target.role !== 'user')
        throw new WorkspaceError('FORBIDDEN', '不能修改其他管理员账号')
      if (operation !== 'revoke') {
        await tx
          .update(users)
          .set({
            banned: operation === 'ban',
            banReason: operation === 'ban' ? '由平台管理员禁用' : null,
            banExpires: null,
            updatedAt: new Date(),
          })
          .where(and(eq(users.id, targetId), ne(users.id, actorId)))
      }
      // Unbanning does not revive previously issued cookies or JWTs either.
      await tx.delete(sessions).where(eq(sessions.userId, targetId))
      return { success: true as const }
    })
  }

  return {
    requireAdmin,
    async list(actorId: string, input: { offset?: number; limit?: number } = {}) {
      await requireAdmin(actorId)
      const { offset, limit } = z
        .object({
          offset: z.number().int().min(0).max(100000).default(0),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .parse(input)
      const [items, totals] = await Promise.all([
        database
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            banned: users.banned,
            banExpires: users.banExpires,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(desc(users.createdAt), desc(users.id))
          .offset(offset)
          .limit(limit),
        database.select({ total: count() }).from(users),
      ])
      return { items, total: totals[0]?.total ?? 0 }
    },
    ban: (actorId: string, targetId: string) => change(actorId, targetId, 'ban'),
    unban: (actorId: string, targetId: string) => change(actorId, targetId, 'unban'),
    revokeSessions: (actorId: string, targetId: string) => change(actorId, targetId, 'revoke'),
  }
}

export const platformUsers = createPlatformUserService(db)
