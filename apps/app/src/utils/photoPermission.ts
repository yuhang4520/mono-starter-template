export type PhotoSelectionFailure = 'cancelled' | 'denied' | 'failed'

interface PhotoError { errMsg?: string, message?: string, errCode?: number | string }

interface SettingsOptions { fail: () => void }

interface PermissionUI {
  showToast: (options: { title: string, icon: 'none' }) => unknown
  showModal: (options: {
    title: string
    content: string
    confirmText: string
    showCancel: boolean
    success: (result: { confirm: boolean }) => void
  }) => unknown
  openSetting?: (options: SettingsOptions) => unknown
  openAppAuthorizeSetting?: (options: SettingsOptions) => unknown
}

function errorDetails(error: unknown) {
  const value: PhotoError = error && typeof error === 'object' ? error : {}

  return { message: value.errMsg || value.message || '', code: Number(value.errCode) }
}

export function classifyPhotoSelectionError(error: unknown): PhotoSelectionFailure {
  const { message, code } = errorDetails(error)
  // Some native SDKs reuse -2 for both cancellation and denial: never infer from -2 alone.
  if (code === 1101005 || /(?:permission|auth)[\s\S]*(?:deny|denied|reject)|(?:no|without) permission|未(?:获取|获得).*权限|权限.*(?:拒绝|禁止)|(?:拒绝|禁止).*权限|无权限|未授权/i.test(message))
    return 'denied'
  if (code === 1101001 || /\bcancel(?:led|ed)?\b|用户取消|取消选择/i.test(message))
    return 'cancelled'

  return 'failed'
}

/** Handle only a failed, user-initiated image selection; never request broad album access. */
export function createPhotoSelectionFailureHandler(platform: string, ui: PermissionUI) {
  return (error: unknown): PhotoSelectionFailure => {
    const kind = classifyPhotoSelectionError(error)
    if (kind === 'cancelled')
      return kind
    if (kind === 'failed') {
      ui.showToast({ title: '图片选择失败，请重试', icon: 'none' })

      return kind
    }
    const { message } = errorDetails(error)
    let openSettings: PermissionUI['openAppAuthorizeSetting']
    let content = '图片访问被拒绝。请检查浏览器或系统中此浏览器的图片访问设置，再重新选择。'
    let fallback = '请手动检查浏览器或系统的图片访问设置'
    if (platform === 'mp-weixin') {
      const miniProgramDenial = /auth[\s\S]*(?:deny|denied|reject)/i.test(message)
        && !/system|系统/i.test(message)
      openSettings = miniProgramDenial ? ui.openSetting : ui.openAppAuthorizeSetting
      content = miniProgramDenial
        ? '图片选择授权被拒绝。可前往小程序设置检查授权，返回后重新选择；如仍受限制，请检查系统中微信的照片权限。'
        : '系统限制了微信访问图片。可前往系统的微信权限设置检查照片访问，返回后重新选择。'
      fallback = '请在微信设置或系统的微信权限页检查照片访问'
    }
    else if (platform === 'app' || platform === 'app-plus' || platform === 'app-harmony') {
      openSettings = ui.openAppAuthorizeSetting
      content = platform === 'app-harmony'
        ? '所选图片未获准访问。应用只读取你选择的图片；请重新选择，或前往系统设置检查应用访问限制。'
        : '图片访问被拒绝。可前往系统设置调整此应用的照片访问权限，返回后重新选择。'
      fallback = '请在系统设置中检查此应用的照片访问限制'
    }
    ui.showModal({
      title: '无法访问图片',
      content,
      showCancel: Boolean(openSettings),
      confirmText: openSettings ? '打开设置' : '知道了',
      success: ({ confirm }) => {
        if (!confirm || !openSettings)
          return
        const fail = () => ui.showToast({ title: fallback, icon: 'none' })
        try {
          openSettings({ fail })
        }
        catch {
          fail()
        }
      },
    })

    return kind
  }
}

export function handlePhotoSelectionFailure(error: unknown): PhotoSelectionFailure {
  // uni-app replaces this compile-time constant; importing node:process would break clients.
  // eslint-disable-next-line node/prefer-global/process
  return createPhotoSelectionFailureHandler(process.env.UNI_PLATFORM || 'h5', {
    showToast: options => uni.showToast(options),
    showModal: options => uni.showModal(options),
    openSetting: typeof uni.openSetting === 'function' ? options => uni.openSetting(options) : undefined,
    openAppAuthorizeSetting: typeof uni.openAppAuthorizeSetting === 'function' ? options => uni.openAppAuthorizeSetting(options) : undefined,
  })(error)
}
