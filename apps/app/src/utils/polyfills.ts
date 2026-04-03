/**
 * Polyfills for WeChat Mini Program and other non-standard environments.
 *
 * This utility provides essential Web API polyfills that are often missing in
 * Mini Program runtimes, including:
 * - `globalThis` (for older environments)
 * - `AbortController` & `AbortSignal` (for request cancellation)
 * - `Blob` (for binary data handling)
 * - `File` (for file handling)
 *
 * These are required for libraries like tRPC and SuperJSON to function correctly.
 */

// Explicitly declare global types if needed, or rely on runtime checks
declare const wx: any

type PolyfillTarget = typeof globalThis & Record<string, any>

function getGlobal(): PolyfillTarget {
  if (typeof globalThis !== 'undefined')
    return globalThis

  // Fallback for environments where globalThis is not natively available
  return new Function('return this')() as PolyfillTarget
}

const root = getGlobal()

// Collect all relevant global scopes (globalThis, wx, global, etc.)
const targets: PolyfillTarget[] = [root]

if (typeof wx !== 'undefined')
  targets.push(wx)

if (typeof global !== 'undefined') {
  targets.push(global)
}

/**
 * Installs a polyfill on all detected global scopes.
 * Safe to call multiple times; will check existence before overwriting.
 */
function polyfill(name: string, implementation: any) {
  targets.forEach((target) => {
    if (typeof target[name] === 'undefined') {
      try {
        // Attempt to preserve the correct class name
        Object.defineProperty(implementation, 'name', { value: name })
      }
      catch {
        // Ignore if 'name' property is non-configurable
      }
      target[name] = implementation
    }
  })
}

// --- 1. AbortController / AbortSignal Polyfill ---

if (
  typeof root.AbortSignal === 'undefined'
  || typeof root.AbortController === 'undefined'
) {
  class AbortSignal {
    aborted: boolean

    onabort: ((event: any) => void) | null

    constructor() {
      this.aborted = false
      this.onabort = null
    }

    addEventListener(event: string, handler: (event: any) => void) {
      if (event === 'abort')
        this.onabort = handler
    }

    removeEventListener(event: string, handler: (event: any) => void) {
      if (event === 'abort' && this.onabort === handler) {
        this.onabort = null
      }
    }

    static abort() {
      const signal = new AbortSignal()
      signal.aborted = true

      return signal
    }
  }

  class AbortController {
    signal: AbortSignal

    constructor() {
      this.signal = new AbortSignal()
    }

    abort() {
      if (this.signal.aborted)
        return
      this.signal.aborted = true
      if (this.signal.onabort) {
        this.signal.onabort({ type: 'abort', target: this.signal })
      }
    }
  }

  polyfill('AbortSignal', AbortSignal)
  polyfill('AbortController', AbortController)
}

// --- 2. Blob Polyfill ---

if (typeof root.Blob === 'undefined') {
  class Blob {
    private _parts: any[]

    private _options: any

    constructor(parts: any[] = [], options: any = {}) {
      this._parts = parts
      this._options = options
    }

    slice(_start?: number, _end?: number, contentType?: string) {
      // Basic implementation: returns a new Blob with same parts
      // Full slice implementation is complex without native Buffers
      return new Blob([this._parts], { type: contentType })
    }
  }

  if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
    Blob.prototype[Symbol.toStringTag] = 'Blob'
  }

  polyfill('Blob', Blob)
}

// --- 3. File Polyfill ---

if (typeof root.File === 'undefined') {
  // Ensure we extend the Blob available in the root scope (either native or polyfilled)
  const BlobClass = root.Blob

  class File extends BlobClass {
    name: string

    lastModified: number

    constructor(parts: any[], name: string, options: any = {}) {
      super(parts, options)
      this.name = name
      this.lastModified = options.lastModified || Date.now()
    }
  }

  if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
    File.prototype[Symbol.toStringTag] = 'File'
  }

  polyfill('File', File)
}
