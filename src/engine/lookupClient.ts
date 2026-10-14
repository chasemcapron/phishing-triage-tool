import type { LookupRequest, LookupResponse } from './lookup-contract'
import { fillRdapInBrowser } from './rdapBrowser'

export class LookupError extends Error {
  constructor(
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message)
  }
}

/** Calls our own /api/lookup, then asks registries directly for any domain ages the server could not get. */
export async function fetchLookup(
  request: LookupRequest,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch; endpoint?: string } = {},
): Promise<LookupResponse> {
  const f = opts.fetchImpl ?? fetch
  let res: Response
  try {
    res = await f(opts.endpoint ?? '/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: opts.signal,
      credentials: 'same-origin',
    })
  } catch (e) {
    if (opts.signal?.aborted) throw e
    throw new LookupError('Online checks are unavailable right now. The verdict above uses local checks only.')
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get('retry-after')) || undefined
    throw new LookupError(`Too many checks from your network${retry ? `; try again in ${retry} seconds` : ''}. Local checks still ran.`, retry)
  }
  if (!res.ok) throw new LookupError('Online checks are unavailable right now. The verdict above uses local checks only.')
  const body = (await res.json().catch(() => null)) as LookupResponse | null
  if (!body || typeof body !== 'object' || !('safeBrowsing' in body)) {
    throw new LookupError('Online checks returned an unexpected answer. Local checks still ran.')
  }
  return fillRdapInBrowser(request, body, { fetchImpl: opts.fetchImpl, signal: opts.signal })
}
