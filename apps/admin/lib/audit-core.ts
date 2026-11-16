import { redactPayload } from './audit-payload'

type AuditContext = { actor?: { uid: string; organizationId?: string | null }; userAgent?: string }
type AuditEvent = AuditContext & {
  action: string
  args: unknown
  durationMs: number
  outcome: 'success' | 'rejected' | 'redirect' | 'error'
  errorType?: string
}

/** Dependency injection keeps the audit contract testable without a Next request. */
export function createAuditWrapper(dependencies: {
  context: () => Promise<AuditContext>
  write: (event: AuditEvent) => void
}) {
  return function withAudit<Args extends unknown[], Result>(
    action: string,
    fn: (...args: Args) => Promise<Result>,
  ) {
    return async (...args: Args): Promise<Result> => {
      const startedAt = performance.now()
      let context: AuditContext = {}
      try {
        context = await dependencies.context()
      } catch {
        /* The action authorizes independently. */
      }
      let sanitizedArgs: unknown = '[UNAVAILABLE]'
      try {
        sanitizedArgs = redactPayload(args)
      } catch {
        /* A getter or custom object must not stop the authorized operation. */
      }
      const base = { ...context, action, args: sanitizedArgs }
      const write = (outcome: AuditEvent['outcome'], errorType?: string) => {
        try {
          dependencies.write({
            ...base,
            durationMs: Math.round(performance.now() - startedAt),
            outcome,
            errorType,
          })
        } catch {
          /* Logging must not alter the operation result. */
        }
      }
      try {
        const result = await fn(...args)
        const rejected = typeof result === 'object' && result !== null && 'error' in result
        write(rejected ? 'rejected' : 'success')
        return result
      } catch (error) {
        const digest = error && typeof error === 'object' && 'digest' in error ? error.digest : null
        const redirected = typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
        // Error messages can contain SQL parameters. Log classification only.
        write(
          redirected ? 'redirect' : 'error',
          error instanceof Error ? error.name : 'UnknownError',
        )
        throw error
      }
    }
  }
}
