export type LegalDocument = 'privacy' | 'user'
export interface LegalConfig { privacyUrl: string, agreementUrl: string, version: string }
export const LEGAL_CONSENT_KEY = 'legalConsent'
export const PRIVACY_PAGE = '/pages/privacyAgreement/index'
export const LEGAL_PAGE = '/pages/legal/index'

export function validateLegalConfig(config: LegalConfig, development = false): LegalConfig {
  if (!/^[a-z\d][\w.-]{0,63}$/i.test(config.version))
    throw new Error('协议版本尚未配置，请联系管理员')
  for (const url of [config.privacyUrl, config.agreementUrl]) {
    const parsed = /^https:\/\/([a-zA-Z0-9.-]+)(?::(\d+))?(?:[/?#][^\s<>"'\\]*)?$/.exec(url)
    const host = parsed?.[1] || ''
    const port = parsed?.[2] ? Number(parsed[2]) : 443
    const secure = Boolean(parsed) && port > 0 && port <= 65535 && host.length <= 253
      && /^[a-z]{2,63}$/i.test(host.slice(host.lastIndexOf('.') + 1)) && host.split('.').every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))
    const localMatch = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::(\d+))?\/[^\s<>"'\\]*$/.exec(url)
    const local = development && Boolean(localMatch) && Number(localMatch?.[1] || 80) > 0 && Number(localMatch?.[1] || 80) <= 65535
    if (!secure && !local)
      throw new Error('协议地址尚未正确配置，请联系管理员')
    const reserved = /(?:^|\.)(?:localhost|local|internal|test|invalid|example|example\.(?:com|org|net))$/i.test(host)
    const numericHost = /^[\d.]+$/.test(host)
    if (secure && (reserved || numericHost))
      throw new Error('请配置正式的协议地址')
  }

  return config
}

export function consentMatches(value: unknown, config: LegalConfig): boolean {
  if (!value || typeof value !== 'object')
    return false
  const record = value as Record<string, unknown>

  return record.version === config.version && record.privacyUrl === config.privacyUrl
    && record.agreementUrl === config.agreementUrl && typeof record.acceptedAt === 'number'
    && Number.isFinite(record.acceptedAt) && record.acceptedAt > 0
}

export function isPublicPage(url: string): boolean {
  return ['/pages/login/login', PRIVACY_PAGE, LEGAL_PAGE].includes(url.split(/[?#]/)[0]!)
}

export function legalDocument(value: unknown): LegalDocument | null {
  return value === 'privacy' || value === 'user' ? value : null
}
