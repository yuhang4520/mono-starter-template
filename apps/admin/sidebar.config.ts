import { IconBuildingCommunity, IconHome, IconNotes, IconUsers } from '@tabler/icons-react'
import type { MenuItem } from '@/types/sidebar-menu'

export const menus: MenuItem[] = [
  { title: '工作台', href: '/', icon: IconHome },
  { title: '组织管理', href: '/organizations', icon: IconBuildingCommunity },
  { title: '成员管理', href: '/members', icon: IconUsers },
  { title: '团队笔记', href: '/notes', icon: IconNotes },
  { title: '用户管理', href: '/users', icon: IconUsers, roles: ['admin'] },
]
