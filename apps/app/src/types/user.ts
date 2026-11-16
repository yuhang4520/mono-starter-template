import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@your-project/api'

export type UserInfo = inferRouterOutputs<AppRouter>['auth']['getMe']
export type AuthResponse = inferRouterOutputs<AppRouter>['auth']['loginByPhoneNumber']
