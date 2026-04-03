import type { TRPCLink } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'
import { TRPCClientError } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import { performTokenRefresh } from './auth'

export function createUniRequestLink<TRouter extends AnyRouter>(opts: {
  url: string
  transformer?: any
  headers?: Record<string, any> | ((opts: { op: any }) => Record<string, any> | Promise<Record<string, any>>)
}): TRPCLink<TRouter> {
  return () => ({ op }) =>
    observable((observer) => {
      const { path, input, type } = op

      const transformer = opts.transformer || { serialize: v => v, deserialize: v => v }
      const serializedInput = transformer.serialize(input)

      const method = type === 'query' ? 'GET' : 'POST'
      let url = `${opts.url}/${path}`
      let data: any = serializedInput

      if (method === 'GET') {
        if (serializedInput !== undefined) {
          url += `?input=${encodeURIComponent(JSON.stringify(serializedInput))}`
        }
        data = undefined
      }

      let requestTask: UniApp.RequestTask | null = null
      let isRetried = false

      const run = async () => {
        const headers = typeof opts.headers === 'function' ? await opts.headers({ op }) : (opts.headers || {})

        requestTask = uni.request({
          url,
          method,
          data,
          header: {
            'content-type': 'application/json',
            ...headers,
          },
          dataType: 'text',
          success: async (res) => {
            if (res.statusCode === 401 && !isRetried) {
              console.log('[Link] 401 detected, attempting token refresh...')
              try {
                isRetried = true
                await performTokenRefresh()

                return run()
              }
              catch (refreshError) {
                console.error('[Link] Token refresh failed during 401 interception:', refreshError)
              }
            }

            let jsonDoc: any
            try {
              jsonDoc = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
            }
            catch (e) {
              return observer.error(TRPCClientError.from(new Error('Invalid JSON response')))
            }

            const processResponse = (item: any) => {
              if (item.error)
                return item
              if (item.result && item.result.data !== undefined) {
                item.result.data = transformer.deserialize(item.result.data)
              }

              return item
            }

            const result = Array.isArray(jsonDoc)
              ? jsonDoc.map(processResponse)
              : processResponse(jsonDoc)

            if (res.statusCode >= 400) {
              observer.error(TRPCClientError.from(result))
            }
            else {
              observer.next(result)
              observer.complete()
            }
          },
          fail: (err) => {
            console.log('请求失败:', err)
            observer.error(TRPCClientError.from(err))
          },
        })
      }

      run()

      return () => requestTask?.abort()
    })
}
