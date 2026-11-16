export interface Tokens {
  accessToken: string
  refreshToken: string
}

export class SessionChangedError extends Error {
  constructor() { super('登录状态已变更，请重试') }
}

export class AuthExpiredError extends Error {
  constructor() { super('登录已过期，请重新登录') }
}

interface AuthDependencies {
  read: (key: string) => unknown
  write: (key: string, value: string) => void
  remove: (key: string) => void
  refresh: (token: string) => Promise<Tokens>
}

export function createAuthSession(deps: AuthDependencies) {
  let version = 0
  let pending: { version: number, promise: Promise<Tokens> } | undefined
  const clearListeners = new Set<() => void>()
  const read = (key: string) => {
    const value = deps.read(key)

    return typeof value === 'string' ? value : ''
  }
  const persist = (tokens: Tokens) => {
    deps.write('accessToken', tokens.accessToken)
    deps.write('refreshToken', tokens.refreshToken)
  }

  return {
    getVersion: () => version,
    getAccessToken: () => read('accessToken'),
    getRefreshToken: () => read('refreshToken'),
    onClear(listener: () => void) {
      clearListeners.add(listener)

      return () => clearListeners.delete(listener)
    },
    saveTokens(tokens: Tokens) {
      version += 1
      pending = undefined
      persist(tokens)
    },
    clearTokens() {
      version += 1
      pending = undefined
      deps.remove('accessToken')
      deps.remove('refreshToken')
      clearListeners.forEach(listener => listener())
    },
    async refresh() {
      const currentVersion = version
      if (pending?.version === currentVersion)
        return pending.promise
      const refreshToken = read('refreshToken')
      if (!refreshToken)
        throw new AuthExpiredError()
      const promise = deps.refresh(refreshToken).then((tokens) => {
        if (version !== currentVersion || read('refreshToken') !== refreshToken)
          throw new SessionChangedError()
        persist(tokens)

        return tokens
      })
      pending = { version: currentVersion, promise }
      try {
        return await promise
      }
      finally {
        if (pending?.promise === promise)
          pending = undefined
      }
    },
  }
}

export function safeLoginRedirect(value: unknown): string {
  // Only routes that this starter actually owns can be returned to after login.
  // Do not accept webView targets, external URLs, encoded paths or arbitrary pages.
  const allowed = ['/pages/index/index']

  return typeof value === 'string' && allowed.includes(value) ? value : allowed[0]!
}
