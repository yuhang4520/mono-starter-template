// 小程序使用SuperJSON 存在兼容性问题，使用identityTransformer占位
// TODO: 寻找更好的JSON 序列化方案
// TODO: 尝试从api 项目统一导出identityTransformer文件，没成功，待优化
export const identityTransformer = {
  serialize: (value: any) => value,
  deserialize: (value: any) => value,
}
