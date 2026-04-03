import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'
import { presetUni } from '@uni-helper/unocss-preset-uni'
import { defineConfig, presetIcons, transformerDirectives, transformerVariantGroup } from 'unocss'

// 工具函数：生成 0~200 的 rpx 映射（步长可调）
function generateRpxSpacing(max = 200, step = 1) {
  const spacing: Record<string, string> = {}
  for (let i = 0; i <= max; i += step) {
    spacing[i] = `${i * 4}rpx` // 1 unit = 4rpx（与 Tailwind/Uno 默认比例一致）
  }

  return spacing
}

// 生成常用尺寸（也可按需调整比例）
const spacing = generateRpxSpacing(200, 1) // 0 ~ 200，对应 0rpx ~ 800rpx

export default defineConfig({
  presets: [
    presetUni({
      attributify: false,
    }),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        // 注册本地 SVG 图标集合, 从本地文件系统加载图标
        // 在 './src/static/icons' 目录下的所有 svg 文件将被注册为图标，
        // icons 是图标集合名称，使用 `i-starter-图标名` 调用
        starter: FileSystemIconLoader(
          './src/static/icons',
          (svg) => {
            let svgStr = svg

            // 如果 SVG 文件未定义 `fill` 属性，则默认填充 `currentColor`, 这样图标颜色会继承文本颜色，方便在不同场景下适配
            svgStr = svgStr.includes('fill="') ? svgStr : svgStr.replace(/^<svg /, '<svg fill="currentColor" ')

            // 如果 svg 有 width, 和 height 属性，将这些属性改为 1em，否则无法显示图标
            svgStr = svgStr.replace(/(<svg.*?width=)"(.*?)"/, '$1"1em"').replace(/(<svg.*?height=)"(.*?)"/, '$1"1em"')

            return svgStr
          },
        ),
        // 图标库，可更换 @see https://icones.js.org/
        stash: () => import('@iconify-json/stash/icons.json').then(i => i.default),
        materialSymbols: () => import('@iconify-json/material-symbols/icons.json').then(i => i.default),
      },
    }),

  ],
  transformers: [
    // 启用指令功能：主要用于支持 @apply、@screen 和 theme() 等 CSS 指令
    transformerDirectives(),
    // 启用 () 分组功能
    // 支持css class组合，eg: `<div class="hover:(bg-gray-400 font-medium) font-(light mono)">测试 unocss</div>`
    transformerVariantGroup(),
  ],
  theme: {
    // 所有间距类（p-, m-, gap-, inset- 等）使用 rpx
    spacing,

    // 宽度 & 高度
    width: {
      ...spacing,
      'auto': 'auto',
      '1/2': '50%',
      '1/3': '33.333333%',
      '2/3': '66.666667%',
      '1/4': '25%',
      '3/4': '75%',
      'full': '100%',
      'screen': '100vw',
    },
    height: {
      ...spacing,
      auto: 'auto',
      full: '100%',
      screen: '100vh',
    },

    // 字体大小（参考设计稿常用值，单位 rpx）
    fontSize: {
      '2xs': '15rpx',
      'xs': '20rpx',
      'sm': '24rpx',
      'base': '28rpx',
      'lg': '32rpx',
      'xl': '36rpx',
      '2xl': '40rpx',
      '3xl': '48rpx',
      '4xl': '56rpx',
      '5xl': '64rpx',
      '6xl': '72rpx',
      '7xl': '80rpx',
      '8xl': '96rpx',
      '9xl': '112rpx',
    },

    // 圆角（rpx）
    borderRadius: {
      none: '0rpx',
      DEFAULT: '8rpx',
      md: '12rpx',
      lg: '20rpx',
      xl: '32rpx',
      full: '9999rpx',
    },

    // 边框宽度（注意：1px 细边框应保留 px，所以这里不转 rpx）
    // 建议通过自定义规则处理边框
  },
  // 自定义 shortcuts Class
  shortcuts: [
    {
      center: 'flex justify-center items-center',
      button: 'center rounded-full transition-all active:scale-95 active:opacity-80 disabled:opacity-50 disabled:pointer-events-none px-4 py-2',
    },
  ],
  // 始终保留的类
  safelist: [
    'text-emerald-500',
    'text-amber-500',
    'text-rose-500',
    'text-gray-800',
  ],
  // ...UnoCSS options
})
