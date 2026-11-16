import assert from 'node:assert/strict'
import { it } from 'node:test'
import { fetchWithTimeout } from '../src/utils/fetchWithTimeout'

function headersBeforeBody() {
  let transportSignal: AbortSignal | undefined
  let bodyStarted!: () => void
  const started = new Promise<void>((resolve) => {
    bodyStarted = resolve
  })
  const fetcher: typeof fetch = async (_input, init) => {
    transportSignal = init?.signal ?? undefined

    return new Response(new ReadableStream<Uint8Array>({
      start(stream) {
        const cancel = () => stream.error(transportSignal?.reason ?? new Error('aborted'))
        if (transportSignal?.aborted)
          cancel()
        else
          transportSignal?.addEventListener('abort', cancel, { once: true })
        bodyStarted()
      },
    }), { headers: { 'content-type': 'application/json' } })
  }

  return { fetcher, started, signal: () => transportSignal }
}

it('H5 timeout includes a body that hangs after response headers', { timeout: 1000 }, async () => {
  const transport = headersBeforeBody()
  await assert.rejects(fetchWithTimeout('https://fixture.invalid', undefined, { timeoutMs: 20, fetcher: transport.fetcher }))
  assert.equal(transport.signal()?.aborted, true)
})

it('H5 user cancellation still aborts the body after headers arrive', { timeout: 1000 }, async () => {
  const transport = headersBeforeBody()
  const controller = new AbortController()
  const request = fetchWithTimeout('https://fixture.invalid', { signal: controller.signal }, { timeoutMs: 500, fetcher: transport.fetcher })
  await transport.started
  // Let the fetch continuation run before cancelling the outstanding body read.
  await new Promise(resolve => setTimeout(resolve, 0))
  controller.abort(new Error('user cancelled'))
  await assert.rejects(request)
  assert.equal(transport.signal()?.aborted, true)
})

it('H5 completed responses preserve JSON, status and headers and release cancellation', async () => {
  let transportSignal: AbortSignal | undefined
  const controller = new AbortController()
  const fetcher: typeof fetch = async (_input, init) => {
    transportSignal = init?.signal ?? undefined

    return new Response(JSON.stringify({ result: { data: { id: 'example' } } }), {
      status: 201,
      headers: { 'content-type': 'application/json', 'x-request-id': 'fixture-request' },
    })
  }
  const response = await fetchWithTimeout('https://fixture.invalid', { signal: controller.signal }, { timeoutMs: 20, fetcher })
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('x-request-id'), 'fixture-request')
  assert.deepEqual(await response.json(), { result: { data: { id: 'example' } } })
  controller.abort()
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.equal(transportSignal?.aborted, false)
})

it('H5 an already cancelled request cannot begin a body read', async () => {
  const controller = new AbortController()
  controller.abort(new Error('already cancelled'))
  const fetcher: typeof fetch = async (_input, init) => {
    assert.equal(init?.signal?.aborted, true)
    throw init?.signal?.reason
  }
  await assert.rejects(fetchWithTimeout('https://fixture.invalid', { signal: controller.signal }, { fetcher }))
})
