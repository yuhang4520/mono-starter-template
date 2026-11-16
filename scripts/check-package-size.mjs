import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Leave room below WeChat's 2 MiB limit for upload/compiler overhead. These are
// conservative raw output bytes, not an estimate of ZIP compression or billing.
export const PACKAGE_BUDGET = Math.floor(1.85 * 1024 * 1024)

export function checkPackageSize(directory, budget = PACKAGE_BUDGET) {
  const config = JSON.parse(readFileSync(join(directory, 'app.json'), 'utf8'))
  const roots = (config.subPackages ?? config.subpackages ?? []).map(({ root }) => root.replace(/\/$/, ''))
  const packages = new Map(['main', ...roots].map(name => [name, { name, bytes: 0, files: [] }]))

  function walk(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const target = join(path, entry.name)
      if (entry.isDirectory()) {
        walk(target)
      }
      else {
        assert.ok(entry.isFile(), `Unexpected non-file in package: ${target}`)
        const name = relative(directory, target).replaceAll('\\', '/')
        const root = roots.find(root => name.startsWith(`${root}/`)) ?? 'main'
        const group = packages.get(root)
        const bytes = statSync(target).size
        group.bytes += bytes
        group.files.push({ name, bytes })
      }
    }
  }
  walk(directory)
  for (const group of packages.values()) {
    group.files.sort((a, b) => b.bytes - a.bytes)
    console.log(`${group.name}: ${(group.bytes / 1024).toFixed(1)} KiB / ${(budget / 1024).toFixed(1)} KiB budget`)
    if (group.bytes > budget) {
      const largest = group.files.slice(0, 10).map(file => `${file.bytes} bytes  ${file.name}`).join('\n')
      throw new Error(`${group.name} exceeds the mini-program package budget. Compress assets or use subpackages before uploading.\nLargest files:\n${largest}`)
    }
  }

  return [...packages.values()]
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkPackageSize(process.argv[2] ?? 'apps/app/dist/build/mp-weixin')
}
