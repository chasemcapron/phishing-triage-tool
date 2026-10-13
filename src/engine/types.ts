import type { FindingKind } from './config'

export type Verdict = 'high' | 'suspicious' | 'none'
export type Severity = 'high' | 'medium' | 'low' | 'info'
export type FindingCategory = 'auth' | 'sender' | 'relay' | 'links' | 'attachments' | 'content' | 'reputation'

export interface Finding {
  kind: FindingKind
  category: FindingCategory
  /** Short analyst-facing title, e.g. "DMARC failed". */
  title: string
  /** One plain-English sentence for non-technical readers. */
  explanation: string
  weight: number
  severity: Severity
  /** Technical evidence (header values, URLs, filenames). Untrusted text: always render escaped. */
  evidence: string[]
  /** A known-bad reputation hit forces a High verdict regardless of score. */
  forceHigh?: boolean
  /** MITRE ATT&CK technique IDs (see attack.ts). */
  attack: string[]
  /** Data source for reputation findings; Google attribution is shown only for 'google-safe-browsing'. */
  source?: 'google-safe-browsing' | 'virustotal' | 'urlhaus' | 'rdap'
  /** Threat types for Safe Browsing findings (drives the "learn more" link). */
  threatTypes?: string[]
}

export type LinkSource = 'text' | 'html-link' | 'html-form'

export interface LinkInfo {
  /** Normalized URL (bare domains are prefixed with http:// internally). */
  url: string
  defanged: string
  host: string
  /** Host with punycode (xn--) labels decoded, for display. */
  unicodeHost: string
  registrableDomain: string | null
  scheme: string
  isIp: boolean
  /** Written without a scheme in the source text, e.g. "delivery-update.top/track". */
  isBare: boolean
  displayTexts: string[]
  sources: LinkSource[]
  flags: FindingKind[]
  reputation?: LinkReputation
}

export interface LinkReputation {
  safeBrowsing?: string[]
  virusTotal?: { malicious: number; suspicious: number; link?: string; found: boolean }
  urlhaus?: { status?: string; threat?: string; reference?: string }
  domainAgeDays?: number
  domainRegistered?: string
}

export interface AuthMethodResult {
  method: string
  result: string
  props: Record<string, string>
}

export interface AuthResultsHeader {
  /** Position among Authentication-Results headers, 0 = topmost (added last). */
  index: number
  kind: 'auth' | 'arc'
  authservId: string | null
  methods: AuthMethodResult[]
  raw: string
  trusted: boolean
}

export interface AuthSummary {
  /** Friendly name of the receiving provider whose header we trust. */
  provider: string | null
  /** Whether the trusted header's authserv-id matches the server that received the message. */
  providerVerified: boolean
  trusted: AuthResultsHeader | null
  spf: string | null
  dkim: string | null
  dmarc: string | null
  headers: AuthResultsHeader[]
}

export type IpClass = 'public' | 'private' | 'loopback' | 'link-local' | 'cgnat' | 'documentation' | 'reserved'

export interface Hop {
  /** Chronological position: 0 = first server that handled the message. */
  index: number
  from: string | null
  fromIp: string | null
  ipClass: IpClass | null
  by: string | null
  protocol: string | null
  /** ISO timestamp, or null when the date could not be parsed. */
  date: string | null
  delaySeconds: number | null
  /** The hop where the message crossed into the recipient's mail provider. */
  isBoundary: boolean
  raw: string
}

export interface AttachmentInfo {
  filename: string
  mimeType: string
  size: number
  sha256: string
  disposition: string | null
  detectedType: string | null
  archiveEntries: string[] | null
  encryptedArchive: boolean
  flags: FindingKind[]
  virusTotal?: { malicious: number; suspicious: number; link?: string; found: boolean; label?: string }
  urlhaus?: { threat?: string; reference?: string }
}

export interface Iocs {
  urls: string[]
  domains: string[]
  ips: string[]
  emails: string[]
  hashes: string[]
}

export interface EmailDetails {
  subject: string | null
  date: string | null
  from: { name: string; address: string } | null
  replyTo: string | null
  returnPath: string | null
  messageId: string | null
  auth: AuthSummary
  hops: Hop[]
  attachments: AttachmentInfo[]
}

export interface Report {
  mode: 'text' | 'email'
  verdict: Verdict
  verdictLabel: string
  score: number
  findings: Finding[]
  /** Two or three plain-English reasons for the Simple view. */
  reasons: string[]
  links: LinkInfo[]
  email: EmailDetails | null
  iocs: Iocs
  /** Present once online reputation checks have run (or were turned off). */
  reputation?: ReputationSummary
}

export interface ReputationSummary {
  state: 'off' | 'done' | 'failed'
  /** Per-provider status line for the UI. */
  providers: { name: string; status: string; message?: string }[]
  /** What was sent (for transparency). */
  sent: { urls: number; domains: number; hashes: number }
  checkedAt: string
}
