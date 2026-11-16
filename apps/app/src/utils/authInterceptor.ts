import { getAccessToken } from './auth'
import { needsLaunchConsent } from './legal'
import { isPublicPage, LEGAL_PAGE, PRIVACY_PAGE } from './legal-core'

export const LOGIN_PAGE = '/pages/login/login'
export const HOME_PAGE = '/pages/index/index'

export function requireLogin(): boolean {
  if (needsLaunchConsent()) {
    uni.reLaunch({ url: PRIVACY_PAGE })

    return false
  }
  if (getAccessToken())
    return true
  uni.reLaunch({ url: LOGIN_PAGE })

  return false
}

export function setupAuthInterceptor() {
  for (const method of ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'] as const) {
    uni.addInterceptor(method, {
      invoke(args: { url?: string }) {
        if (!args.url)
          return true
        const path = args.url.split(/[?#]/)[0]
        if (needsLaunchConsent() && path !== PRIVACY_PAGE && path !== LEGAL_PAGE) {
          uni.reLaunch({ url: PRIVACY_PAGE })

          return false
        }
        if (isPublicPage(args.url) || getAccessToken())
          return true
        uni.reLaunch({ url: LOGIN_PAGE })

        return false
      },
    })
  }
}
