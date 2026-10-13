import type { LookupRequest, LookupResponse } from '../src/engine/lookup-contract.js'
import { type FetchLike } from './http.js'
import { lookupRdap } from './providers/rdap.js'
import { lookupSafeBrowsing } from './providers/safeBrowsing.js'
import { lookupUrlhaus } from './providers/urlhaus.js'
import { lookupVirusTotal } from './providers/virusTotal.js'
import { isReservedDomain } from './validate.js'

export interface LookupEnv {
  GOOGLE_SAFE_BROWSING_API_KEY?: string
  VIRUSTOTAL_API_KEY?: string
  URLHAUS_AUTH_KEY?: string
}

export interface LookupDeps {
  fetch: FetchLike
  env: LookupEnv
  now?: () => number
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

/**
 * Runs every provider in parallel. Reserved/test names (.test, .example, …) are only sent to
 * Safe Browsing (whose legacy test entries use them); the others would just burn quota.
 * The server only ever *asks providers about* indicators; it never fetches a submitted URL.
 */
export async function runLookup(req: LookupRequest, deps: LookupDeps): Promise<LookupResponse> {
  const real = (d: string) => !isReservedDomain(d)
  const domains = req.domains.filter(real)
  const urls = req.urls.filter((u) => real(hostOf(u)))
  const key = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined)

  const [safeBrowsing, virusTotal, urlhaus, rdap] = await Promise.all([
    lookupSafeBrowsing(req.urls, { fetch: deps.fetch, apiKey: key(deps.env.GOOGLE_SAFE_BROWSING_API_KEY), now: deps.now }),
    lookupVirusTotal({ hashes: req.hashes, domains, urls }, { fetch: deps.fetch, apiKey: key(deps.env.VIRUSTOTAL_API_KEY), now: deps.now }),
    // Host-level URLhaus listings flag shared platforms (github.com hosts malware too), so only
    // exact URL and payload matches are used.
    lookupUrlhaus({ urls, hosts: [], hashes: req.hashes }, { fetch: deps.fetch, authKey: key(deps.env.URLHAUS_AUTH_KEY), now: deps.now }),
    lookupRdap(domains, { fetch: deps.fetch, now: deps.now }),
  ])
  return { safeBrowsing, virusTotal, urlhaus, rdap }
}
