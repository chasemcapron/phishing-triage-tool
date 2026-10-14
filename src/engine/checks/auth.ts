import { GATEWAYS } from '../data/lists'
import type { FindingSet } from '../findings'
import { looksLikeMicrosoft, methodResult, providerName } from '../parse/authResults'
import { orgOf, reverseName } from '../parse/received'
import type { AuthResultsHeader, AuthSummary, GatewayAuth, Hop } from '../types'
import { registrable } from '../util/domain'

export interface AuthContext {
  /** Registrable domains the message was addressed to (To, Cc, Delivered-To, Received "for"). */
  recipientDomains: string[]
  /** Reverse DNS of the delivering server as looked up by Microsoft (X-Forefront-Antispam-Report PTR). */
  ptr: string | null
}

const gatewayOf = (host: string | null) => {
  const d = host ? registrable(host) : null
  return d ? (GATEWAYS.find((g) => g.hosts.includes(d)) ?? null) : null
}

/**
 * Many organizations run an email gateway (Proofpoint, Mimecast, ...) in front of Microsoft 365
 * or Google. The gateway checks SPF/DKIM/DMARC when the message arrives, then relays it, often
 * adding a banner. The mailbox provider's own check then fails by design: the relay is not in
 * the sender's SPF and the banner breaks DKIM. When the provider received the message from the
 * recipient's own organization (confirmed by reverse DNS, not just the HELO name), follow the
 * Received chain back to where the gateway took it in, and trust the topmost result that
 * gateway wrote (it prepends, so anything a sender planted sits below it).
 */
function findGateway(all: AuthResultsHeader[], hops: Hop[], provider: AuthResultsHeader, ctx: AuthContext) {
  const bi = hops.findIndex((h) => h.isBoundary)
  const boundary = hops[bi]
  if (!boundary?.from) return null
  const org = new Set(ctx.recipientDomains)
  const inOrg = (host: string | null) => Boolean(host && (org.has(registrable(host) ?? '') || gatewayOf(host)))
  const rdns = ctx.ptr ?? reverseName(boundary)
  if (!rdns || !inOrg(rdns) || orgOf(rdns) !== orgOf(boundary.from)) return null

  let entry: Hop | null = null
  for (let i = bi - 1; i >= 0; i--) {
    const h = hops[i]!
    if (!inOrg(h.by)) return null
    // Hand-offs between the gateway's own processes (127.0.0.1, private IPs) stay inside it.
    if (h.ipClass === 'loopback' || h.ipClass === 'private' || h.ipClass === 'link-local') continue
    if (!inOrg(h.from)) {
      entry = h
      break
    }
  }
  if (!entry?.by) return null
  const vendor = gatewayOf(entry.by)
  const ids = vendor ? vendor.authserv : [registrable(entry.by)!]
  const header = all.find((h) => h !== provider && h.kind === 'auth' && h.authservId && ids.includes(registrable(h.authservId) ?? ''))
  if (!header) return null
  const gateway: GatewayAuth = {
    name: vendor?.name ?? registrable(entry.by)!,
    host: entry.by,
    downstream: { provider: providerName(provider), spf: methodResult(provider, 'spf'), dkim: methodResult(provider, 'dkim'), dmarc: methodResult(provider, 'dmarc') },
  }
  return { header, gateway }
}
import { clip } from '../util/text'

/**
 * Trust model: only the topmost Authentication-Results header was added by the
 * recipient's own provider (each server prepends its headers). Anything below it
 * arrived with the message and may have been written by the sender.
 */
export function summarizeAuth(all: AuthResultsHeader[], hops: Hop[], ctx: AuthContext = { recipientDomains: [], ptr: null }): AuthSummary {
  const provider = all.find((h) => h.kind === 'auth' && !h.original) ?? null

  let providerVerified = false
  const boundary = hops.find((h) => h.isBoundary)
  if (provider && boundary?.by) {
    providerVerified = provider.authservId
      ? orgOf(provider.authservId) === orgOf(boundary.by)
      : looksLikeMicrosoft(provider) && /(^|\.)(protection|prod)\.outlook\.[a-z]+$/i.test(boundary.by)
  }

  const viaGateway = provider && providerVerified ? findGateway(all, hops, provider, ctx) : null
  const trusted = viaGateway?.header ?? provider
  if (trusted) trusted.trusted = true

  return {
    ...(viaGateway ? { gateway: viaGateway.gateway } : {}),
    provider: viaGateway ? `${viaGateway.gateway.name} (${trusted!.authservId}), your organization's email gateway` : provider ? providerName(provider) : null,
    providerVerified,
    trusted,
    spf: trusted ? methodResult(trusted, 'spf') : null,
    dkim: trusted ? methodResult(trusted, 'dkim') : null,
    dmarc: trusted ? methodResult(trusted, 'dmarc') : null,
    headers: all,
  }
}

