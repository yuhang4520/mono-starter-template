import type { Tokens } from './auth-core'
import { AuthExpiredError, createAuthSession } from './auth-core'

function requestRefresh(token: string): Promise<Tokens> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${import.meta.env.VITE_SERVER_URL}/api/trpc/auth.refresh`,
      method: 'POST',
      timeout: 15000,
      header: { 'content-type': 'application/json', 'Authorization': `Bearer ${token}` },
      data: {},
      success(res) {
        if (res.statusCode === 401 || res.statusCode === 403) {
          reject(new AuthExpiredError())

          return
        }
        const body = res.data as { result?: { data?: Partial<Tokens> } }
        const tokens = body?.result?.data
        if (res.statusCode === 200 && typeof tokens?.accessToken === 'string' && typeof tokens.refreshToken === 'string' && tokens.accessToken && tokens.refreshToken)
          resolve(tokens as Tokens)
        else
          reject(new Error('暂时无法刷新登录状态，请稍后重试'))
      },
      fail: () => reject(new Error('网络连接失败，请检查网络后重试')),
    })
  })
}

export const authSession = createAuthSession({
  read: key => uni.getStorageSync(key),
  write: (key, value) => uni.setStorageSync(key, value),
  remove: key => uni.removeStorageSync(key),
  refresh: requestRefresh,
})
export const saveTokens = authSession.saveTokens
export const clearTokens = authSession.clearTokens
export const getAccessToken = authSession.getAccessToken
export const getRefreshToken = authSession.getRefreshToken
export const getAuthSessionVersion = authSession.getVersion
export const performTokenRefresh = authSession.refresh

export function handleAuthFailure() {
  clearTokens()
  const pages = getCurrentPages()
  if (pages[pages.length - 1]?.route !== 'pages/login/login')
    uni.reLaunch({ url: '/pages/login/login' })
}

export function decodeJWT(token: string): { exp?: number } | null {
  try {
    const part = token.split('.')[1]
    if (!part)
      return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = new Uint8Array(uni.base64ToArrayBuffer(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    const json = decodeURIComponent(Array.from(bytes, value => `%${value.toString(16).padStart(2, '0')}`).join(''))

    return JSON.parse(json)
  }
  catch {
    return null
  }
}

export async function checkAndRefreshToken() {
  const version = getAuthSessionVersion()
  const expires = decodeJWT(getAccessToken())?.exp
  if (!expires || expires - Date.now() / 1000 > 300)
    return
  try {
    await performTokenRefresh()
  }
  catch (error) {
    // Transport failures are recoverable and must never sign the user out.
    if (error instanceof AuthExpiredError && version === getAuthSessionVersion())
      handleAuthFailure()
  }
}
