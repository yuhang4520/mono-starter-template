import { auth } from '@/lib/auth'
import { workspace } from '@your-project/workspace'
import { createAuthHttpBoundary } from '@/lib/auth-http-boundary'

const handler = createAuthHttpBoundary({
  handle: request => auth.handler(request),
  getSession: headers => auth.api.getSession({ headers, query: { disableCookieCache: true } }),
  getUser: workspace.getUser,
  requireMember: workspace.requireMember,
})

export const GET = handler
export const POST = handler