const WEAK = new Set(['none', 'neutral', 'temperror', 'permerror'])

export function checkAuth(summary: AuthSummary, findings: FindingSet, fromDomain: string | null): void {
  const t = summary.trusted
  if (!t) {
    findings.add('auth-missing', 'No sender-authentication results were found, so SPF, DKIM and DMARC could not be checked.')
    return
  }
  const ev = (m: string) => {
    const r = t.methods.find((x) => x.method === m)
    return r ? `${m}=${r.result} ${Object.entries(r.props).map(([k, v]) => `${k}=${v}`).join(' ')}`.trim() : `${m}: no result`
  }
  const { spf, dkim, dmarc } = summary
  const from = fromDomain ?? 'the sender'
  const g = summary.gateway

  if (g) {
    const r = (x: string | null) => x ?? 'none'
    findings.add(
      'auth-via-gateway',
      `Your organization's email gateway (${g.name}) checked this message when it arrived: SPF ${r(spf)}, DKIM ${r(dkim)}, DMARC ${r(dmarc)}. ` +
        `Your mailbox provider's later check (SPF ${r(g.downstream.spf)}, DKIM ${r(g.downstream.dkim)}, DMARC ${r(g.downstream.dmarc)}) is expected to fail after a gateway relays a message and adds its banner, so the gateway's result is the one used.`,
      [`gateway: ${g.host}`, `${g.downstream.provider}: spf=${r(g.downstream.spf)} dkim=${r(g.downstream.dkim)} dmarc=${r(g.downstream.dmarc)}`],
    )
  }

  if (dmarc === 'fail') {
    findings.add('auth-dmarc-fail', `The sender's domain (${from}) did not approve this message: it failed DMARC, the main check against spoofed senders.`, ev('dmarc'))
  } else if (!dmarc || WEAK.has(dmarc)) {
    findings.add('auth-dmarc-none', `${from} has no working DMARC protection, so nothing stops others from sending mail in its name.`, ev('dmarc'))
  }

  if (dmarc !== 'pass') {
    if (spf === 'fail') findings.add('auth-spf-fail', `The server that sent this is not allowed to send mail for its claimed domain (SPF failed).`, ev('spf'))
    else if (spf === 'softfail') findings.add('auth-spf-softfail', `The sending server is not on the domain's list of approved senders (SPF soft-failed).`, ev('spf'))
    else if (!spf || WEAK.has(spf)) findings.add('auth-spf-none', 'There was no usable SPF result for the sending server.', ev('spf'))

    if (dkim === 'fail') findings.add('auth-dkim-fail', 'The message carries a digital signature that does not check out (DKIM failed), so it may have been altered or forged.', ev('dkim'))
    else if (!dkim || WEAK.has(dkim)) findings.add('auth-dkim-none', 'The message is not digitally signed by its sender (no DKIM).', ev('dkim'))
  }

  // Lower Authentication-Results headers came from somewhere else, possibly the sender.
  // The provider's own header is accounted for above when a gateway checked the message first.
  const others = summary.headers.filter((h) => h.kind === 'auth' && !h.trusted && h.authservId !== t.authservId && !(g && !h.original))
  const conflicting = others.filter((h) =>
    (['spf', 'dkim', 'dmarc'] as const).some((m) => {
      const theirs = methodResult(h, m)
      const ours = summary[m]
      return theirs === 'pass' && ours !== null && ours !== 'pass'
    }),
  )
  if (conflicting.length) {
    findings.add(
      'auth-conflicting-results',
      `The message contains a second authentication header claiming everything passed, but your mail provider's own check says otherwise. Senders can forge these.`,
      conflicting.map((h) => `untrusted (header #${h.index + 1}, ${h.authservId ?? 'no id'}): ${clip(h.raw, 140)}`),
    )
  } else if (others.length) {
    findings.add(
      'auth-extra-results',
      'The message contains authentication headers from servers other than your mail provider; only the provider’s own header is trusted here.',
      others.map((h) => `header #${h.index + 1} (${h.authservId ?? 'no id'}): ${clip(h.raw, 140)}`),
    )
  }

  if (!summary.providerVerified) {
    findings.add(
      'auth-unverified-provider',
      'Could not confirm that the authentication header was written by the server that received this message.',
      `authserv-id: ${t.authservId ?? '(none)'}`,
    )
  }
}
