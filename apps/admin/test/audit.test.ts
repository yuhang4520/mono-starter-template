import assert from 'node:assert/strict'
import { test } from 'node:test'
import { redactPayload } from '../lib/audit-payload'
import { createAuditWrapper } from '../lib/audit-core'

test('audit masks credentials and phones, omits note bodies, preserves input', () => {
  const input = {
    title: 'Public label',
    body: 'Private note',
    phoneNumber: '13800138000',
    nested: { refreshToken: 'never-log-this', password: 'never-log-this' },
  }
  const output = redactPayload(input)
  assert.deepEqual(output, {
    title: 'Public label',
    body: '[REDACTED]',
    phoneNumber: '***8000',
    nested: { refreshToken: '[REDACTED]', password: '[REDACTED]' },
  })
  assert.equal(input.body, 'Private note')
})

test('audit bounds cycles, large collections, binary and form bodies', () => {
  const cyclic: { self?: unknown } = {}
  cyclic.self = cyclic
  assert.ok(JSON.stringify(redactPayload(cyclic)).includes('MAX_DEPTH'))
  assert.equal(
    (redactPayload(Array.from({ length: 200 }, (_, index) => index)) as unknown[]).length,
    20,
  )
  assert.equal(redactPayload(new Uint8Array(100)), '[binary]')
  const form = new FormData()
  form.set('api_key', 'do-not-log')
  assert.deepEqual(redactPayload(form), { api_key: '[REDACTED]' })
  assert.equal(redactPayload(new Date('invalid')), '[INVALID_DATE]')
})

test('audited actions keep arguments and result, while logging sanitized metadata', async () => {
  const events: unknown[] = []
  const wrap = createAuditWrapper({
    context: async () => ({ actor: { uid: 'actor-id' } }),
    write: event => events.push(event),
  })
  const input = { title: 'note', body: 'secret content' }
  const action = wrap('notes:create', async (value: typeof input) => ({ value }))
  assert.deepEqual(await action(input), { value: input })
  assert.match(JSON.stringify(events), /notes:create/)
  assert.ok(!JSON.stringify(events).includes('secret content'))
})

test('rejections and redirects are distinguished and original errors are preserved', async () => {
  const outcomes: string[] = []
  const wrap = createAuditWrapper({
    context: async () => ({}),
    write: event => outcomes.push(event.outcome),
  })
  assert.deepEqual(await wrap('reject', async () => ({ ok: false, error: 'Denied' }))(), {
    ok: false,
    error: 'Denied',
  })
  const redirect = Object.assign(new Error('redirect'), {
    digest: 'NEXT_REDIRECT;replace;/login;307;',
  })
  await assert.rejects(
    wrap('redirect', async () => {
      throw redirect
    })(),
    error => error === redirect,
  )
  const failure = new Error('private SQL parameter')
  await assert.rejects(
    wrap('fail', async () => {
      throw failure
    })(),
    error => error === failure,
  )
  assert.deepEqual(outcomes, ['rejected', 'redirect', 'error'])
})

test('audit context and logging failures never skip or duplicate the operation', async () => {
  let count = 0
  const wrap = createAuditWrapper({
    context: async () => {
      throw new Error('no request')
    },
    write: () => {
      throw new Error('logger unavailable')
    },
  })
  const result = await wrap('mutate', async () => ++count)()
  assert.equal(result, 1)
  assert.equal(count, 1)
})

test('audit redacts named credentials in maps, headers and URL parameters', () => {
  const payload = {
    map: new Map([
      ['password', 'map-secret'],
      ['body', 'private-note'],
    ]),
    headers: new Headers({ authorization: 'Bearer header-secret' }),
    query: new URLSearchParams({ refreshToken: 'query-secret' }),
  }
  const serialized = JSON.stringify(redactPayload(payload))
  for (const secret of ['map-secret', 'private-note', 'header-secret', 'query-secret'])
    assert.ok(!serialized.includes(secret), secret)
  assert.ok(serialized.includes('[REDACTED]'))
})

test('payload inspection failures do not suppress the action or leak input', async () => {
  const input = Object.defineProperty({}, 'password', {
    enumerable: true,
    get() {
      throw new Error('private-value')
    },
  })
  const events: unknown[] = []
  let calls = 0
  const wrap = createAuditWrapper({
    context: async () => ({}),
    write: event => {
      events.push(event)
    },
  })
  const result = await wrap('operation', async (value: unknown) => {
    calls++
    assert.equal(value, input)
    return 'ok'
  })(input)
  assert.equal(result, 'ok')
  assert.equal(calls, 1)
  assert.ok(JSON.stringify(events).includes('[UNAVAILABLE]'))
  assert.ok(!JSON.stringify(events).includes('private-value'))
})
