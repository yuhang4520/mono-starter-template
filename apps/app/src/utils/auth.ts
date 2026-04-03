/**
 * Token management and authentication utilities for UniApp.
 */

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

/**
 * Decodes a JWT token without validation.
 * Used to check expiry on the client side.
 */
export function decodeJWT(token: string) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    // UniApp standard base64 decoding (mp-weixin)
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    )

    return JSON.parse(jsonPayload)
  }
  catch (e) {
    return null
  }
}

/**
 * Universal atob polyfill for different environments
 */
function atob(input: string): string {
  if (typeof (globalThis as any).atob === 'function')
    return (globalThis as any).atob(input)

  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && wx.base64ToArrayBuffer) {
    const arrayBuffer = wx.base64ToArrayBuffer(input)
    let binary = ''
    const bytes = new Uint8Array(arrayBuffer)
    for (let i = 0; i < bytes.length; i++)
      binary += String.fromCharCode(bytes[i])

    return binary
  }
  // #endif

  return ''
}

export function saveTokens(tokens: { accessToken: string, refreshToken: string }) {
  uni.setStorageSync(ACCESS_TOKEN_KEY, tokens.accessToken)
  uni.setStorageSync(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function getAccessToken() {
  return uni.getStorageSync(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return uni.getStorageSync(REFRESH_TOKEN_KEY)
}

export function clearTokens() {
  uni.removeStorageSync(ACCESS_TOKEN_KEY)
  uni.removeStorageSync(REFRESH_TOKEN_KEY)
}

let refreshPromise: Promise<{ accessToken: string, refreshToken: string }> | null = null

/**
 * Performs a token refresh using native uni.request to avoid circular dependencies with tRPC.
 * Supports concurrent refresh requests by returning a shared promise.
 */
export async function performTokenRefresh(): Promise<{ accessToken: string, refreshToken: string }> {
  if (refreshPromise) {
    console.log('[Auth] Already refreshing, returning shared promise.')

    return refreshPromise
  }

  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  console.log('[Auth] Starting token refresh...')

  refreshPromise = new Promise((resolve, reject) => {
    uni.request({
      url: `${import.meta.env.VITE_SERVER_URL}/api/trpc/auth.refresh`,
      method: 'POST',
      header: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`,
      },
      data: JSON.stringify({}), // tRPC refresh mutation expects an empty object for void input
      success: (res) => {
        if (res.statusCode === 200) {
          const data = (res.data as any).result?.data
          if (data && data.accessToken && data.refreshToken) {
            saveTokens(data)
            console.log('[Auth] Token refresh successful.')
            resolve(data)
          }
          else {
            console.error('[Auth] Refresh successful but response format invalid:', res.data)
            reject(new Error('Invalid refresh response'))
          }
        }
        else {
          console.error('[Auth] Refresh request failed with status:', res.statusCode)
          reject(new Error(`Refresh failed with status ${res.statusCode}`))
        }
      },
      fail: (err) => {
        console.error('[Auth] Refresh request failed:', err)
        reject(err)
      },
      complete: () => {
        refreshPromise = null
      },
    })
  })

  return refreshPromise
}

/**
 * Checks if the accessToken is about to expire and refreshes it if necessary.
 */
export async function checkAndRefreshToken() {
  const accessToken = getAccessToken()
  if (!accessToken)
    return

  const payload = decodeJWT(accessToken)
  if (!payload || !payload.exp)
    return

  const currentTime = Math.floor(Date.now() / 1000)
  // If token expires in less than 5 minutes, refresh it
  const refreshThreshold = 300

  if (payload.exp - currentTime < refreshThreshold) {
    try {
      await performTokenRefresh()
    }
    catch (e) {
      console.error('[Auth] Proactive refresh failed:', e)
    }
  }
}
