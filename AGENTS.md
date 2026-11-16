# 项目协作约定

- 先读 README 与相关调用点，保持 pnpm workspace、现有组件和服务边界。
- Admin 使用 Cookie，App 使用绑定数据库会话的 JWT。每个服务端操作独立验证用户和组织成员关系，不能只靠菜单或客户端组织 ID。
- 通用组织业务放 packages/workspace，schema/migration 放 packages/db。客户端只导入 API 类型，不导入服务端实现。
- 修改 schema 时生成并审查增量迁移，不改已提交迁移。生成、执行迁移和部署是三个不同动作；执行前确认目标库与授权。
- 优先运行受影响包 type-check、test、lint/build。API/Admin 集成测试必须显式指定一次性 TEST_DATABASE_URL，不使用已有应用数据库充当测试库。
- UI修改验证实际页面；uni-app同时检查H5、小程序与原生条件分支，资源编译不代表真机验收。
- 新配置同步 .env.example 与部署文档。禁止提交真实凭据、.env、签名证书、Terraform state。
- 云发布默认关闭。工作流和脚本修改必须检查失败路径、产物来源、迁移门禁、超时和敏感日志。
- 提交仅包含本次相关修改；没有用户指令不提交、推送或部署。
