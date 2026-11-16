import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getAgreementConfig } from '../lib/agreement-config'
import { isPublicAgreementPath } from '../lib/public-routes'

test('only the two exact agreement pages bypass authentication', () => {
  for (const path of ['/app-agreement/privacy', '/app-agreement/user'])
    assert.equal(isPublicAgreementPath(path), true)
  for (const path of [
    '/app-agreement',
    '/app-agreement/privacy/',
    '/app-agreement/privacy/admin',
    '/app-agreement/user-settings',
    '/app-agreement/user/notes',
    '/App-agreement/privacy',
    '/notes',
    '/users',
  ])
    assert.equal(isPublicAgreementPath(path), false, path)
})

test('agreement configuration exposes an explicit unconfigured state', () => {
  assert.equal(getAgreementConfig({}).isConfigured, false)
  assert.equal(getAgreementConfig({}).version, '1')
  assert.equal(getAgreementConfig({ LEGAL_VERSION: '2' }).version, '2')
  assert.equal(
    getAgreementConfig({ LEGAL_APP_NAME: '__APP_NAME__', LEGAL_CONTACT_EMAIL: 'invalid' })
      .contactEmail,
    undefined,
  )
  const configured = getAgreementConfig({
    LEGAL_APP_NAME: '团队协作',
    LEGAL_OPERATOR_NAME: '示例运营方',
    LEGAL_CONTACT_EMAIL: 'contact@example.org',
  })
  assert.equal(configured.isConfigured, true)
  assert.equal(configured.appName, '团队协作')
})
