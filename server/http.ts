export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export class TimeoutError extends Error {}

/** fetch with an AbortController deadline. Never follows redirects unless asked. */
export async function fetchWithTimeout(fetchImpl: FetchLike, url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetchImpl(url, { redirect: 'manual', ...init, signal: controller.signal })
  } catch (e) {
    if (controller.signal.aborted) throw new TimeoutError('timeout')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Reads a JSON body without trusting the Content-Type (some providers mislabel it). */
export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...extra },
  })
}

/** Runs tasks with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}
