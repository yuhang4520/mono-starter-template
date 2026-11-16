import type { Operation, TRPCLink } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { TRPCClientError } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import { AuthExpiredError } from '../src/utils/auth-core'
import { createAuthRetryLink } from '../src/utils/authRetryLink'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

function unauthorized() {
  return TRPCClientError.from({ error: { message: 'expired', code: -32001, data: { code: 'UNAUTHORIZED', httpStatus: 401 } } })
}

function harness(options: { refresh?: () => Promise<unknown>, path?: string, signal?: AbortSignal } = {}) {
  let version = 1
  let expired = 0
  let requests = 0
  let aborted = 0
  const sinks: Array<{ next: (value: any) => void, error: (error: any) => void, complete: () => void }> = []
  const results: unknown[] = []
  const errors: unknown[] = []
  const link = createAuthRetryLink<AnyRouter>({
    getVersion: () => version,
    refresh: options.refresh ?? (async () => {}),
    expired: () => {
      expired++
      version++
    },
  })({} as Parameters<TRPCLink<AnyRouter>>[0])
  const request = link({
    op: { id: 1, type: 'query', path: options.path ?? 'auth.getMe', input: undefined, context: {}, signal: options.signal ?? null } as Operation,
    next: () => observable((sink) => {
      requests++
      sinks.push(sink)

      return () => {
        aborted++
      }
    }),
  }).subscribe({ next: value => results.push(value), error: error => errors.push(error) })

  return { sinks, results, errors, request, replace: () => {
    version++
  }, counts: () => ({ requests, expired, aborted }) }
}

it('401 retries once; a second unauthorized response expires the session', async () => {
  let refreshes = 0
  const h = harness({ refresh: async () => {
    refreshes++
  } })
  h.sinks[0]!.error(unauthorized())
  await tick()
  h.sinks[1]!.error(unauthorized())
  assert.equal(refreshes, 1)
  assert.equal(h.counts().requests, 2)
  assert.equal(h.counts().expired, 1)
  assert.equal(h.errors.length, 1)
})

it('incorrect login credentials never trigger refresh or logout', async () => {
  let refreshes = 0
  const h = harness({ path: 'auth.loginByPhoneNumber', refresh: async () => {
    refreshes++
  } })
  h.sinks[0]!.error(unauthorized())
  await tick()
  assert.equal(refreshes, 0)
  assert.equal(h.counts().expired, 0)
})

it('cancelling during refresh prevents retry and late side effects', async () => {
  let resolve!: () => void
  const h = harness({ refresh: () => new Promise<void>((yes) => {
    resolve = yes
  }) })
  h.sinks[0]!.error(unauthorized())
  h.request.unsubscribe()
  resolve()
  await tick()
  assert.equal(h.counts().requests, 1)
  assert.equal(h.counts().expired, 0)
  assert.equal(h.errors.length, 0)
})

it('cancelling after retry starts aborts the retry transport', async () => {
  const h = harness()
  h.sinks[0]!.error(unauthorized())
  await tick()
  h.request.unsubscribe()
  assert.equal(h.counts().aborted, 2)
})

it('old successful responses are rejected after account replacement', () => {
  const h = harness()
  h.replace()
  h.sinks[0]!.next({ result: { data: { name: 'old user' } } })
  assert.equal(h.results.length, 0)
  assert.equal(h.errors.length, 1)
  assert.equal(h.counts().expired, 0)
})

it('refresh network errors preserve the login state', async () => {
  const h = harness({ refresh: async () => {
    throw new Error('offline')
  } })
  h.sinks[0]!.error(unauthorized())
  await tick()
  assert.equal(h.counts().expired, 0)
  assert.equal(h.errors.length, 1)
})

it('explicit refresh rejection clears the current login state', async () => {
  const h = harness({ refresh: async () => {
    throw new AuthExpiredError()
  } })
  h.sinks[0]!.error(unauthorized())
  await tick()
  assert.equal(h.counts().expired, 1)
})

it('a refresh rejection from an old account cannot clear the new account', async () => {
  let reject!: (error: Error) => void
  const h = harness({ refresh: () => new Promise((_, no) => {
    reject = no
  }) })
  h.sinks[0]!.error(unauthorized())
  h.replace()
  reject(new AuthExpiredError())
  await tick()
  assert.equal(h.counts().expired, 0)
  assert.equal(h.counts().requests, 1)
})

it('abort signal cancels immediately while a refresh is in progress', async () => {
  const controller = new AbortController()
  let resolve!: () => void
  const h = harness({ signal: controller.signal, refresh: () => new Promise<void>((yes) => {
    resolve = yes
  }) })
  h.sinks[0]!.error(unauthorized())
  controller.abort()
  assert.equal(h.errors.length, 1)
  resolve()
  await tick()
  assert.equal(h.counts().requests, 1)
  assert.equal(h.counts().expired, 0)
})
