import { useUserStore } from '@/store'
import { getAccessToken } from '@/utils/auth'

const LOGIN_PAGE = '/pages/login/login'
const whiteList = [LOGIN_PAGE]

function needAuth(url: string) {
  const purePath = url.split(/[?#]/)[0]

  return !whiteList.includes(purePath)
}

function isLogin() {
  const userStore = useUserStore()
  const token = getAccessToken()

  return !!token && !!userStore.userInfo.id && userStore.userInfo.id !== '-1'
}

function hasUrl(args: unknown): args is { url: string } {
  return typeof args === 'object' && args !== null && 'url' in args && typeof (args as any).url === 'string'
}

function handleInvoke(args: unknown) {
  if (!hasUrl(args)) {
    return true
  }
  if (needAuth(args.url) && !isLogin()) {
    uni.navigateTo({
      url: `${LOGIN_PAGE}?redirect=${encodeURIComponent(args.url)}`,
    })

    return false
  }
  console.log('允许跳转 handleInvoke')

  return true
}

export function setupAuthInterceptor() {
  const methods = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab'] as const
  methods.forEach((method) => {
    uni.addInterceptor(method, {
      invoke(args) {
        return handleInvoke(args)
      },
    })
  })
}
