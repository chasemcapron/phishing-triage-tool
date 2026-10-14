// Every scoring knob lives in this file: weights, thresholds and limits.
//
// Score = sum of the weights of distinct findings (a check that fires on several
// links counts once), with content signals capped at CONTENT_CAP because they are
// weak on their own. Any finding with forceHigh (a known-bad reputation hit) makes
// the verdict High regardless of score.

import type { FindingCategory, Verdict } from './types'

export const THRESHOLDS = { high: 60, suspicious: 25 } as const

export const CONTENT_CAP = 20

/** Weight at or above which a finding is shown as high / medium severity (otherwise low; 0 = info). */
export const SEVERITY_AT = { high: 30, medium: 12 } as const

export const VERDICT_LABELS: Record<Verdict, string> = {
  high: 'High risk — likely phishing',
  suspicious: 'Suspicious — be careful',
  none: 'No red flags found',
}

export const LIMITS = {
  maxEmailBytes: 10 * 1024 * 1024,
  maxTextChars: 200_000,
  maxLinks: 200,
  /** Gap between relay hops that counts as a long delay. */
  bigDelaySeconds: 3600,
  /** Clock skew tolerated between servers before timestamps count as out of order. */
  clockSkewSeconds: 300,
  /** Subdomain labels beyond which a host counts as excessive. */
  maxSubdomainLabels: 3,
  /** Domains registered fewer than this many days ago count as newly registered. */
  newDomainDays: 30,
  /** Same, for cheap endings popular with fake stores (.shop, .top, ...), which rarely last 3 months. */
  newRiskyTldDomainDays: 90,
  /** VirusTotal engines that must say "malicious" for a known-bad (forced High) verdict. */
  vtMaliciousEngines: 2,
  /**
   * VirusTotal community reputation at or above which stray engine hits are ignored
   * (google.com has a lone "malicious" vote but reputation in the hundreds).
   */
  vtTrustedReputation: 100,
} as const

interface CheckDef {
  weight: number
  category: FindingCategory
  title: string
}

