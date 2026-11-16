import { db } from 'db/client'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth/minimal'
import { nextCookies } from 'better-auth/next-js'
import { admin as adminPlugin, organization, phoneNumber, username } from 'better-auth/plugins'
import {
  platformAccessControl,
  platformRoles,
  tenantAccessControl,
  tenantRoles,
} from './permissions'

/**
 * Better Auth 配置
 *
 * ## 插件说明
 * - phoneNumber: 支持手机号登录
 * - username: 支持用户名登录
 * - admin: 平台管理员权限
 * - organization: 多租户/组织管理
 *
 * ## 环境变量
 * - BETTER_AUTH_URL: 认证回调地址
 * - BETTER_AUTH_SECRET: 认证密钥
 * - DATABASE_URL: 数据库连接
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  plugins: [
    nextCookies(),
    phoneNumber(),
    username(),
    adminPlugin({
      ac: platformAccessControl,
      roles: platformRoles,
    }),
    organization({
      ac: tenantAccessControl,
      roles: tenantRoles,
    }),
  ],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          return {
            data: {
              ...user,
              // Public signup never grants administrative privileges.
              // Provision the first administrator with the explicit bootstrap CLI.
              role: 'user',
            },
          }
        },
      },
    },
  },
})
