import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { createDatabase } from 'db/client'
import { users, sessions } from 'db/schema'
import { eq, inArray } from 'db'
import { createPlatformUserService } from '../lib/platform-users'

const connectionString = process.env.TEST_DATABASE_URL
const pool = new Pool({ connectionString })
const database = createDatabase(pool)
const service = createPlatformUserService(database)
const adminId = randomUUID()
const userId = randomUUID()
const otherAdminId = randomUUID()
const actorIds = [adminId, userId, otherAdminId]
let seeded = false

before(async () => {
  if (!connectionString) return
  await database
    .insert(users)
    .values(
      actorIds.map((id, index) => ({
        id,
        name: `Platform test ${index}`,
        email: `${id}@example.invalid`,
        role: index === 1 ? 'user' : 'admin',
      })),
    )
  seeded = true
})
after(async () => {
  try {
    if (seeded) await database.delete(users).where(inArray(users.id, actorIds))
  } finally {
    await pool.end()
  }
})

test(
  'platform user changes enforce live roles and revoke sessions atomically',
  { skip: !connectionString },
  async () => {
    const listed = await service.list(adminId, { limit: 2 })
    assert.equal(listed.items.length, 2)
    assert.ok(listed.total >= 3)
    assert.ok(!JSON.stringify(listed.items).includes('token'))
    await assert.rejects(service.list(userId), /平台管理员/)
    await assert.rejects(service.ban(userId, adminId), /平台管理员/)
    await assert.rejects(service.ban(adminId, adminId), /当前账号/)
    await assert.rejects(service.ban(adminId, otherAdminId), /其他管理员/)
    await database
      .insert(sessions)
      .values({
        userId,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 60000),
        updatedAt: new Date(),
      })
    await service.ban(adminId, userId)
    assert.equal(
      (await database.query.users.findFirst({ where: eq(users.id, userId) }))?.banned,
      true,
    )
    assert.equal(
      (await database.query.sessions.findMany({ where: eq(sessions.userId, userId) })).length,
      0,
    )
    await service.unban(adminId, userId)
    assert.equal(
      (await database.query.users.findFirst({ where: eq(users.id, userId) }))?.banned,
      false,
    )
    await database
      .insert(sessions)
      .values({
        userId,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 60000),
        updatedAt: new Date(),
      })
    await service.revokeSessions(adminId, userId)
    assert.equal(
      (await database.query.sessions.findMany({ where: eq(sessions.userId, userId) })).length,
      0,
    )
    await database.update(users).set({ role: 'user' }).where(eq(users.id, adminId))
    await assert.rejects(service.ban(adminId, userId), /平台管理员/)
    assert.equal(
      (await database.query.users.findFirst({ where: eq(users.id, userId) }))?.banned,
      false,
    )
  },
)
