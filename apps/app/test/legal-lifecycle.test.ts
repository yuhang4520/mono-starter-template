import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const HOME = '/pages/index/index'
const LOGIN = '/pages/login/login'
const PRIVACY = '/pages/privacyAgreement/index'
const LEGAL = '/pages/legal/index'
const config = { privacyUrl: 'https://policy.product.cn/privacy', agreementUrl: 'https://policy.product.cn/user', version: '2' }
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
type Hook = (...args: any[]) => unknown

interface Hooks { onShow: Hook[], onLoad: Hook[], onBackPress: Hook[], onUnload: Hook[] }

// Compile the real SFC setup, preserving Vue refs and all production branching.
// Only the platform, storage, navigation and network boundaries are replaced.
function harness(options: { harmony?: boolean, token?: boolean, consent?: object, storage?: 'throw' | 'drop' } = {}) {
  const harmony = options.harmony !== false
  const env: Record<string, unknown> = { DEV: false, VITE_PRIVACY_URL: config.privacyUrl, VITE_AGREEMENT_URL: config.agreementUrl, VITE_LEGAL_VERSION: config.version, VITE_SERVER_URL: 'https://api.product.cn' }
  const storage = new Map<string, unknown>()
  if (options.consent)
    storage.set('legalConsent', options.consent)
  const counts = { refresh: 0, getMe: 0, login: 0, choose: 0, upload: 0, signature: 0, preview: 0 }
  const routes = [HOME]
  const navigations: string[] = []
  const interceptors = new Map<string, { invoke: (args: { url: string }) => boolean }>()
  let picker: { success: (value: { tempFilePaths: string[] }) => Promise<void> } | undefined
  let loginResult: Promise<unknown> | undefined
  let uploadResult: Promise<string> | undefined
  let userResult: Promise<unknown> | undefined
  let currentHooks: Hooks = { onShow: [], onLoad: [], onBackPress: [], onUnload: [] }
  const user = { name: 'Test user' }

  function navigate(method: string, { url }: { url: string }) {
    if (interceptors.get(method)?.invoke({ url }) === false)
      return
    navigations.push(url)
    if (method === 'navigateTo')
      routes.push(url.split('?')[0]!)
    else
      routes.splice(0, routes.length, url.split('?')[0]!)
  }
  const uni = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync(key: string, value: unknown) {
      if (key === 'legalConsent' && options.storage === 'throw')
        throw new Error('storage unavailable')
      if (key !== 'legalConsent' || options.storage !== 'drop')
        storage.set(key, value)
    },
    removeStorageSync: (key: string) => storage.delete(key),
    base64ToArrayBuffer: (value: string) => Uint8Array.from(Buffer.from(value, 'base64')).buffer,
    request(args: { success: (result: unknown) => void }) {
      counts.refresh++
      args.success({ statusCode: 200, data: { result: { data: { accessToken: 'new-access', refreshToken: 'new-refresh' } } } })
    },
    addInterceptor: (method: string, interceptor: { invoke: (args: { url: string }) => boolean }) => interceptors.set(method, interceptor),
    reLaunch: (args: { url: string }) => navigate('reLaunch', args),
    navigateTo: (args: { url: string }) => navigate('navigateTo', args),
    redirectTo: (args: { url: string }) => navigate('redirectTo', args),
    switchTab: (args: { url: string }) => navigate('switchTab', args),
    navigateBack: () => routes.pop(),
    setNavigationBarTitle: () => {},
    chooseImage(args: NonNullable<typeof picker>) {
      counts.choose++
      picker = args
    },
    previewImage: () => { counts.preview++ },
  }
  const mocks: Record<string, unknown> = {
    'vue': vue,
    '@dcloudio/uni-app': Object.fromEntries(['onShow', 'onLoad', 'onBackPress', 'onUnload'].map(name => [name, (callback: Hook) => currentHooks[name as keyof Hooks].push(callback)])),
    '@/components/LegalLinks.vue': {},
    '@/utils/photoPermission': { handlePhotoSelectionFailure: () => {} },
    '@/utils/upload': {
      uploadFile: async () => {
        counts.upload++

        return uploadResult ?? 'private/test.png'
      },
      getFileUrl: async () => {
        counts.signature++

        return 'https://files.product.cn/test.png'
      },
    },
    '@/lib/trpc': { trpc: { auth: {
      getMe: { query: async () => {
        counts.getMe++

        return userResult ?? user
      } },
      loginByPhoneNumber: { mutate: async () => {
        counts.login++

        return loginResult ?? { user, accessToken: 'access', refreshToken: 'refresh' }
      } },
      logout: { mutate: async () => {} },
    } } },
  }
  const cache = new Map<string, any>()

  function load(relative: string): any {
    const file = path.resolve(sourceRoot, relative)
    if (cache.has(file))
      return cache.get(file)
    let source = readFileSync(file, 'utf8')
    const conditions = [true]
    source = source.split('\n').filter((line) => {
      const directive = line.match(/^\s*\/\/ #(ifdef|ifndef) APP-HARMONY\s*$/)
      if (directive) {
        conditions.push(conditions.at(-1)! && (directive[1] === 'ifdef' ? harmony : !harmony))

        return false
      }
      if (/^\s*\/\/ #endif\s*$/.test(line)) {
        conditions.pop()

        return false
      }

      return conditions.at(-1)
    }).join('\n')
    if (file.endsWith('.vue')) {
      const { descriptor } = parse(source, { filename: file })
      source = compileScript(descriptor, { id: file }).content
    }
    source = source.replaceAll('import.meta.env', '__env')
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const module = { exports: {} }
    runInNewContext(code, {
      module,
      exports: module.exports,
      __env: env,
      uni,
      Error,
      console,
      getCurrentPages: () => routes.map(route => ({ route: route.slice(1) })),
      definePage: () => {},
      require(specifier: string) {
        if (specifier in mocks)
          return mocks[specifier]
        const dependency = specifier.startsWith('@/') ? path.resolve(sourceRoot, specifier.slice(2)) : path.resolve(path.dirname(file), specifier)
        assert.ok(dependency.startsWith(sourceRoot), `Unexpected dependency: ${specifier}`)

        return load(`${dependency}.ts`)
      },
    }, { filename: file })
    cache.set(file, module.exports)

    return module.exports
  }
  const auth = load('utils/auth.ts')
  const store = { setUserInfo: (_value: unknown) => {}, logout: () => auth.clearTokens() }
  mocks['@/store'] = { useUserStore: () => store }
  if (options.token) {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 30 })).toString('base64url')
    auth.saveTokens({ accessToken: `header.${payload}.signature`, refreshToken: 'old-refresh' })
  }
  const legal = load('utils/legal.ts')
  load('utils/authInterceptor.ts').setupAuthInterceptor()

  function mount(relative: string) {
    const component = load(relative).default
    currentHooks = { onShow: [], onLoad: [], onBackPress: [], onUnload: [] }
    const state = component.setup({}, { expose: () => {} })

    return { state, hooks: currentHooks }
  }

  return { auth, legal, mount, counts, storage, routes, navigations, uni, env, pick: async () => {
    assert.ok(picker, 'Image picker was not opened')
    await picker.success({ tempFilePaths: ['/tmp/selected.png'] })
  }, deferLogin: (promise: Promise<unknown>) => {
    loginResult = promise
  }, deferUpload: (promise: Promise<string>) => {
    uploadResult = promise
  }, deferUser: (promise: Promise<unknown>) => {
    userResult = promise
  } }
}

