import { LOOKUP_LIMITS } from '../src/engine/lookup-contract.js'
import { json, type FetchLike } from './http.js'
import { runLookup, type LookupEnv } from './lookup.js'
import { SlidingWindowLimiter } from './rateLimit.js'
import { validateLookupRequest } from './validate.js'

// Best-effort per-instance limits (user chose in-memory over a third-party store).
const limiter = new SlidingWindowLimiter([
  { windowMs: 60_000, max: 30 },
  { windowMs: 3_600_000, max: 300 },
])

export interface HandlerDeps {
  fetch: FetchLike
  env: LookupEnv
  limiter?: SlidingWindowLimiter
  now?: () => number
}

/** Vercel sets x-forwarded-for to the real client IP (it overwrites client-sent values). */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return xff || headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Rejects cross-site browser requests so other sites can't spend our API quotas. */
export function isCrossSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return true
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export async function handleLookup(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' })
  if (isCrossSite(request)) return json(403, { error: 'Cross-site requests are not allowed.' })
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'Send JSON.' })
  }
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > LOOKUP_LIMITS.bodyBytes) return json(413, { error: 'Request too large.' })

  const rl = (deps.limiter ?? limiter).check(clientIp(request.headers), (deps.now ?? Date.now)())
  if (!rl.ok) {
    return json(429, { error: `Too many checks from your network. Try again in ${rl.retryAfter} seconds.` }, { 'Retry-After': String(rl.retryAfter) })
  }

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > LOOKUP_LIMITS.bodyBytes) return json(413, { error: 'Request too large.' })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json(400, { error: 'Invalid JSON.' })
  }
  const valid = validateLookupRequest(body)
  if (!valid.ok) return json(400, { error: valid.error })

  try {
    return json(200, await runLookup(valid.value, { fetch: deps.fetch, env: deps.env, now: deps.now }))
  } catch {
    // Never echo upstream details or submitted indicators.
    return json(500, { error: 'Lookup failed.' })
  }
}
