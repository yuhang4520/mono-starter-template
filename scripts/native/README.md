# 客户端构建与发布

这些脚本从 Wabash 的打包故障处理机制抽取，移除了产品名、云账号、固定 bucket 和支付模块。默认仅运行本地检查；云端发布必须手动触发并显式启用。三个 workflow 都不发送消息、不自动提交代码。

## H5 / 微信小程序

运行 `Build or publish client`，选择 `h5` 或 `mp-weixin`。`publish=false` 只构建并保存 GitHub Artifact；`publish=true` 还要求 `ENABLE_CLIENT_PUBLISH=true` 且来源为 main。

GitHub Environment 名称为 `client-production`。配置 Variables：

- `PUBLIC_API_URL`：可公开访问的 API 地址。
- `PRIVACY_URL`、`AGREEMENT_URL`、`LEGAL_VERSION`：真实公开协议地址与同意版本；统一注入客户端 `VITE_PRIVACY_URL`、`VITE_AGREEMENT_URL`、`VITE_LEGAL_VERSION`。
- `MP_WEIXIN_APP_ID`：微信构建/上传的 AppID。
- `CLIENT_STORAGE_REGION`、`CLIENT_STORAGE_BUCKET`、`CLIENT_STORAGE_ENDPOINT`：S3/OSS 兼容存储；AWS S3 可不设置 endpoint。
- `CLIENT_H5_PREFIX`：H5 独占目录，默认 `sites/app`。不允许使用整个 bucket 根路径。

Secrets：`MP_WEIXIN_UPLOAD_KEY`，以及上传存储使用的 `CLIENT_STORAGE_ACCESS_KEY_ID` / `CLIENT_STORAGE_SECRET_ACCESS_KEY` / 可选 `CLIENT_STORAGE_SESSION_TOKEN`。这些变量仅注入上传步骤。

H5 资源先上传，`index.html` 随后上传，`release.json` 最后更新；文件使用 no-cache，保留旧资源以兼容已打开的页面。存储需配置静态站点、正确 MIME 类型及历史路由回退（按应用路由模式决定）。微信流水线执行主包/分包预算检查，再上传开发版本；微信审核和正式发布仍由发布者在平台操作。版本元数据也保存在 Artifact，微信元数据不占代码包预算。

## Android / iOS

运行 `Package native clients`；仓库级 Variable `ENABLE_NATIVE_PACKAGING=true` 才可执行，来源必须为 main。选择 both 时 iOS 与 Android 独立运行，Android 变体 `max-parallel=1`，不会相互取消已有云打包。

仓库级 Variable `ANDROID_VARIANTS_JSON` 示例：

```json
[{"name":"default","bundle":"com.example.workspace"},{"name":"alternate","bundle":"com.example.workspace.alternate"}]
```

每个变体包含唯一 name 和 bundle，最多五个。`client-production` Variables：

- `APP_NAME`、`DCLOUD_APP_ID`（真实注册的 `__UNI__...`）、`IOS_BUNDLE_ID`。
- `HX_VERSION` 与 `HX_SHA256`：HBuilderX Linux 完整版版本与发行包 SHA-256，必须相互对应；校验后才运行下载的 CLI。
- `PUBLIC_API_URL`、`PRIVACY_URL`、`AGREEMENT_URL`、`LEGAL_VERSION`。协议版本与客户端 `VITE_LEGAL_VERSION`、Android 原生 `androidPrivacy.json.version` 保持一致。

Secrets：