const accepted = () => ({ ...config, acceptedAt: Date.now() })

test('Harmony cold start and foreground resume block refresh and getMe before consent, regardless of lifecycle ordering', async () => {
  for (const pageFirst of [false, true]) {
    const h = harness({ token: true })
    const app = h.mount('App.vue')
    const home = h.mount('pages/index/index.vue')
    const callbacks = pageFirst ? [...home.hooks.onShow, ...app.hooks.onShow] : [...app.hooks.onShow, ...home.hooks.onShow]
    for (let resume = 0; resume < 2; resume++) {
      for (const callback of callbacks)
        callback()
      await tick()
    }
    assert.equal(h.counts.refresh, 0)
    assert.equal(h.counts.getMe, 0)
    assert.equal(h.routes.at(-1), PRIVACY)
    assert.ok(h.navigations.every(route => route === PRIVACY))
  }
})

test('Harmony refusal, back key and legal reading preserve the gate without redirects or background refresh', async () => {
  const h = harness({ token: true })
  h.routes.splice(0, 1, PRIVACY)
  const app = h.mount('App.vue')
  const privacy = h.mount('pages/privacyAgreement/index.vue')
  privacy.state.refuse()
  assert.match(privacy.state.error.value, /尚未同意/)
  assert.equal(privacy.hooks.onBackPress[0]!(), true)
  app.hooks.onShow[0]!()
  assert.equal(h.navigations.length, 0)
  h.legal.openLegalDocument('privacy')
  const document = h.mount('pages/legal/index.vue')
  document.hooks.onLoad[0]!({ document: 'privacy', url: 'https://attacker.invalid' })
  assert.equal(document.state.url.value, config.privacyUrl)
  app.hooks.onShow[0]!()
  assert.equal(h.navigations.length, 1)
  document.state.goBack()
  assert.equal(h.routes.at(-1), PRIVACY)
  assert.equal(h.legal.hasLegalConsent(), false)
  assert.equal(h.counts.refresh + h.counts.getMe, 0)
  h.routes.splice(0, h.routes.length, LEGAL)
  document.state.goBack()
  assert.equal(h.routes.at(-1), PRIVACY)
})

