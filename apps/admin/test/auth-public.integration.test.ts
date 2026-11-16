import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

const testUrl = process.env.TEST_DATABASE_URL

test(
  'real auth HTTP handler keeps signup unprivileged and closes organization write bypasses',
  { skip: !testUrl },
  async () => {
    process.env.DATABASE_URL = testUrl!
    process.env.BETTER_AUTH_URL = 'http://localhost:3300'
    process.env.BETTER_AUTH_SECRET = randomUUID() + randomUUID()
    const phone = `139${Date.now().toString().slice(-8)}`
    process.env.ADMIN_PHONE = phone
    const email = `${randomUUID()}@example.invalid`
    const { GET, POST } = await import('../app/api/auth/[...all]/route')
    const { workspace } = await import('@your-project/workspace')
    const { db, pool } = await import('db/client')
    const { users, organizations, members, sessions } = await import('db/schema')
    const { eq } = await import('db')
    let organizationId: string | undefined
    const request = (path: string, body?: unknown, cookie = '') =>
      new Request(`http://localhost:3300/api/auth/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3300', cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    try {
      const signup = {
        name: 'Auth boundary test',
        email,
        password: randomUUID(),
        phoneNumber: phone,
      }
      const escalated = await POST(request('sign-up/email', { ...signup, role: 'admin' }))
      assert.equal(escalated.status, 400)
      assert.equal((await escalated.json()).code, 'FIELD_NOT_ALLOWED')
      const signedUp = await POST(request('sign-up/email', signup))
      assert.equal(signedUp.status, 200, await signedUp.clone().text())
      const cookie = signedUp.headers
        .getSetCookie()
        .map(value => value.split(';')[0])
        .join('; ')
      assert.ok(cookie)
      const user = await db.query.users.findFirst({ where: eq(users.email, email) })
      assert.ok(user)
      assert.equal(user.role, 'user')
      const organization = await workspace.createOrganization(user.id, {
        name: 'Boundary test',
        slug: `boundary-${randomUUID()}`,
      })
      organizationId = organization.id
      for (const operation of [
        'create',
        'update',
        'delete',
        'update-member-role',
        'remove-member',
        'invite-member',
        'leave',
      ]) {
        const response = await POST(
          request(
            `organization/${operation}`,
            { organizationId, role: 'owner', memberId: randomUUID() },
            cookie,
          ),
        )
        assert.equal(response.status, 403, operation)
      }
      assert.equal(
        (await POST(request('admin/set-role', { userId: user.id, role: 'admin' }, cookie))).status,
        403,
      )
      assert.equal(
        (await POST(request('organization/set-active', { organizationId }, cookie))).status,
        200,
      )
      await db
        .update(organizations)
        .set({ locked: true })
        .where(eq(organizations.id, organizationId))
      assert.equal(
        (await POST(request('organization/set-active', { organizationId }, cookie))).status,
        403,
      )
      assert.equal(
        (
          await GET(
            request(
              `organization/list-members?organizationId=${organizationId}`,
              undefined,
              cookie,
            ),
          )
        ).status,
        403,
      )
      // The plugin ignores organizationId on active-member reads. Our guard must
      // check the actual active organization instead of trusting that parameter.
      assert.equal(
        (
          await GET(
            request(
              `organization/get-active-member?organizationId=${randomUUID()}`,
              undefined,
              cookie,
            ),
          )
        ).status,
        403,
      )
      assert.equal((await db.query.users.findFirst({ where: eq(users.id, user.id) }))?.role, 'user')
      await db
        .update(organizations)
        .set({ locked: false })
        .where(eq(organizations.id, organizationId))
      await db.delete(members).where(eq(members.organizationId, organizationId))
      assert.equal(
        (
          await GET(
            request(
              `organization/list-members?organizationId=${organizationId}`,
              undefined,
              cookie,
            ),
          )
        ).status,
        403,
        'membership removal must take effect on the next request',
      )
      await db.update(users).set({ banned: true }).where(eq(users.id, user.id))
      assert.equal(
        (await GET(request('organization/list', undefined, cookie))).status,
        401,
        'a banned user cannot reuse an existing cookie',
      )
      await db.update(users).set({ banned: false }).where(eq(users.id, user.id))
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      assert.equal(
        (await GET(request('organization/list', undefined, cookie))).status,
        401,
        'revoked sessions cannot reuse an existing cookie',
      )
    } finally {
      try {
        if (organizationId)
          await db.delete(organizations).where(eq(organizations.id, organizationId))
        await db.delete(users).where(eq(users.email, email))
      } finally {
        await pool.end()
      }
    }
  },
)
