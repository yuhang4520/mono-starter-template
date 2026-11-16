import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WorkspaceError } from '@your-project/workspace'
import { createAuthHttpBoundary } from '../lib/auth-http-boundary'

test('raw organization/admin mutations cannot reach the plugin handler', async () => {
  let calls = 0
  const handler = createAuthHttpBoundary({
    handle: async () => {
      calls++
      return new Response()
    },
    getSession: async () => null,
    getUser: async () => ({}),
    requireMember: async () => ({}),
  })
  for (const path of [
    'organization/create',
    'organization/update',
    'organization/delete',
    'organization/update-member-role',
    'organization/remove-member',
    'organization/leave',
    'organization/invite-member',
    'organization/accept-invitation',
    'organization/create-role',
    'admin/ban-user',
    'admin/set-role',
    'admin/impersonate-user',
    '%6frganization/remove-member',
  ]) {
    assert.equal(
      (await handler(new Request(`http://localhost/api/auth/${path}`, { method: 'POST' }))).status,
      403,
      path,
    )
  }
  assert.equal(calls, 0)
})

test('switch and scoped reads use live membership and locked-organization checks', async () => {
  const checked: string[] = []
  let calls = 0
  const handler = createAuthHttpBoundary({
    handle: async request => {
      calls++
      return Response.json(request.method === 'POST' ? await request.json() : { ok: true })
    },
    getSession: async () => ({
      user: { id: 'actor' },
      session: { activeOrganizationId: 'active' },
    }),
    getUser: async () => ({}),
    requireMember: async (_user, organization) => {
      checked.push(organization)
      if (organization === 'locked') throw new WorkspaceError('FORBIDDEN', 'locked')
    },
  })
  assert.equal(
    (
      await handler(
        new Request('http://localhost/api/auth/organization/list-members?organizationId=locked'),
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await handler(
        new Request('http://localhost/api/auth/organization/list-members?organizationSlug=other'),
      )
    ).status,
    400,
  )
  const switched = await handler(
    new Request('http://localhost/api/auth/organization/set-active', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: 'selected' }),
    }),
  )
  assert.equal(switched.status, 200)
  assert.deepEqual(await switched.json(), { organizationId: 'selected' })
  assert.equal(
    (await handler(new Request('http://localhost/api/auth/organization/get-active-member'))).status,
    200,
  )
  assert.equal(
    (
      await handler(
        new Request(
          'http://localhost/api/auth/organization/get-active-member-role?organizationId=locked',
        ),
      )
    ).status,
    403,
  )
  assert.equal(
    (
      await handler(
        new Request(
          'http://localhost/api/auth/organization/list-members?organizationId=locked&organizationId=selected',
        ),
      )
    ).status,
    400,
  )
  assert.deepEqual(checked, ['locked', 'selected', 'active', 'locked'])
  assert.equal(calls, 2)
})

test('normal login routes pass through, revoked organization sessions do not', async () => {
  let calls = 0
  const handler = createAuthHttpBoundary({
    handle: async () => {
      calls++
      return new Response()
    },
    getSession: async () => null,
    getUser: async () => ({}),
    requireMember: async () => ({}),
  })
  assert.equal(
    (
      await handler(
        new Request('http://localhost/api/auth/sign-in/phone-number', { method: 'POST' }),
      )
    ).status,
    200,
  )
  assert.equal(
    (await handler(new Request('http://localhost/api/auth/organization/list'))).status,
    401,
  )
  assert.equal(calls, 1)
})