test('Harmony accepting consent enables the actual refresh and home request; anonymous acceptance goes to login', async () => {
  for (const token of [false, true]) {
    const h = harness({ token })
    const privacy = h.mount('pages/privacyAgreement/index.vue')
    privacy.state.accept()
    assert.equal(h.legal.hasLegalConsent(), true)
    assert.equal(privacy.hooks.onBackPress[0]!(), false)
    assert.equal(h.routes.at(-1), token ? HOME : LOGIN)
    if (token) {
      h.mount('App.vue').hooks.onShow[0]!()
      h.mount('pages/index/index.vue').hooks.onShow[0]!()
      await tick()
      assert.equal(h.counts.refresh, 1)
      assert.equal(h.counts.getMe, 1)
    }
  }
})

test('version or document-address change reopens the Harmony gate for an existing session', async () => {
  for (const change of [{ VITE_LEGAL_VERSION: '3' }, { VITE_PRIVACY_URL: `${config.privacyUrl}/new` }, { VITE_AGREEMENT_URL: `${config.agreementUrl}/new` }]) {
    const h = harness({ token: true, consent: accepted() })
    assert.equal(h.legal.hasLegalConsent(), true)
    Object.assign(h.env, change)
    h.mount('App.vue').hooks.onShow[0]!()
    h.mount('pages/index/index.vue').hooks.onShow[0]!()
    await tick()
    assert.equal(h.routes.at(-1), PRIVACY)
    assert.equal(h.counts.refresh + h.counts.getMe, 0)
  }
})

test('anonymous navigation allows only dedicated legal pages; malformed document inputs never load external content', () => {
  const h = harness({ harmony: false })
  for (const method of ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'] as const) {
    h.uni[method]({ url: `${LEGAL}?document=user` })
    assert.equal(h.routes.at(-1), LEGAL)
    h.uni[method]({ url: '/pages/webView/index?url=https://attacker.invalid' })
    assert.equal(h.routes.at(-1), LOGIN)
  }
  for (const document of ['https://attacker.invalid', '../privacy', ['privacy'], undefined]) {
    const page = h.mount('pages/legal/index.vue')
    page.hooks.onLoad[0]!({ document })
    assert.equal(page.state.url.value, '')
    assert.match(page.state.error.value, /协议类型无效/)
  }
})

test('login handler blocks unchecked consent and configuration/storage failures before sending credentials', async () => {
  for (const failure of ['unchecked', 'config', 'throw', 'drop'] as const) {
    const h = harness({ harmony: false, storage: failure === 'throw' || failure === 'drop' ? failure : undefined })
    const login = h.mount('pages/login/login.vue')
    login.state.phone.value = '13800138000'
    login.state.password.value = 'password123'
    if (failure !== 'unchecked')
      login.state.changeAgreement({ detail: { value: ['agreed'] } })
    if (failure === 'config')
      h.env.VITE_PRIVACY_URL = ''
    await login.state.login()
    assert.equal(h.counts.login, 0, failure)
    assert.equal(h.legal.hasLegalConsent(), false, failure)
    assert.ok(login.state.errorMessage.value, failure)
    assert.equal(login.state.busy.value, false)
  }
})

test('login persists consent before the request, prevents double submit, and clears consent on uncheck', async () => {
  const h = harness({ harmony: false })
  const login = h.mount('pages/login/login.vue')
  login.state.phone.value = '13800138000'
  login.state.password.value = 'password123'
  login.state.changeAgreement({ detail: { value: ['agreed'] } })
  let resolve!: (value: unknown) => void
  h.deferLogin(new Promise((yes) => {
    resolve = yes
  }))
  const pending = login.state.login()
  assert.equal(h.legal.hasLegalConsent(), true)
  await login.state.login()
  assert.equal(h.counts.login, 1)
  resolve({ user: { name: 'Test user' }, accessToken: 'access', refreshToken: 'refresh' })
  await pending
  assert.equal(h.routes.at(-1), HOME)
  assert.equal(h.auth.getAccessToken(), 'access')
  login.state.changeAgreement({ detail: { value: [] } })
  assert.equal(h.legal.hasLegalConsent(), false)
})

