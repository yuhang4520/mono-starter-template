import { createSSRApp } from 'vue'
import App from './App.vue'
import store from './store'
import { setupAuthInterceptor } from './utils/authInterceptor'

// #ifndef MP
import 'virtual:uno.css'
// #endif

export function createApp() {
  const app = createSSRApp(App)
  app.use(store)

  setupAuthInterceptor()

  return {
    app,
  }
}
