'use client'

import { Building2, ChevronsUpDown, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { switchOrganization } from '@/lib/workspace-actions'
import { toast } from 'sonner'

export function TeamSwitcher({
  teams,
  activeId,
}: {
  teams: {
    id: string
    name: string
    role: string
    locked?: boolean | null
  }[]
  activeId?: string
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  const activeTeam = teams.find(team => team.id === activeId)
  const handleTeamSwitch = async (id: string) => {
    setSwitching(true)
    try {
      const result = await switchOrganization({ organizationId: id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.refresh()
    } catch {
      toast.error('切换失败，请稍后重试')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={switching}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeTeam?.name ?? '选择组织'}</span>
                <span className="truncate text-xs">{activeTeam?.role ?? '团队工作空间'}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              我的组织
            </DropdownMenuLabel>
            {teams.map(team => (
              <DropdownMenuItem
                key={team.id}
                disabled={switching || !!team.locked}
                onClick={() => handleTeamSwitch(team.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Building2 className="size-3.5 shrink-0" />
                </div>
                {team.name}
                <DropdownMenuShortcut>{team.role}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild>
              <Link href="/organizations">
                <Settings2 className="size-4" />
                管理组织
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
