import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function OrganizationRequired() {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <h2 className="text-lg font-semibold">先选择一个组织</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        在左侧切换已有组织，或创建你的第一个团队。
      </p>
      <Button asChild className="mt-5">
        <Link href="/organizations">管理组织</Link>
      </Button>
    </div>
  )
}
