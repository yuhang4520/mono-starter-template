import Link from 'next/link'
import { getAgreementConfig } from '@/lib/agreement-config'

// Read deployment-specific operator information on each request, without a DB.
export const dynamic = 'force-dynamic'

export default function AgreementLayout({ children }: { children: React.ReactNode }) {
  const config = getAgreementConfig()
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground sm:px-8 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 border-b pb-6">
          <p className="mb-4 font-semibold">{config.appName}</p>
          <nav aria-label="协议导航" className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link
              className="underline underline-offset-4 focus-visible:outline-2"
              href="/app-agreement/privacy"
            >
              隐私政策
            </Link>
            <Link
              className="underline underline-offset-4 focus-visible:outline-2"
              href="/app-agreement/user"
            >
              用户协议
            </Link>
          </nav>
        </header>
        <aside role="note" className="mb-8 rounded-lg border bg-muted/50 p-4 text-sm leading-7">
          <p className="font-semibold">
            {config.isConfigured ? '模板示例正文，发布前须审核' : '模板示例 · 运营信息待配置'}
          </p>
          <p>
            以下内容是项目接入起点，尚未代表已审核的正式协议。运营方需按实际功能、数据处理方式、服务地区及第三方服务补充并审核后发布。
          </p>
        </aside>
        <article className="space-y-7 text-base leading-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:break-words">
          {children}
        </article>
        <footer className="mt-12 space-y-1 border-t pt-6 text-sm leading-7 text-muted-foreground">
          <p>运营方：{config.operatorName}</p>
          <p>
            联系邮箱：
            {config.contactEmail ? (
              <a className="underline underline-offset-4" href={`mailto:${config.contactEmail}`}>
                {config.contactEmail}
              </a>
            ) : (
              '待配置，当前未提供有效联系渠道'
            )}
          </p>
          <p>协议正文版本：{config.version}；生效日期：待运营方审核后填写。</p>
        </footer>
      </div>
    </main>
  )
}
