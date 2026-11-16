import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { TeamSwitcher } from '@/components/team-switcher'
import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import { SiteHeader } from '@/components/site-header'
import { getDashboardContext } from '@/lib/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, organizations, activeOrganization } = await getDashboardContext()
  const role =
    session.user.role === 'admin' ? 'admin' : `user:${activeOrganization?.role ?? 'member'}`
  return (
    <SidebarProvider style={{ '--header-height': '3.5rem' } as React.CSSProperties}>
      <Sidebar variant="inset">
        <SidebarHeader>
          <TeamSwitcher teams={organizations} activeId={activeOrganization?.id} />
        </SidebarHeader>
        <SidebarContent>
          <NavMain role={role} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={session.user} />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
