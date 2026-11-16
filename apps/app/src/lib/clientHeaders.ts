export function getClientHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'X-App-Source': 'app' }
  try {
    const system = uni.getSystemInfoSync()
    let platform = 'unknown'
    // #ifdef H5
    platform = 'h5'
    // #endif
    // #ifdef MP-WEIXIN
    platform = 'mp-weixin'
    // #endif
    // #ifdef APP-PLUS || APP-HARMONY
    platform = String(system.osName || system.platform || 'app').toLowerCase()
    // #endif
    headers['X-App-Platform'] = platform
    const version = system.appVersion || import.meta.env.VITE_APP_VERSION
    if (version)
      headers['X-App-Version'] = String(version).slice(0, 64)
    if (system.osName)
      headers['X-Client-OS'] = encodeURIComponent(String(system.osName).slice(0, 64))
  }
  catch {
    // Optional diagnostics must not prevent a request.
  }

  return headers
}
