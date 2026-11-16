'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { workspace } from '@your-project/workspace'
import { auth } from './auth'
import { requireRequestSession } from './session'
import { withAudit } from './audit'
import { actionResult } from './action-result'

const organizationSchema = z.object({ organizationId: z.uuid('请选择有效组织') })
const noteSchema = organizationSchema.extend({
  title: z.string().trim().min(1, '请输入标题').max(200, '标题不能超过 200 字'),
  body: z.string().max(20000, '内容不能超过 20000 字').default(''),
})
const memberSchema = organizationSchema.extend({ memberId: z.uuid() })
const editableRole = z.enum(['admin', 'member'])

export const createOrganization = withAudit('organizations:create', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const values = z
      .object({
        name: z.string().trim().min(1, '请输入组织名称').max(100),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(60)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '组织标识只能使用小写字母、数字和连字符'),
      })
      .parse(input)
    const organization = await workspace.createOrganization(session.user.id, values)
    // Creation succeeds independently of changing the active organization.
    revalidatePath('/', 'layout')
    return organization
  })
})

export const switchOrganization = withAudit('organizations:switch', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const { organizationId } = organizationSchema.parse(input)
    await workspace.requireMember(session.user.id, organizationId)
    await auth.api.setActiveOrganization({ headers: await headers(), body: { organizationId } })
    revalidatePath('/', 'layout')
    return null
  })
})

export const addMember = withAudit('members:add', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const values = organizationSchema
      .extend({ email: z.email('请输入有效邮箱').max(254), role: editableRole })
      .parse(input)
    const member = await workspace.addMember(session.user.id, values)
    revalidatePath('/members')
    return member
  })
})

export const updateMemberRole = withAudit('members:updateRole', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const values = memberSchema.extend({ role: editableRole }).parse(input)
    await workspace.updateMemberRole(session.user.id, values)
    revalidatePath('/', 'layout')
    return null
  })
})

export const removeMember = withAudit('members:remove', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    await workspace.removeMember(session.user.id, memberSchema.parse(input))
    revalidatePath('/', 'layout')
    return null
  })
})

export const createNote = withAudit('notes:create', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const note = await workspace.createNote(session.user.id, noteSchema.parse(input))
    revalidatePath('/notes')
    return note
  })
})

export const updateNote = withAudit('notes:update', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    const note = await workspace.updateNote(
      session.user.id,
      noteSchema.extend({ id: z.uuid() }).parse(input),
    )
    revalidatePath('/notes')
    return note
  })
})

export const deleteNote = withAudit('notes:delete', async (input: unknown) => {
  const session = await requireRequestSession()
  return actionResult(async () => {
    await workspace.deleteNote(
      session.user.id,
      organizationSchema.extend({ id: z.uuid() }).parse(input),
    )
    revalidatePath('/notes')
    return null
  })
})
