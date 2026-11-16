# 多端客户端

基于 Vue 3、uni-app、Pinia、tRPC 和 UnoCSS。登录页与首页提供手机号密码登录、当前用户、个人图片附件上传/预览、退出登录的最小闭环。账号在 Admin 注册或由管理员创建，客户端不提供公开注册入口。

## 开发与检查

在仓库根目录执行：

```sh
pnpm --dir apps/app dev:h5
pnpm --dir apps/app dev:mp-weixin
pnpm --dir apps/app type-check
pnpm --dir apps/app test
pnpm --dir apps/app build:h5
pnpm --dir apps/app build:mp-weixin
pnpm --dir apps/app build:custom app
pnpm --dir apps/app build:custom app-harmony
```

`app` 构建只验证 Android/iOS 共用资源；`app-harmony` 构建只验证鸿蒙资源。安装包签名、云打包及真机验证是独立步骤。

## 配置

复制 `env/.env.example` 为 `env/.env.local`，或运行根目录初始化脚本。`VITE_SERVER_URL` 指向 API；原生设备必须使用设备可以访问的地址，不能使用电脑的 `localhost`。`VITE_APP_VERSION` 为发布版本，流水线负责注入。

## 认证与请求

- Admin 使用 Better Auth Cookie；App 使用 API 签发的 access/refresh token。
- H5 使用 tRPC HTTP link，认证请求单独发送，业务请求可批量；小程序、Android、iOS、鸿蒙使用 `uni.request`。
- 401 最多刷新重试一次；多个请求共用一个刷新操作。登录失败与退出请求不触发自动刷新。
- 只有明确的身份失效会清理登录态。网络中断、服务端 5xx、响应格式错误会保留凭据，供用户重试。
- 登录账号替换/退出会增加会话版本。旧请求的成功响应、失败响应和刷新结果不得写入新账号；普通同账号刷新不改变版本。
- AbortSignal 与取消订阅会终止当前请求，并阻止刷新完成后重新发送请求。
- 新增受保护页面需在 `onShow` 调用 `requireLogin()`，导航拦截器不能代替冷启动/深链接检查。真正的数据权限始终由服务端检查。
- 登录后的 redirect 只接受 `safeLoginRedirect` 明确列出的内部页面，不接受外部 URL 或 WebView 转发目标。

## 文件

`POST /api/upload` 使用 multipart 字段 `file`，传 Bearer access token，返回 `{ key }`。`GET /api/files?key=...` 返回短期签名 URL。首页示例选择图片；API 同时可支持 PDF 等明确允许的类型。客户端不决定存储路径或读取权限，也不保存服务端存储凭据。

## 测试边界

`test/` 覆盖并发刷新、账号替换、旧成功响应隔离、取消/重试、网络失败、原生传输协议与 AbortSignal 降级。真实登录/上传还需要启动 API、数据库和对象存储；各设备的权限弹窗与系统图片选择器需要真机验收。
