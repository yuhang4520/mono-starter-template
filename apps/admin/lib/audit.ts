import { headers } from 'next/headers'
import { getRequestSession } from './session'
import { logger } from './logger'
import { createAuditWrapper } from './audit-core'

const auditLogger = logger.child({ component: 'audit' })

export const withAudit = createAuditWrapper({
  async context() {
    const session = await getRequestSession()
    return {
      actor: session
        ? { uid: session.user.id, organizationId: session.session.activeOrganizationId }
        : undefined,
      userAgent: (await headers()).get('user-agent')?.slice(0, 256),
    }
  },
  write(event) {
    auditLogger[event.outcome === 'error' ? 'error' : 'info'](event, 'Server action completed')
  },
})
