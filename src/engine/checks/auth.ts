import type { FindingSet } from '../findings'
import { looksLikeMicrosoft, methodResult, providerName } from '../parse/authResults'
import type { AuthResultsHeader, AuthSummary, Hop } from '../types'
import { registrable } from '../util/domain'
import { clip } from '../util/text'

/**
 * Trust model: only the topmost Authentication-Results header was added by the
 * recipient's own provider (each server prepends its headers). Anything below it
 * arrived with the message and may have been written by the sender.
 */
export function summarizeAuth(all: AuthResultsHeader[], hops: Hop[]): AuthSummary {
  const auth = all.filter((h) => h.kind === 'auth')
  const trusted = auth[0] ?? null
  if (trusted) trusted.trusted = true

  let providerVerified = false
  const boundary = hops.find((h) => h.isBoundary)
  if (trusted && boundary?.by) {
    providerVerified = trusted.authservId
      ? registrable(trusted.authservId) === registrable(boundary.by)
      : looksLikeMicrosoft(trusted) && /(^|\.)(protection|prod)\.outlook\.[a-z]+$/i.test(boundary.by)
  }

  return {
    provider: trusted ? providerName(trusted) : null,
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
  const others = summary.headers.filter((h) => h.kind === 'auth' && !h.trusted && h.authservId !== t.authservId)
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
