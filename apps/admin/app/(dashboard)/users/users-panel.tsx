'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Panel } from '@/components/panel/panel'
import { banUser, unbanUser, revokeUserSessions } from '@/lib/platform-user-actions'
import type { ActionResult } from '@/lib/action-result'
import type { PanelColumn } from '@/components/panel/types'

type User = {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean | null
  banExpires: Date | string | null
}
const isBanned = (user: User) =>
  user.banned && (!user.banExpires || new Date(user.banExpires).getTime() > Date.now())
const columns: PanelColumn<User>[] = [
  { accessorKey: 'name', header: '姓名' },
  { accessorKey: 'email', header: '邮箱' },
  {
    accessorKey: 'role',
    header: '平台角色',
    cell: ({ row }) => (row.original.role === 'admin' ? '管理员' : '普通用户'),
  },
  {
    id: 'status',
    header: '账号状态',
    cell: ({ row }) => (isBanned(row.original) ? '已禁用' : '正常'),
  },
]

export function UsersPanel({
  users,
  total,
  page,
  actorId,
}: {
  users: User[]
  total: number
  page: number
  actorId: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const canChange = (user: User) => user.id !== actorId && (!user.role || user.role === 'user')
  async function run(operation: () => Promise<ActionResult<unknown>>) {
    setPending(true)
    try {
      const result = await operation()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('操作完成，目标用户需要重新登录')
      router.refresh()
    } catch {
      toast.error('操作失败，请稍后重试')
    } finally {
      setPending(false)
    }
  }
  return (
    <Panel<User, Record<string, never>>
      title="用户管理"
      description="管理普通用户的登录权限。当前账号和其他管理员不允许在此修改。"
      columns={columns}
      fields={[]}
      data={users}
      rowActions={[
        {
          label: '禁用账号',
          className: 'text-destructive',
          isVisible: user => canChange(user) && !isBanned(user),
          isDisabled: () => pending,
          onClick: user => {
            if (window.confirm(`确定禁用 ${user.name} 并撤销其全部会话？`))
              return run(() => banUser({ userId: user.id }))
          },
        },
        {
          label: '解除禁用',
          isVisible: user => canChange(user) && !!isBanned(user),
          isDisabled: () => pending,
          onClick: user => run(() => unbanUser({ userId: user.id })),
        },
        {
          label: '撤销全部会话',
          isVisible: canChange,
          isDisabled: () => pending,
          onClick: user => {
            if (window.confirm(`确定让 ${user.name} 的全部设备退出登录？`))
              return run(() => revokeUserSessions({ userId: user.id }))
          },
        },
      ]}
      pagination={{
        page,
        pageSize: 20,
        total,
        onPageChange: next => router.push(`/users?page=${next}`),
      }}
    />
  )
}
