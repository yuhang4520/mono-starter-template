import assert from 'node:assert/strict'
import { it } from 'node:test'
import { AuthExpiredError, createAuthSession, safeLoginRedirect, SessionChangedError } from '../src/utils/auth-core'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })

  return { promise, resolve, reject }
}
const tokens = (id: string) => ({ accessToken: `access-${id}`, refreshToken: `refresh-${id}` })

function makeSession(refresh: (token: string) => Promise<ReturnType<typeof tokens>>) {
  const storage = new Map<string, string>()

  return createAuthSession({
    read: key => storage.get(key),
    write: (key, value) => { storage.set(key, value) },
    remove: (key) => { storage.delete(key) },
    refresh,
  })
}

it('concurrent requests share one refresh and ordinary refresh preserves session version', async () => {
  const pending = deferred<ReturnType<typeof tokens>>()
  let calls = 0
  const session = makeSession(async () => {
    calls++

    return pending.promise
  })
  session.saveTokens(tokens('one'))
  const version = session.getVersion()
  const requests = Array.from({ length: 10 }, () => session.refresh())
  assert.equal(calls, 1)
  pending.resolve(tokens('renewed'))
  await Promise.all(requests)
  assert.equal(session.getAccessToken(), 'access-renewed')
  assert.equal(session.getVersion(), version)
})

it('logout and another login invalidate old refresh success', async () => {
  const pending = deferred<ReturnType<typeof tokens>>()
  const session = makeSession(() => pending.promise)
  session.saveTokens(tokens('first'))
  const request = session.refresh()
  session.clearTokens()
  session.saveTokens(tokens('second'))
  pending.resolve(tokens('old'))
  await assert.rejects(request, SessionChangedError)
  assert.equal(session.getAccessToken(), 'access-second')
})

it('network error preserves tokens and next refresh can retry', async () => {
  let fail = true
  const session = makeSession(async () => {
    if (fail)
      throw new Error('offline')

    return tokens('renewed')
  })
  session.saveTokens(tokens('one'))
  await assert.rejects(session.refresh(), /offline/)
  assert.equal(session.getRefreshToken(), 'refresh-one')
  fail = false
  await session.refresh()
  assert.equal(session.getAccessToken(), 'access-renewed')
})

it('logout clears both credentials and notifies store', async () => {
  const session = makeSession(async () => tokens('unused'))
  let clears = 0
  session.onClear(() => {
    clears++
  })
  session.saveTokens(tokens('one'))
  session.clearTokens()
  assert.equal(session.getAccessToken(), '')
  assert.equal(session.getRefreshToken(), '')
  assert.equal(clears, 1)
  await assert.rejects(session.refresh(), AuthExpiredError)
})

it('login redirects allow only an owned internal route', () => {
  for (const target of ['https://evil.test', '//evil.test', '/pages/webView/index?url=https://evil.test', '/pages/login/login', '%2f%2fevil.test', undefined])
    assert.equal(safeLoginRedirect(target), '/pages/index/index')
})
