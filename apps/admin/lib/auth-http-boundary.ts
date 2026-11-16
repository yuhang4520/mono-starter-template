import { WorkspaceError } from '@your-project/workspace'
import { ZodError } from 'zod'

type SessionIdentity = { user: { id: string }; session: { activeOrganizationId?: string | null } }

/** HTTP clients must not bypass the stricter shared workspace/admin services. */
export function createAuthHttpBoundary(dependencies: {
  handle: (request: Request) => Promise<Response>
  getSession: (headers: Headers) => Promise<SessionIdentity | null>
  getUser: (userId: string) => Promise<unknown>
  requireMember: (userId: string, organizationId: string) => Promise<unknown>
}) {
  return async (request: Request) => {
    const url = new URL(request.url)
    let segments: string[]
    try {
      segments = decodeURIComponent(url.pathname).split('/').filter(Boolean)
    } catch {
      return Response.json({ error: 'Invalid path' }, { status: 400 })
    }
    const namespace = segments[2]?.toLowerCase()
    const operation = segments[3]
    if (namespace === 'admin') {
      return Response.json(
        { error: 'Use the authorized platform administration actions' },
        { status: 403 },
      )
    }
    if (namespace !== 'organization') return dependencies.handle(request)
    const reads = new Set([
      'list',
      'get-full-organization',
      'get-active-member',
      'get-active-member-role',
      'list-members',
    ])
    const readable = request.method === 'GET' && operation && reads.has(operation)
    const switching = request.method === 'POST' && operation === 'set-active'
    if ((!readable && !switching) || segments.length !== 4) {
      return Response.json({ error: 'Use the authorized workspace actions' }, { status: 403 })
    }
    try {
      const session = await dependencies.getSession(request.headers)
      if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 })
      await dependencies.getUser(session.user.id)
      if (operation !== 'list') {
        // Avoid disagreements between URL parsers over first/last repeated values.
        if ([...url.searchParams.keys()].some(key => url.searchParams.getAll(key).length > 1))
          return Response.json({ error: 'Duplicate query parameter' }, { status: 400 })
        const values: unknown = switching
          ? await request.clone().json()
          : Object.fromEntries(url.searchParams)
        if (typeof values !== 'object' || values === null || Array.isArray(values))
          return Response.json({ error: 'Invalid organization' }, { status: 400 })
        if ('organizationSlug' in values || 'organizationIdOrSlug' in values)
          return Response.json({ error: 'Use organizationId' }, { status: 400 })
        const activeOnly = operation === 'get-active-member'
        const requestedId = activeOnly
          ? session.session.activeOrganizationId
          : 'organizationId' in values
            ? values.organizationId
            : session.session.activeOrganizationId
        if (!(switching && requestedId === null)) {
          if (typeof requestedId !== 'string')
            return Response.json({ error: 'Select an organization' }, { status: 400 })
          await dependencies.requireMember(session.user.id, requestedId)
        }
      }
      return dependencies.handle(request)
    } catch (error) {
      if (error instanceof WorkspaceError)
        return Response.json(
          { error: error.message },
          { status: error.code === 'UNAUTHORIZED' ? 401 : 403 },
        )
      if (error instanceof ZodError || error instanceof SyntaxError)
        return Response.json({ error: 'Invalid request' }, { status: 400 })
      throw error
    }
  }
}
