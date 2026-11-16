import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- Verifies built package fixtures without uploading.
import test from 'node:test'
import { checkPackageSize } from './check-package-size.mjs'

function fixture(t, config = {}) {
  const root = mkdtempSync(join(tmpdir(), 'weixin-package-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'app.json'), JSON.stringify(config))

  return root
}

test('a small package fits the budget', (t) => {
  const root = fixture(t)
  writeFileSync(join(root, 'app.js'), 'app')
  assert.equal(checkPackageSize(root, 100)[0].bytes, 5)
})

test('an oversized asset fails with the file name before upload', (t) => {
  const root = fixture(t)
  mkdirSync(join(root, 'static'))
  writeFileSync(join(root, 'static', 'large.png'), Buffer.alloc(101))
  assert.throws(() => checkPackageSize(root, 100), /Largest files:[\s\S]*static\/large.png/)
})

test('nested files count and subpackages have independent budgets', (t) => {
  const root = fixture(t, { subPackages: [{ root: 'feature' }] })
  mkdirSync(join(root, 'feature', 'static'), { recursive: true })
  writeFileSync(join(root, 'feature', 'static', 'art.webp'), Buffer.alloc(80))
  const groups = checkPackageSize(root, 100)
  assert.equal(groups.find(group => group.name === 'feature').bytes, 80)
  assert.ok(groups.find(group => group.name === 'main').bytes < 100)
  writeFileSync(join(root, 'feature', 'extra.js'), Buffer.alloc(30))
  assert.throws(() => checkPackageSize(root, 100), /feature exceeds/)
})
