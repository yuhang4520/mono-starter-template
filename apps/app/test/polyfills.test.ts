import assert from 'node:assert/strict'
import { it } from 'node:test'

it('native AbortSignal polyfill preserves multiple listeners and removal', async () => {
  const originalController = globalThis.AbortController
  const originalSignal = globalThis.AbortSignal
  Reflect.deleteProperty(globalThis, 'AbortController')
  Reflect.deleteProperty(globalThis, 'AbortSignal')
  try {
    await import('../src/utils/polyfills')
    const controller = new AbortController()
    let first = 0
    let second = 0
    let removed = 0
    const onRemove = () => {
      removed++
    }
    controller.signal.addEventListener('abort', () => {
      first++
    })
    controller.signal.addEventListener('abort', () => {
      second++
    })
    controller.signal.addEventListener('abort', onRemove)
    controller.signal.removeEventListener('abort', onRemove)
    controller.abort()
    controller.abort()
    assert.equal(controller.signal.aborted, true)
    assert.deepEqual([first, second, removed], [1, 1, 0])
  }
  finally {
    globalThis.AbortController = originalController
    globalThis.AbortSignal = originalSignal
  }
})
