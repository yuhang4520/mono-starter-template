import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'

// pages.json 全局配置文件
// @see https://uni-helper.js.org/vite-plugin-uni-pages
export default defineUniPages({
  easycom: {
    autoscan: true, // 允许自动扫描组件目录
    custom: {
      '^uni-(.*)': '@dcloudio/uni-ui/lib/uni-$1/uni-$1.vue',
    },
  },
  pages: [],
  globalStyle: {
    pageOrientation: 'landscape',
    screenOrientation: 'landscape',
    navigationStyle: 'custom',
    dynamicRpx: true,
  },
})
