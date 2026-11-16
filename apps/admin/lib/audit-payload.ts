const SECRET_KEYS = /password|secret|token|authorization|cookie|otp|api[-_]?key|credential/i
const PRIVATE_CONTENT_KEYS = /^(body|content)$/i

/** Bounded, cycle-safe copies: audit logs must not become a second file store. */
export function redactPayload(value: unknown, key = '', depth = 0): unknown {
  if (SECRET_KEYS.test(key) || PRIVATE_CONTENT_KEYS.test(key)) return '[REDACTED]'
  if (/phone|mobile/i.test(key)) {
    return typeof value === 'string' ? `***${value.slice(-4)}` : '[REDACTED]'
  }
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return value.length > 256 ? `${value.slice(0, 256)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value !== 'object') return `[${typeof value}]`
  if (depth >= 4) return '[MAX_DEPTH]'
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '[INVALID_DATE]' : value.toISOString()
  if (typeof File !== 'undefined' && value instanceof File) {
    return { file: value.name.slice(0, 128), size: value.size, type: value.type }
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob)
    return { size: value.size, type: value.type }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return '[binary]'
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return redactPayload(Object.fromEntries(value.entries()), key, depth + 1)
  }
  if (value instanceof URLSearchParams || value instanceof Headers)
    return redactPayload(Object.fromEntries(value.entries()), key, depth + 1)
  if (value instanceof Map) {
    const entries: unknown[] = []
    for (const [name, item] of value) {
      if (entries.length >= 20) break
      entries.push([
        redactPayload(name, '', depth + 1),
        typeof name === 'string' ? redactPayload(item, name, depth + 1) : '[REDACTED]',
      ])
    }
    return entries
  }
  if (value instanceof Set) {
    const items: unknown[] = []
    for (const item of value) {
      if (items.length >= 20) break
      items.push(redactPayload(item, key, depth + 1))
    }
    return items
  }
  if (Array.isArray(value))
    return value.slice(0, 20).map(item => redactPayload(item, key, depth + 1))
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 30)
      .map(([name, item]) => [name, redactPayload(item, name, depth + 1)]),
  )
}
