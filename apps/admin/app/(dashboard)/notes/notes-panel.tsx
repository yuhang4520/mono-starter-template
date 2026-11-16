'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { z } from 'zod'
import { Panel } from '@/components/panel/panel'
import { createNote, updateNote, deleteNote } from '@/lib/workspace-actions'
import type { ActionResult } from '@/lib/action-result'
import type { PanelField, PanelColumn } from '@/components/panel/types'

type Note = { id: string; title: string; body: string; updatedAt: Date | string }
type NoteValues = { title: string; body: string }

const fields: PanelField<NoteValues>[] = [
  {
    name: 'title',
    label: '标题',
    type: 'text',
    rules: z.string().trim().min(1, '请输入标题').max(200),
    defaultValue: '',
  },
  { name: 'body', label: '内容', type: 'textarea', rules: z.string().max(20000), defaultValue: '' },
]
const columns: PanelColumn<Note>[] = [
  {
    accessorKey: 'title',
    header: '标题',
    cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
  },
  {
    accessorKey: 'body',
    header: '内容',
    cell: ({ row }) =>
      row.original.body ? (
        <details className="max-w-lg">
          <summary className="cursor-pointer text-sm underline underline-offset-4">
            查看完整内容
          </summary>
          <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground">
            {row.original.body}
          </p>
        </details>
      ) : (
        '—'
      ),
  },
  {
    accessorKey: 'updatedAt',
    header: '更新时间（UTC）',
    cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString('zh-CN', { timeZone: 'UTC' }),
  },
]

export function NotesPanel({
  organizationId,
  notes,
  total,
  page,
  pageSize,
  canWrite,
}: {
  organizationId: string
  notes: Note[]
  total: number
  page: number
  pageSize: number
  canWrite: boolean
}) {
  const router = useRouter()
  async function save(operation: () => Promise<ActionResult<unknown>>) {
    try {
      const result = await operation()
      if (!result.ok) throw new Error(result.error)
      toast.success('已保存')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败，请重试')
      throw error
    }
  }
  return (
    <Panel<Note, NoteValues>
      title="团队笔记"
      description={canWrite ? '记录团队信息，与当前组织成员共享。' : '你拥有当前组织的只读权限。'}
      columns={columns}
      fields={fields}
      data={notes}
      onCreate={
        canWrite ? values => save(() => createNote({ organizationId, ...values })) : undefined
      }
      onUpdate={
        canWrite
          ? (values, original) =>
              save(() => updateNote({ organizationId, id: original.id, ...values }))
          : undefined
      }
      rowActions={
        canWrite
          ? [
              {
                label: '删除',
                icon: Trash2,
                className: 'text-destructive',
                onClick: async note => {
                  if (!window.confirm(`确定删除“${note.title}”？`)) return
                  try {
                    await save(() => deleteNote({ organizationId, id: note.id }))
                  } catch {
                    /* Error already shown; keep the page usable. */
                  }
                },
              },
            ]
          : undefined
      }
      pagination={{
        page,
        pageSize,
        total,
        onPageChange: nextPage => router.push(`/notes?page=${nextPage}`),
      }}
    />
  )
}
