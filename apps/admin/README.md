# Admin

Next.js 管理后台使用 Better Auth Cookie session；App 的 JWT 由 API 单独处理。

## 开发与验证

在仓库根目录完成初始化、安装依赖和数据库迁移后运行：

```sh
pnpm --dir apps/admin dev
pnpm --dir apps/admin type-check
pnpm --dir apps/admin lint
pnpm --dir apps/admin test
pnpm --dir apps/admin build
```

dev/start 会先用 Next 的环境文件加载规则读取配置再启动 CLI，使初始化分配的 PORT 生效；系统进程环境变量和显式 --port 参数仍优先。

认证界面提供中英文翻译，示例业务界面使用中文。翻译使用稳定 key，构建不会重新抽取或清空语言文件。

## 页面与权限

- `/`：当前账号、组织和功能入口。
- `/organizations`：查看已加入组织、创建组织、切换当前组织。组织创建与 owner 成员创建在同一事务中。
- `/members`：组织成员只读列表；owner 可设置 admin/member、移除非 owner；admin 只能添加/移除普通成员。
- `/notes`：分页团队笔记；owner/admin 可新增、编辑、删除，member 只读。所有数据操作都带显式 organizationId。
- `/users`：仅平台 admin 可以分页查看全局用户、禁用/解除禁用普通账号、撤销其全部会话。不允许修改自己或其他管理员，不提供角色提升入口。
- `/api/health`：无数据库依赖的存活检查。
- `/app-agreement/privacy`、`/app-agreement/user`：未登录可读的隐私政策与用户协议示例，无数据库查询。仅这两个完整路径跳过页面登录检查，其他同前缀路径仍受保护。

菜单可见性仅用于界面展示。Server Action 每次解析当前 session，调用共享服务重新查询当前用户、成员关系及角色。平台管理写操作在事务内锁定 actor 与目标用户，重新确认权限；禁用、解除禁用和撤销会话都会删除目标账号当前 session，旧 App JWT 也会失效。

HTTP 入口禁止 Better Auth 原始组织写入端点及 `/api/auth/admin/*`，避免绕过组织锁定、角色边界和审计。组织仅保留列表、详情、成员读取及 `set-active`；后者同样重新校验成员和锁定状态。业务写入统一经过受审计的 Server Actions 和共享服务，直接调用插件写接口会返回 403。组织读取/切换使用 organizationId，不支持 slug 参数。

公开注册始终为普通用户，填写某个手机号不会成为管理员。首管理员通过仓库的显式 bootstrap 命令创建；手机号只是账号名，模板没有提供短信所有权验证。添加成员使用其已注册账号的邮箱；默认手机号注册账号可在工作台查看系统生成的邮箱。此操作不会发送邮件或邀请通知。

## 审计

`withAudit` 记录动作、当前操作者、组织、耗时及成功/拒绝/错误结果。密码、token、Cookie、凭据、笔记正文不进入日志，手机号部分遮蔽；文件只记录元信息，集合和嵌套深度受限。日志失败不改变业务操作结果。日志中的浏览器信息不是鉴权依据。

## 配置

从 `.env.example` 配置 `DATABASE_URL`、`BETTER_AUTH_SECRET` 和 `BETTER_AUTH_URL`；生产认证地址必须使用实际 HTTPS 域名。Node 进程环境变量优先于本地 `.env`。不要把真实 `.env` 放入镜像或版本库。

公开协议页使用服务端变量 `LEGAL_APP_NAME`、`LEGAL_OPERATOR_NAME`、`LEGAL_CONTACT_EMAIL`。缺少有效值时会显示“运营信息待配置”，不会生成虚假联系方式。配置完运营信息后，正文仍标明模板示例：发布前需按实际功能审核并补全数据保存期限、服务商、注销流程、生效日期等内容，再移除示例提示。它不是已完成的合规审查或正式法律文本。

`LEGAL_VERSION` 控制正文展示版本，默认 `1`；更新正式协议时，同步更新 App 的 `VITE_LEGAL_VERSION` 和部署配置中的 `LEGAL_VERSION`，以便提示用户重新确认。

协议路由强制动态渲染，运营信息读取运行时环境变量，不在构建阶段固化；页面本身与公开路由放行均不查询数据库。

`TEST_DATABASE_URL` 仅用于隔离测试数据库。未配置时，平台用户及真实认证 HTTP 集成测试会明确跳过；普通审计和 HTTP 边界测试无需数据库。集成测试创建随机标识的测试账号并在结束时清理，不得将其指向业务数据库。

部署、迁移与回滚见仓库根目录说明。
