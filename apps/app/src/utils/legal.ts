import type { LegalDocument } from './legal-core'
import { consentMatches, LEGAL_CONSENT_KEY, LEGAL_PAGE, validateLegalConfig } from './legal-core'

export function getLegalConfig() {
  const dev = import.meta.env.DEV || import.meta.env.VITE_DEPLOY_ENV === 'local'

  return validateLegalConfig({
    privacyUrl: import.meta.env.VITE_PRIVACY_URL || (dev ? 'http://localhost:3000/app-agreement/privacy' : ''),
    agreementUrl: import.meta.env.VITE_AGREEMENT_URL || (dev ? 'http://localhost:3000/app-agreement/user' : ''),
    version: import.meta.env.VITE_LEGAL_VERSION || (dev ? '1' : ''),
  }, dev)
}

export function hasLegalConsent(): boolean {
  try {
    return consentMatches(uni.getStorageSync(LEGAL_CONSENT_KEY), getLegalConfig())
  }
  catch {
    return false
  }
}

export function acceptLegalTerms() {
  uni.setStorageSync(LEGAL_CONSENT_KEY, { ...getLegalConfig(), acceptedAt: Date.now() })
  if (!hasLegalConsent())
    throw new Error('无法保存协议同意状态，请重试')
}

export function clearLegalConsent() {
  uni.removeStorageSync(LEGAL_CONSENT_KEY)
}

export function needsLaunchConsent(): boolean {
  // #ifdef APP-HARMONY
  return !hasLegalConsent()

  // #endif
  // #ifndef APP-HARMONY
  // Read storage directly to avoid an auth -> legal -> auth dependency cycle.
  return Boolean(uni.getStorageSync('accessToken')) && !hasLegalConsent()
  // #endif
}

export function openLegalDocument(document: LegalDocument) {
  uni.navigateTo({ url: `${LEGAL_PAGE}?document=${document}` })
}
