// 小程序使用SuperJSON 存在兼容性问题，使用identityTransformer占位
// TODO: 寻找更好的JSON 序列化方案
export const identityTransformer = {
  serialize: (value: any) => value,
  deserialize: (value: any) => value,
}
