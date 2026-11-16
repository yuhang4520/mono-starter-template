import assert from 'node:assert/strict'
import test from 'node:test'
import { consentMatches, isPublicPage, legalDocument, validateLegalConfig } from '../src/utils/legal-core'

const config = { privacyUrl: 'https://policy.my-product.cn/privacy', agreementUrl: 'https://policy.my-product.cn/user', version: '2026-11' }
test('consent is bound to the current version and both document addresses', () => {
  const accepted = { ...config, acceptedAt: Date.now() }
  assert.equal(consentMatches(accepted, config), true)
  for (const value of [true, 'true', null, { ...accepted, acceptedAt: Number.NaN }, { ...accepted, acceptedAt: 0 }, { ...accepted, version: 'old' }, { ...accepted, privacyUrl: `${config.privacyUrl}/old` }, { ...accepted, agreementUrl: `${config.agreementUrl}/old` }])
    assert.equal(consentMatches(value, config), false)
})
test('public legal routes cannot become an authentication bypass for arbitrary pages', () => {
  for (const url of ['/pages/legal/index?document=privacy', '/pages/privacyAgreement/index', '/pages/login/login'])
    assert.equal(isPublicPage(url), true)
  for (const url of ['/pages/webView/index?url=https://policy.my-product.cn', '/pages/index/index', '/pages/legal/index-extra', 'https://policy.my-product.cn', '/pages/legal/../index/index'])
    assert.equal(isPublicPage(url), false)
  assert.equal(legalDocument('privacy'), 'privacy')
  assert.equal(legalDocument('user'), 'user')
  for (const value of ['https://other.cn', '../privacy', undefined, ['privacy']])
    assert.equal(legalDocument(value), null)
})
test('production requires configured HTTPS agreements; local HTTP requires explicit local mode', () => {
  assert.deepEqual(validateLegalConfig(config), config)
  assert.doesNotThrow(() => validateLegalConfig({ ...config, privacyUrl: 'https://policy.my-product.cn?document=privacy' }))
  for (const url of ['', 'javascript:alert(1)', 'http://policy.my-product.cn/privacy', 'https://admin.example.com/privacy', 'https://localhost/privacy', 'https://10.1.2.3/privacy', 'https://api.local/privacy', 'https://foo.test/privacy', 'https://user:pass@policy.my-product.cn/privacy', 'https://policy.my-product.cn/"'])
    assert.throws(() => validateLegalConfig({ ...config, privacyUrl: url }))
  const local = { ...config, privacyUrl: 'http://localhost:3300/app-agreement/privacy' }
  assert.doesNotThrow(() => validateLegalConfig(local, true))
  assert.throws(() => validateLegalConfig(local))
  assert.throws(() => validateLegalConfig({ ...config, version: '' }))
  for (const privacyUrl of ['https://./privacy', 'https://policy.my-product.cn:99999/privacy', 'https://-invalid-.cn/privacy'])
    assert.throws(() => validateLegalConfig({ ...config, privacyUrl }))
})
