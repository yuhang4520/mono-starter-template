/**
 * 侧边栏导航配置
 *
 * ## 配置说明
 *
 * ### MenuItem 字段
 * - `title`: 菜单项显示名称（支持国际化 key）
 * - `href`: 点击跳转的链接，支持外部链接（以 http 开头）或内部路由
 * - `icon`: 菜单图标组件，可使用 @tabler/icons-react 中的图标
 * - `roles`: （可选）允许看到的角色列表，支持 `admin`, `user:owner`, `user:admin`, `user:member` 等
 * - `items`: （可选）子菜单数组，结构与 MenuItem 相同（不含 icon）
 *
 * ### 角色权限说明
 * 本项目使用 Better Auth 的 RBAC 权限系统：
 * - `admin`: 平台管理员，拥有所有权限
 * - `user:owner`: 组织所有者
 * - `user:admin`: 组织管理员
 * - `user:member`: 普通成员
 *
 * ### 使用示例
 *
 * ```ts
 * // 仅管理员可见
 * { title: '系统设置', href: '/settings', roles: ['admin'] }
 *
 * // 组织管理者和所有者可见
 * { title: '组织管理', href: '/org', roles: ['user:owner', 'user:admin'] }
 *
 * // 所有登录用户可见
 * { title: '个人资料', href: '/profile' }
 * ```
 */

import type { MenuItem } from '@/components/kibo-ui/sidebar'

export const menus: MenuItem[] = [
  {
    title: '首页',
    href: '/',
    icon: null, // 可替换为 IconDashboard 等图标组件
  },
  // 示例：添加更多菜单项
  // {
  //   title: '管理',
  //   href: '#',
  //   icon: IconSettings,
  //   roles: ['admin'],
  //   items: [
  //     { title: '用户管理', href: '/admin/users' },
  //     { title: '系统设置', href: '/admin/settings' },
  //   ],
  // },
]
