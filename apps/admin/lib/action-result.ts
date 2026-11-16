import { WorkspaceError } from '@your-project/workspace'
import { ZodError } from 'zod'

export type ActionResult<Value> = { ok: true; value: Value } | { ok: false; error: string }

export async function actionResult<Value>(
  operation: () => Promise<Value>,
): Promise<ActionResult<Value>> {
  try {
    return { ok: true, value: await operation() }
  } catch (error) {
    if (error instanceof ZodError)
      return { ok: false, error: error.issues[0]?.message ?? '输入不正确' }
    if (error instanceof WorkspaceError) return { ok: false, error: error.message }
    throw error
  }
}
