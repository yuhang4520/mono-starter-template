/** Only used by the H5 JSON transports (httpLink/httpBatchLink), not streaming links. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: { timeoutMs?: number, fetcher?: typeof globalThis.fetch } = {},
): Promise<Response> {
  const controller = new AbortController()
  const abort = () => controller.abort(init?.signal?.reason)
  if (init?.signal?.aborted)
    abort()
  init?.signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(new Error('请求超时，请稍后重试')), options.timeoutMs ?? 15000)
  try {
    const response = await (options.fetcher ?? globalThis.fetch)(input, { ...init, signal: controller.signal })
    // fetch resolves when headers arrive. Drain a clone while cancellation is still
    // connected, then leave the original Response (including URL/status metadata)
    // intact for tRPC's JSON parser. JSON batches are intentionally buffered.
    await response.clone().arrayBuffer()

    return response
  }
  finally {
    clearTimeout(timeout)
    init?.signal?.removeEventListener('abort', abort)
  }
}
