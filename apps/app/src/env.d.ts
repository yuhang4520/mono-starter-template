/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  /** 服务端口号 */
  readonly VITE_APP_PORT: string
  /** 是否显示源码 */
  readonly VITE_SHOW_SOURCEMAP: 'true' | 'false'
  readonly VITE_SERVER_URL: string
}
