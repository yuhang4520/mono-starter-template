import assert from 'node:assert/strict'
import { it } from 'node:test'
import { createTRPCUntypedClient } from '@trpc/client'
import { createUniRequestLink } from '../src/utils/uniRequestLink'

function transport() {
  let calls = 0
  let aborted = 0
  let options: UniApp.RequestOptions | undefined
  Object.defineProperty(globalThis, 'uni', { configurable: true, value: {
    request(input: UniApp.RequestOptions) {
      options = input
      calls++

      return { abort: () => {
        aborted++
      } }
    },
  } })
  const client = createTRPCUntypedClient({ links: [createUniRequestLink({ url: 'https://api.example.test/api/trpc' })] })

  return { client, options: () => options!, counts: () => ({ calls, aborted }) }
}

it('native transport sends query input and resolves the unbatched result', async () => {
  const t = transport()
  const result = t.client.query('items.list', { title: '中文' })
  assert.equal(t.options().method, 'GET')
  assert.match(t.options().url!, /input=/)
  t.options().success!({ statusCode: 200, data: JSON.stringify({ result: { data: { id: 'one' } } }), header: {}, cookies: [] })
  assert.deepEqual(await result, { id: 'one' })
})

it('native transport cancellation aborts the underlying uni request', async () => {
  const t = transport()
  const controller = new AbortController()
  const result = t.client.query('items.list', undefined, { signal: controller.signal })
  controller.abort()
  await assert.rejects(result)
  assert.equal(t.counts().aborted, 1)
})

it('native transport rejects malformed JSON and structured errors', async () => {
  const t = transport()
  const malformed = t.client.query('items.list')
  t.options().success!({ statusCode: 200, data: '<html>', header: {}, cookies: [] })
  await assert.rejects(malformed)
  const denied = t.client.query('items.list')
  t.options().success!({ statusCode: 401, data: JSON.stringify({ error: { message: 'denied', code: -32001, data: { code: 'UNAUTHORIZED' } } }), header: {}, cookies: [] })
  await assert.rejects(denied, error => (error as { data: { code: string } }).data.code === 'UNAUTHORIZED')
})
