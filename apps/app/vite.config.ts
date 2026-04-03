import path from 'node:path'
import process from 'node:process'

import uni from '@uni-helper/plugin-uni'

// 扫描项目文件，按需引入组件，自动生成 .d.ts，自动提示
// @see https://uni-helper.js.org/vite-plugin-uni-components
import Components from '@uni-helper/vite-plugin-uni-components'
// 指定多种布局形式，避免页面中重复引入布局组件，灵活切换
// @see https://uni-helper.js.org/vite-plugin-uni-layouts
import UniLayouts from '@uni-helper/vite-plugin-uni-layouts'
// 约定式路由（文件路由），自动管理 pages.json
// @see https://uni-helper.js.org/vite-plugin-uni-pages
import UniPages from '@uni-helper/vite-plugin-uni-pages'

// 原子化 CSS 引擎。用法类似 tailwindcss，配置更灵活，适配uni-app
import UnoCSS from 'unocss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, path.resolve(process.cwd(), 'env'))
  const { VITE_APP_PORT, VITE_SHOW_SOURCEMAP, VITE_SERVER_URL } = env
  const uniPlatform = process.env.UNI_PLATFORM || ''
  const unoMode = uniPlatform.startsWith('mp-') ? 'per-module' : 'global'
  console.log('command, mode -> ', command, mode)
  console.log('环境变量 env -> ', env)
  console.log('UNI_PLATFORM -> ', uniPlatform, 'UnoCSS mode -> ', unoMode)
  const genMaps = VITE_SHOW_SOURCEMAP === 'true'

  return {
    envDir: 'env',
    plugins: [
      UniPages({
        exclude: ['**/components/**/**.*'],
        // pages 目录为 src/pages，分包目录不能配置在pages目录下
        // 是个数组，可以配置多个，但是不能为pages里面的目录
        subPackages: [],
        dts: 'src/types/uni-pages.d.ts',
      }),
      UniLayouts(),
      Components({
        extensions: ['vue'],
        deep: true, // 是否递归扫描子目录，
        directoryAsNamespace: true, // 是否把目录名作为命名空间前缀，true 时组件名为 目录名+组件名，
        dts: 'src/types/components.d.ts', // 自动生成的组件类型声明文件路径（用于 TypeScript 支持）
      }),
      uni(),
      UnoCSS({
        mode: unoMode,
      }),
    ],
    transpileDependencies: ['@dcloudio/uni-ui'],
    resolve: {
      alias: {
        '@': path.join(process.cwd(), './src'),
        '@lib': path.join(process.cwd(), './src/lib'),
        '@img': path.join(process.cwd(), './src/static/img'),
      },
    },
    server: {
      port: Number(VITE_APP_PORT) || 5173,
    },
    build: {
      sourcemap: genMaps,
      minify: genMaps ? false : 'terser',
      target: 'es2015',
    },
    css: {
      devSourcemap: genMaps,
    },
  }
})
