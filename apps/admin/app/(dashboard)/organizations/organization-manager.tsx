'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Building2, Check } from 'lucide-react'
import { createOrganization, switchOrganization } from '@/lib/workspace-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Organization = {
  id: string
  name: string
  slug: string
  role: string
  locked?: boolean | null
}

export function OrganizationManager({
  organizations,
  activeId,
}: {
  organizations: Organization[]
  activeId?: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')

  async function select(id: string) {
    const result = await switchOrganization({ organizationId: id })
    if (!result.ok) throw new Error(result.error)
    router.refresh()
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const result = await createOrganization({ name, slug })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setName('')
      setSlug('')
      toast.success('组织已创建')
      await select(result.value.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败，请稍后重试')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">组织管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">选择工作空间，组织之间的数据独立保存。</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {organizations.length === 0 && (
            <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
              你还没有加入组织。创建一个组织后，你将成为组织所有者。
            </p>
          )}
          {organizations.map(organization => (
            <div key={organization.id} className="flex items-center gap-4 rounded-xl border p-4">
              <Building2 className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-medium">{organization.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {organization.slug} · {organization.role}
                  {organization.locked ? ' · 已锁定' : ''}
                </p>
              </div>
              <Button
                variant={organization.id === activeId ? 'secondary' : 'outline'}
                disabled={pending || organization.id === activeId || !!organization.locked}
                onClick={async () => {
                  setPending(true)
                  try {
                    await select(organization.id)
                  } catch (cause) {
                    toast.error(cause instanceof Error ? cause.message : '切换失败')
                  } finally {
                    setPending(false)
                  }
                }}
              >
                {organization.id === activeId ? (
                  <>
                    <Check className="size-4" />
                    当前组织
                  </>
                ) : (
                  '进入'
                )}
              </Button>
            </div>
          ))}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>创建组织</CardTitle>
            <CardDescription>为一个独立团队建立工作空间。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="organization-name">组织名称</Label>
                <Input
                  id="organization-name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="例如：产品团队"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-slug">组织标识</Label>
                <Input
                  id="organization-slug"
                  required
                  minLength={2}
                  maxLength={60}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={slug}
                  onChange={event => setSlug(event.target.value)}
                  placeholder="product-team"
                />
                <p className="text-xs text-muted-foreground">
                  使用小写字母、数字与连字符，全局唯一。
                </p>
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? '处理中…' : '创建组织'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