- `DCLOUD_USERNAME`、`DCLOUD_PASSWORD`。
- Android：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`、`ANDROID_KEYSTORE_PASSWORD`。
- iOS：`IOS_P12_BASE64`、`IOS_PROFILE_BASE64`、`IOS_CERT_PASSWORD`。

所有正式发布必须显式填写 `LEGAL_VERSION`，协议与 API 地址必须使用公共 HTTPS；默认 example 域名、localhost、私网/回环地址和带凭据 URL 会在构建/打包前被拒绝。仅 H5/微信 `publish=false` 的演示构建显式设置 `VITE_DEPLOY_ENV=local` 并允许本地默认值；这类 Artifact 用于本地预览，不能作为正式发布包。初始化生成的 App 环境也标记为 `local`，因此本地 production-mode 构建仍能打开回环地址的协议页。正式三端发布强制设置 `VITE_DEPLOY_ENV=production`，覆盖环境文件中的 local；原生打包脚本再次强制该值，协议/API 地址仍需公共 HTTPS。协议变更时递增 `LEGAL_VERSION` 并重新构建，使原生弹窗与应用内同意状态一并失效；不能只修改网页正文而遗漏版本。

准备脚本通过环境读取并 JSON 编码签名配置，不拼接 shell，也不打印证书密码。初始化与打包 CLI 输出均先脱敏再显示；排队重试只允许最终一次尝试的输出进入产物收集。签名文件和原始云日志会被清理，即使日志脱敏失败也执行清理；失败 Artifact 只保留错误摘要与脱敏日志。登录、项目导入、排队和下载均有超时。云端额度不足不盲目重试。

版本为 `1.0.<run_number>`，build code 为 `run_number * 1000 + run_attempt`。APK 先检查 ZIP 完整性、AndroidManifest.xml 和 classes.dex，再通过 Android SDK `apkanalyzer manifest application-id/version-name/version-code` 读取编译后的真实 manifest，核对变体 bundle、版本名与版本号；产物收集、生成 metadata、分发前均独立校验。工具缺失、解析错误、超时或身份不匹配都会阻断，不降级为仅检查 ZIP。IPA 检查 executable、bundle ID、version 和 build number。结构检查不等于商店审核、签名可信验证或真机验收。

每个成功产物包含 `metadata.json`：仓库、commit、分支、run id/attempt、版本、包名和 SHA-256。Artifact 名称包含平台、变体和 attempt，保留 14 天。只有当前成功 attempt 的产物可以分发；重新运行部分失败任务后，旧 attempt 的另一个平台产物不会被自动混用。

## 按来源 run 分发

运行 `Distribute verified native artifact`，填写成功打包 run id、完整 commit SHA、平台、target（iOS 填 `ios`）、目的地 `s3` 或 `testflight`。需要 `ENABLE_NATIVE_DISTRIBUTION=true`，当前 workflow 从 main 执行。

分发前查询 GitHub API，确认同一仓库、指定 SHA、main、正确打包 workflow、手动触发且整个来源 run 成功；再用 API 返回的 run number/attempt 推导预期版本，核对 Artifact 元数据、实际包内版本与文件 SHA-256。不会按“最新一个名字相似的包”猜测来源。

- S3/OSS：沿用存储 Secrets/Variables，`CLIENT_NATIVE_PREFIX` 默认 `native`；包保存到平台/变体/版本/attempt 路径。没有可被旧版本覆盖的 latest 指针。
- TestFlight：Secrets `ASC_KEY_ID`、`ASC_ISSUER_ID`、`ASC_API_KEY_BASE64`；仅 iOS 可选，macOS runner 使用 `xcrun altool` 上传并清理本次生成的临时 P8；如同名签名密钥已存在则停止，不覆盖或删除它。成功表示上传命令被接受，不代表 Apple 后续处理或审核完成。

Ubuntu GitHub-hosted runner 需要可用的 AWS CLI（S3/OSS 发布）和 GNU timeout（云打包）。Android 打包与分发工作流使用 setup-java（Temurin 17）及 setup-android 安装 SDK Command-Line Tools，并检查 `apkanalyzer` 可执行。自托管 runner 需准备这些工具与 Node/Python。离线运行真实 APK 校验也需要 Java 与 Android SDK，参见 [apkanalyzer 官方命令文档](https://developer.android.com/tools/apkanalyzer)。

## 本地验证

```sh
python3 -B -m unittest discover -s scripts/native -p 'test_*.py'
node --test scripts/native/source-run.test.cjs scripts/package-size.test.mjs
node scripts/check-package-size.mjs apps/app/dist/build/mp-weixin
bash -n scripts/native/package.sh scripts/native/initialize_cloud_project.sh
```

Linux CI 会运行超时/重试测试；没有 GNU timeout 的 macOS 会明确跳过对应五项，不算云端验收。所有本地测试使用假 CLI 或本地包 fixture，不调用 DCloud、微信、S3 或 Apple。