test('Harmony image actions and late picker callbacks cannot request permission or upload after consent is absent', async () => {
  const h = harness({ token: true })
  const home = h.mount('pages/index/index.vue')
  home.state.chooseImage()
  await home.state.previewImage()
  assert.equal(h.counts.choose + h.counts.signature + h.counts.preview, 0)
  h.legal.acceptLegalTerms()
  home.state.chooseImage()
  assert.equal(h.counts.choose, 1)
  h.legal.clearLegalConsent()
  await h.pick()
  assert.equal(h.counts.upload + h.counts.signature, 0)
})

test('non-Harmony existing sessions must renew consent after a version update, while anonymous users retain the login checkbox flow', async () => {
  for (const token of [false, true]) {
    const h = harness({ harmony: false, token, consent: accepted() })
    h.env.VITE_LEGAL_VERSION = 'new-version'
    assert.equal(h.legal.needsLaunchConsent(), token)
    h.mount('App.vue').hooks.onShow[0]!()
    if (token) {
      h.mount('pages/index/index.vue').hooks.onShow[0]!()
      await tick()
      assert.equal(h.counts.refresh + h.counts.getMe, 0)
      assert.equal(h.routes.at(-1), PRIVACY)
    }
  }
})

test('explicit local build configuration permits local agreements without weakening a production release', () => {
  const h = harness({ harmony: false })
  Object.assign(h.env, { VITE_DEPLOY_ENV: 'local', VITE_PRIVACY_URL: 'http://localhost:3000/app-agreement/privacy', VITE_AGREEMENT_URL: 'http://localhost:3000/app-agreement/user' })
  assert.doesNotThrow(() => h.legal.getLegalConfig())
  h.env.VITE_DEPLOY_ENV = 'production'
  assert.throws(() => h.legal.getLegalConfig())
})

test('leaving the login page prevents a late login from saving credentials', async () => {
  const h = harness({ harmony: false })
  const login = h.mount('pages/login/login.vue')
  login.state.phone.value = '13800138000'
  login.state.password.value = 'test-password'
  login.state.changeAgreement({ detail: { value: ['agreed'] } })
  let resolve!: (value: unknown) => void
  h.deferLogin(new Promise((yes) => {
    resolve = yes
  }))
  const pending = login.state.login()
  login.hooks.onUnload[0]!()
  resolve({ user: { name: 'Old user' }, accessToken: 'old-access', refreshToken: 'old-refresh' })
  await pending
  assert.equal(h.auth.getAccessToken(), '')
  assert.equal(h.navigations.length, 0)
})

test('account switch or page unload during an upload prevents the signature request and stale UI writes', async () => {
  for (const change of ['account', 'unload', 'consent']) {
    const h = harness({ token: true, consent: accepted() })
    const home = h.mount('pages/index/index.vue')
    let resolve!: (value: string) => void
    h.deferUpload(new Promise((yes) => {
      resolve = yes
    }))
    home.state.chooseImage()
    const pending = h.pick()
    assert.equal(h.counts.upload, 1)
    if (change === 'account')
      h.auth.saveTokens({ accessToken: 'other-access', refreshToken: 'other-refresh' })
    else if (change === 'unload')
      home.hooks.onUnload[0]!()
    else
      h.legal.clearLegalConsent()
    resolve('private/old-account.png')
    await pending
    assert.equal(h.counts.signature, 0)
    assert.equal(home.state.uploadedImage.value, '')
    assert.equal(home.state.errorMessage.value, '')
  }
})

test('an old failed profile request cannot overwrite a new session page error', async () => {
  const h = harness({ token: true, consent: accepted() })
  const home = h.mount('pages/index/index.vue')
  let reject!: (error: Error) => void
  h.deferUser(new Promise((_yes, no) => {
    reject = no
  }))
  const pending = home.state.loadUser()
  h.auth.saveTokens({ accessToken: 'other-access', refreshToken: 'other-refresh' })
  home.state.errorMessage.value = 'new session notice'
  reject(new Error('old account failure'))
  await pending
  assert.equal(home.state.errorMessage.value, 'new session notice')
})
