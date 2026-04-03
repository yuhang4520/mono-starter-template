import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { AppRouter, OriginalType, zOriginalType } from '@your-project/api'
import {
  createTRPCProxyClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from '@trpc/client'
import { getAccessToken, getRefreshToken } from '@/utils/auth'
import { identityTransformer } from '@/utils/identityTransformer'
import { createUniRequestLink } from '@/utils/uniRequestLink'
import '@/utils/polyfills'

export type RouterOutput = inferRouterOutputs<AppRouter>
export type RouterInput = inferRouterInputs<AppRouter>
export type { OriginalType }
export type { zOriginalType }

const endpointURL = `${import.meta.env.VITE_SERVER_URL}/api/trpc`
const isWechatMp = typeof wx !== 'undefined'

console.log('[TRPC] Initializing client for', isWechatMp ? 'Wechat MP' : 'H5/Other')
console.log('[TRPC] endpointURL', endpointURL)
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    isWechatMp
      ? createUniRequestLink({
          url: endpointURL,
          transformer: identityTransformer,
          headers: ({ op }) => {
            // 刷新时使用 refresh token, 其他时候使用 access token
            const token = op.path === 'auth.refresh' ? getRefreshToken() : getAccessToken()

            return token ? { Authorization: `Bearer ${token}` } : {}
          },
        })
      : splitLink({
          condition: (op: any) => op.type === 'subscription',
          true: httpSubscriptionLink({
            url: endpointURL,
            transformer: identityTransformer,
          }),
          false: httpBatchLink({
            url: endpointURL,
            transformer: identityTransformer,
            headers: (opts) => {
              // httpBatchLink passes opList
              const isRefresh = opts.opList.some(op => op.path === 'auth.refresh')
              const token = isRefresh ? getRefreshToken() : getAccessToken()

              return token ? { Authorization: `Bearer ${token}` } : {}
            },
          }),
        }),
  ],
})
export default trpc
