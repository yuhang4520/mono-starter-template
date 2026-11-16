import type { Operation } from '@trpc/client'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@your-project/api'
import { createTRPCProxyClient, httpBatchLink, httpLink, splitLink } from '@trpc/client'
import { getAccessToken, getAuthSessionVersion, getRefreshToken, handleAuthFailure, performTokenRefresh } from '@/utils/auth'
import { createAuthRetryLink } from '@/utils/authRetryLink'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { identityTransformer } from '@/utils/identityTransformer'
import { createUniRequestLink } from '@/utils/uniRequestLink'
import { getClientHeaders } from './clientHeaders'
import '@/utils/polyfills'

export type RouterOutput = inferRouterOutputs<AppRouter>
export type RouterInput = inferRouterInputs<AppRouter>

const url = `${import.meta.env.VITE_SERVER_URL}/api/trpc`
let nativeTransport = false
// #ifdef MP || APP-PLUS || APP-HARMONY
nativeTransport = true
// #endif

function headers(operations: Operation[]): Record<string, string> {
  if (operations.some(op => op.context.authSessionVersion !== getAuthSessionVersion()))
    throw new Error('登录状态已变更，请重试')
  const token = operations[0]?.path === 'auth.refresh' ? getRefreshToken() : getAccessToken()

  return { ...getClientHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    createAuthRetryLink({ getVersion: getAuthSessionVersion, refresh: performTokenRefresh, expired: handleAuthFailure }),
    nativeTransport
      ? createUniRequestLink({ url, headers: op => headers([op]) })
      : splitLink({
          // Authentication operations never share a batch with ordinary access credentials.
          condition: op => op.path.startsWith('auth.'),
          true: httpLink({ url, fetch: fetchWithTimeout, transformer: identityTransformer, headers: ({ op }) => headers([op]) }),
          false: httpBatchLink({ url, fetch: fetchWithTimeout, transformer: identityTransformer, headers: ({ opList }) => headers(opList) }),
        }),
  ],
})
export default trpc
