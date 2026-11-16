'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { addMember, updateMemberRole, removeMember } from '@/lib/workspace-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ActionResult } from '@/lib/action-result'

type Member = { id: string; userId: string; name: string; email: string; role: string }
const selectClass = 'h-9 rounded-md border bg-background px-3 text-sm'

export function MembersManager({
  organizationId,
  members,
  currentRole,
}: {
  organizationId: string
  members: Member[]
  currentRole: string
}) {
  const router = useRouter()
  const canManage = currentRole === 'owner' || currentRole === 'admin'
  const isOwner = currentRole === 'owner'
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')

  async function run(operation: () => Promise<ActionResult<unknown>>, message: string) {
    setPending(true)
    try {
      const result = await operation()
      if (!result.ok) {
        toast.error(result.error)
        return false
      }
      toast.success(message)
      router.refresh()
      return true
    } catch {
      toast.error('操作失败，请稍后重试')
      return false
    } finally {
      setPending(false)
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await run(() => addMember({ organizationId, email, role }), '成员已添加')) setEmail('')
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">成员管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          普通成员可读取团队笔记，管理员可编辑内容和管理成员。
        </p>
      </div>
      {canManage && (
        <form className="flex flex-wrap items-end gap-3 rounded-xl border p-5" onSubmit={handleAdd}>
          <div className="min-w-52 flex-1 space-y-2">
            <Label htmlFor="member-email">已注册账号的邮箱</Label>
            <Input
              id="member-email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="填写成员个人工作台显示的邮箱"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-role">组织角色</Label>
            <select
              id="member-role"
              className={selectClass}
              value={role}
              onChange={event => setRole(event.target.value === 'admin' ? 'admin' : 'member')}
            >
              <option value="member">普通成员</option>
              {isOwner && <option value="admin">管理员</option>}
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            添加成员
          </Button>
        </form>
      )}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>成员</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              {canManage && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(member => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  {isOwner && member.role !== 'owner' ? (
                    <select
                      className={selectClass}
                      aria-label={`${member.name}的角色`}
                      value={member.role}
                      disabled={pending}
                      onChange={event => {
                        const nextRole = event.target.value === 'admin' ? 'admin' : 'member'
                        void run(
                          () =>
                            updateMemberRole({
                              organizationId,
                              memberId: member.id,
                              role: nextRole,
                            }),
                          '角色已更新',
                        )
                      }}
                    >
                      <option value="member">普通成员</option>
                      <option value="admin">管理员</option>
                    </select>
                  ) : member.role === 'owner' ? (
                    '所有者'
                  ) : member.role === 'admin' ? (
                    '管理员'
                  ) : (
                    '普通成员'
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    {(isOwner ? member.role !== 'owner' : member.role === 'member') && (
                      <Button
                        variant="ghost"
                        className="text-destructive"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`确定将 ${member.name} 移出当前组织？`))
                            void run(
                              () => removeMember({ organizationId, memberId: member.id }),
                              '成员已移除',
                            )
                        }}
                      >
                        移除
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        组织所有者不可通过此页面移除或降级。成员权限修改会在下一次请求生效。
      </p>
    </>
  )
}
