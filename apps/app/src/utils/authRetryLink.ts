import type { TRPCLink } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'
import { TRPCClientError } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import { AuthExpiredError, SessionChangedError } from './auth-core'

interface SessionDependencies {
  getVersion: () => number
  refresh: () => Promise<unknown>
  expired: () => void
}

function unauthorized(error: unknown) {
  return error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED'
}

export function createAuthRetryLink<TRouter extends AnyRouter>(session: SessionDependencies): TRPCLink<TRouter> {
  return () => ({ op, next }) => observable((observer) => {
    const version = session.getVersion()
    let cancelled = false
    let active: { unsubscribe: () => void } | undefined
    let retried = false
    const current = () => !cancelled && version === session.getVersion()
    const stale = () => observer.error(TRPCClientError.from(new SessionChangedError()))
    const canRefresh = !['auth.loginByPhoneNumber', 'auth.refresh', 'auth.logout'].includes(op.path)
    const run = () => {
      if (cancelled)
        return
      if (!current()) {
        stale()

        return
      }
      active = next({ ...op, context: { ...op.context, authSessionVersion: version } }).subscribe({
        next(result) {
          if (cancelled)
            return
          if (current())
            observer.next(result)
          else
            stale()
        },
        complete() {
          if (current())
            observer.complete()
        },
        async error(error) {
          if (cancelled)
            return
          if (!current()) {
            stale()

            return
          }
          if (canRefresh && unauthorized(error) && !retried) {
            retried = true
            try {
              await session.refresh()
              if (cancelled)
                return
              if (!current()) {
                stale()

                return
              }
              run()
            }
            catch (refreshError) {
              if (cancelled)
                return
              if (!current()) {
                stale()

                return
              }
              if (refreshError instanceof AuthExpiredError)
                session.expired()
              observer.error(TRPCClientError.from(refreshError instanceof Error ? refreshError : new Error('登录刷新失败')))
            }
          }
          else {
            if (canRefresh && unauthorized(error))
              session.expired()
            observer.error(error)
          }
        },
      })
    }
    const abort = () => {
      cancelled = true
      active?.unsubscribe()
      observer.error(TRPCClientError.from(new Error('请求已取消')))
    }
    op.signal?.addEventListener('abort', abort, { once: true })
    if (op.signal?.aborted)
      abort()
    else
      run()

    return () => {
      cancelled = true
      op.signal?.removeEventListener('abort', abort)
      active?.unsubscribe()
    }
  })
}
