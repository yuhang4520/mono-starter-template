import Link from 'next/link'
import { getDashboardContext } from '@/lib/session'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function HomePage() {
  const { session, organizations, activeOrganization } = await getDashboardContext()
  return (
    <>
      <div className="border-b pb-6">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground">WORKSPACE</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">你好，{session.user.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {activeOrganization
            ? `当前团队：${activeOrganization.name}`
            : '选择或创建一个组织，开始团队协作。'}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>我的组织</CardTitle>
            <CardDescription>已加入 {organizations.length} 个组织</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/organizations">选择组织</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>团队成员</CardTitle>
            <CardDescription>查看成员，维护团队权限</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/members">查看成员</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>团队笔记</CardTitle>
            <CardDescription>共享记录，按组织隔离数据</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/notes">打开笔记</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="rounded-lg bg-muted/50 p-5 text-sm">
        <p className="font-medium">当前账号</p>
        <p className="mt-1 text-muted-foreground">{session.user.email}</p>
        <p className="mt-1 text-muted-foreground">
          {activeOrganization ? `组织角色：${activeOrganization.role}` : '尚未选择组织'}
        </p>
      </div>
    </>
  )
}