export const CHECKS = {
  // Sender authentication
  'auth-dmarc-fail': { weight: 35, category: 'auth', title: 'DMARC failed' },
  'auth-dmarc-none': { weight: 8, category: 'auth', title: 'No DMARC protection' },
  'auth-spf-fail': { weight: 20, category: 'auth', title: 'SPF failed' },
  'auth-spf-softfail': { weight: 12, category: 'auth', title: 'SPF soft-failed' },
  'auth-spf-none': { weight: 5, category: 'auth', title: 'No SPF result' },
  'auth-dkim-fail': { weight: 15, category: 'auth', title: 'DKIM signature failed' },
  'auth-dkim-none': { weight: 6, category: 'auth', title: 'Not DKIM-signed' },
  'auth-conflicting-results': { weight: 25, category: 'auth', title: 'Conflicting (likely forged) authentication header' },
  'auth-extra-results': { weight: 8, category: 'auth', title: 'Extra authentication header from another server' },
  'auth-unverified-provider': { weight: 5, category: 'auth', title: 'Authentication header source not confirmed' },
  'auth-missing': { weight: 0, category: 'auth', title: 'No authentication results' },

  // Sender identity
  'sender-lookalike-domain': { weight: 40, category: 'sender', title: 'Sender domain imitates a brand' },
  'sender-display-brand': { weight: 30, category: 'sender', title: 'Display name claims a brand' },
  'sender-display-email': { weight: 25, category: 'sender', title: 'Different address hidden in display name' },
  'sender-freemail-org': { weight: 25, category: 'sender', title: 'Free webmail posing as an organization' },
  'sender-reply-to-mismatch': { weight: 20, category: 'sender', title: 'Reply-To goes to a different domain' },
  'sender-return-path-mismatch': { weight: 8, category: 'sender', title: 'Return-Path domain differs from From' },
  'sender-message-id-mismatch': { weight: 5, category: 'sender', title: 'Message-ID domain differs from From' },

  // Relay path
  'relay-out-of-order': { weight: 15, category: 'relay', title: 'Relay timestamps out of order' },
  'relay-big-delay': { weight: 5, category: 'relay', title: 'Long delay between relays' },
  'relay-private-ip-boundary': { weight: 15, category: 'relay', title: 'Private IP where a public one is expected' },

  // Links
  'link-lookalike': { weight: 40, category: 'links', title: 'Lookalike domain' },
  'link-combosquat': { weight: 35, category: 'links', title: 'Brand name combined with other words' },
  'link-brand-subdomain': { weight: 35, category: 'links', title: 'Brand name hidden in a subdomain' },
  'link-brand-tld': { weight: 25, category: 'links', title: 'Brand name on an unofficial domain' },
  'link-text-mismatch': { weight: 30, category: 'links', title: 'Link text does not match destination' },
  'link-script-uri': { weight: 30, category: 'links', title: 'Script or data link' },
  'link-raw-ip': { weight: 25, category: 'links', title: 'Link to a raw IP address' },
  'link-brand-mention': { weight: 20, category: 'links', title: 'Claims a brand, links elsewhere' },
  'link-html-form': { weight: 20, category: 'links', title: 'Embedded form submits data elsewhere' },
  'link-userinfo': { weight: 20, category: 'links', title: '"@" trick in link' },
  'link-http-login': { weight: 15, category: 'links', title: 'Login-style page over plain HTTP' },
  'link-redirect-param': { weight: 12, category: 'links', title: 'Redirect to another site' },
  'link-shortener': { weight: 10, category: 'links', title: 'URL shortener hides destination' },
  'link-idn': { weight: 10, category: 'links', title: 'International (punycode) domain' },
  'link-many-subdomains': { weight: 8, category: 'links', title: 'Excessive subdomains' },
  'domain-risky-tld': { weight: 8, category: 'links', title: 'Domain ending popular with scam sites' },

  // Attachments
  'att-double-ext': { weight: 40, category: 'attachments', title: 'Double file extension' },
  'att-filename-trick': { weight: 40, category: 'attachments', title: 'Disguised filename' },
  'att-executable': { weight: 35, category: 'attachments', title: 'Executable or script attachment' },
  'att-signature-exec': { weight: 35, category: 'attachments', title: 'Executable disguised as another file type' },
  'att-archive-exec': { weight: 35, category: 'attachments', title: 'Archive contains an executable' },
  'att-disk-image': { weight: 30, category: 'attachments', title: 'Disk image attachment' },
  'att-onenote': { weight: 30, category: 'attachments', title: 'OneNote attachment' },
  'att-html': { weight: 25, category: 'attachments', title: 'HTML attachment' },
  'att-macro': { weight: 25, category: 'attachments', title: 'Macro-enabled Office file' },
  'att-signature-mismatch': { weight: 20, category: 'attachments', title: 'File type does not match its content' },
  'att-archive-encrypted': { weight: 15, category: 'attachments', title: 'Password-protected archive' },
  'att-archive-unchecked': { weight: 5, category: 'attachments', title: 'Archive contents not inspected' },

  // Content (weak, capped by CONTENT_CAP)
  'content-sensitive-info': { weight: 10, category: 'content', title: 'Asks for sensitive personal data' },
  'content-urgency': { weight: 8, category: 'content', title: 'Urgency or pressure language' },
  'content-credentials': { weight: 8, category: 'content', title: 'Asks you to sign in or verify' },
  'content-payment': { weight: 8, category: 'content', title: 'Payment or money-transfer request' },
  'content-deal': { weight: 6, category: 'content', title: 'Too-good-to-be-true deal' },
  'content-generic-greeting': { weight: 4, category: 'content', title: 'Generic greeting' },

  // Text messages
  'sms-reply-to-activate': { weight: 15, category: 'links', title: '"Reply to activate the link" trick' },

  // Reputation and domain age (server lookups). Known-bad hits also force a High verdict.
  'rep-safe-browsing': { weight: 50, category: 'reputation', title: 'Flagged by Google Safe Browsing' },
  'rep-urlhaus': { weight: 50, category: 'reputation', title: 'Listed on URLhaus' },
  'rep-virustotal-malicious': { weight: 45, category: 'reputation', title: 'Flagged malicious on VirusTotal' },
  'rep-virustotal-suspicious': { weight: 20, category: 'reputation', title: 'Flagged by a few VirusTotal engines' },
  'domain-new': { weight: 30, category: 'reputation', title: 'Newly registered domain' },
} as const satisfies Record<string, CheckDef>

export type FindingKind = keyof typeof CHECKS
