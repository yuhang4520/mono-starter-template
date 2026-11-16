import type { Operation, TRPCLink } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'
import { TRPCClientError } from '@trpc/client'
import { observable } from '@trpc/server/observable'

/** Native transport only: retries and identity isolation live in authRetryLink. */
export function createUniRequestLink<TRouter extends AnyRouter>(opts: {
  url: string
  headers?: (operation: Operation) => Record<string, string>
}): TRPCLink<TRouter> {
  return () => ({ op }) => observable((observer) => {
    if (op.type === 'subscription') {
      observer.error(TRPCClientError.from(new Error('当前传输不支持订阅')))

      return
    }
    if (op.signal?.aborted) {
      observer.error(TRPCClientError.from(new Error('请求已取消')))

      return
    }
    let cancelled = false
    const query = op.type === 'query'
    const input = op.input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(op.input))}`
    const task = uni.request({
      url: `${opts.url}/${op.path}${query ? input : ''}`,
      method: query ? 'GET' : 'POST',
      data: query || op.input === undefined ? undefined : JSON.stringify(op.input),
      timeout: 15000,
      header: { 'content-type': 'application/json', ...opts.headers?.(op) },
      dataType: 'text',
      success(res) {
        if (cancelled)
          return
        try {
          const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          if (!body || typeof body !== 'object')
            throw new Error('服务器响应格式错误')
          if ('error' in body) {
            observer.error(TRPCClientError.from(body))

            return
          }
          if (res.statusCode >= 400 || !('result' in body))
            throw new Error(`请求失败 (${res.statusCode})`)
          observer.next(body)
          observer.complete()
        }
        catch (error) {
          observer.error(TRPCClientError.from(error instanceof Error ? error : new Error('服务器响应格式错误')))
        }
      },
      fail(error) {
        if (!cancelled)
          observer.error(TRPCClientError.from(new Error(error.errMsg || '网络连接失败')))
      },
    })

    const abort = () => {
      if (!cancelled) {
        cancelled = true
        task.abort()
        observer.error(TRPCClientError.from(new Error('请求已取消')))
      }
    }
    op.signal?.addEventListener('abort', abort, { once: true })
    if (op.signal?.aborted)
      abort()

    return () => {
      op.signal?.removeEventListener('abort', abort)
      if (!cancelled) {
        cancelled = true
        task.abort()
      }
    }
  })
}
