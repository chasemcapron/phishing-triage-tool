// MITRE ATT&CK tags for findings. Every ID and name was verified against ATT&CK v19.2 and the
// v20.0 STIX bundles (2026-10-13). Notably T1656 "Impersonation" and T1672 "Email Spoofing" were
// revoked in v19 and replaced by T1684.001 and T1684.002; tests pin this catalog.
import type { FindingKind } from './config'
import type { Finding, Report } from './types'

export interface Technique {
  id: string
  name: string
  tactic: string
  matrix: 'Enterprise' | 'Mobile'
  url: string
}

const t = (id: string, name: string, tactic: string, matrix: Technique['matrix'] = 'Enterprise'): Technique => ({
  id,
  name,
  tactic,
  matrix,
  url: `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`,
})

export const ATTACK_VERSION = 'ATT&CK v19.2 (IDs verified unchanged in v20.0)'

export const TECHNIQUES: Record<string, Technique> = Object.fromEntries(
  [
    t('T1583.001', 'Acquire Infrastructure: Domains', 'Resource Development'),
    t('T1585.002', 'Establish Accounts: Email Accounts', 'Resource Development'),
    t('T1608.005', 'Stage Capabilities: Link Target', 'Resource Development'),
    t('T1598', 'Phishing for Information', 'Reconnaissance'),
    t('T1598.002', 'Phishing for Information: Spearphishing Attachment', 'Reconnaissance'),
    t('T1598.003', 'Phishing for Information: Spearphishing Link', 'Reconnaissance'),
    t('T1566.001', 'Phishing: Spearphishing Attachment', 'Initial Access'),
    t('T1566.002', 'Phishing: Spearphishing Link', 'Initial Access'),
    t('T1660', 'Phishing', 'Initial Access', 'Mobile'),
    t('T1204.001', 'User Execution: Malicious Link', 'Execution'),
    t('T1204.002', 'User Execution: Malicious File', 'Execution'),
    t('T1036', 'Masquerading', 'Stealth'),
    t('T1036.002', 'Masquerading: Right-to-Left Override', 'Stealth'),
    t('T1036.007', 'Masquerading: Double File Extension', 'Stealth'),
    t('T1036.008', 'Masquerading: Masquerade File Type', 'Stealth'),
    t('T1684.001', 'Social Engineering: Impersonation', 'Stealth'),
    t('T1684.002', 'Social Engineering: Email Spoofing', 'Stealth'),
  ].map((x) => [x.id, x]),
)

const TACTIC_ORDER = ['Resource Development', 'Reconnaissance', 'Initial Access', 'Execution', 'Stealth']

const LOOKALIKE: FindingKind[] = ['link-lookalike', 'link-combosquat', 'link-brand-tld', 'link-idn', 'link-popular-lookalike']
const LINK_DECEPTION: FindingKind[] = [
  'link-brand-subdomain',
  'link-text-mismatch',
  'link-userinfo',
  'link-raw-ip',
  'link-redirect-param',
  'link-many-subdomains',
  'link-script-uri',
]
const EXEC_ATTACHMENT: FindingKind[] = ['att-executable', 'att-archive-exec', 'att-disk-image', 'att-onenote', 'att-macro', 'att-archive-encrypted']
const CREDENTIAL_INTENT: FindingKind[] = ['content-credentials', 'content-sensitive-info', 'link-html-form', 'link-http-login']
const IMPERSONATION: FindingKind[] = ['sender-display-brand', 'sender-display-email', 'sender-freemail-org', 'sender-lookalike-domain']
const DECEPTION: FindingKind[] = [...LOOKALIKE, ...LINK_DECEPTION, ...IMPERSONATION, 'link-brand-mention', 'link-shortener']

/** Technique IDs for one finding, given the rest of the report (conservative mapping). */
export function techniquesFor(f: Finding, report: Pick<Report, 'mode' | 'findings' | 'links'>): string[] {
  const kinds = new Set(report.findings.map((x) => x.kind))
  const any = (list: FindingKind[]) => list.some((k) => kinds.has(k))
  const credential = any(CREDENTIAL_INTENT)
  const linkTech = credential ? ['T1566.002', 'T1598.003'] : ['T1566.002']
  const k = f.kind

  // SMS / chat text: Mobile ATT&CK "Phishing" (explicitly covers smishing). Lookalike
  // domains still get the Resource Development tag.
  if (report.mode === 'text') {
    if (LOOKALIKE.includes(k)) return ['T1583.001', 'T1660']
    if (k === 'text-bidi-override') return ['T1036.002', 'T1660']
    if (k.startsWith('link-') || k.startsWith('sms-') || k.startsWith('rep-') || k === 'content-credentials' || k === 'content-sensitive-info') {
      return ['T1660']
    }
    if ((k === 'domain-new' || k === 'domain-gone') && any(DECEPTION)) return ['T1583.001']
    return []
  }

  if (LOOKALIKE.includes(k)) return ['T1583.001', ...linkTech]
  if (k === 'sender-lookalike-domain') return ['T1583.001', 'T1684.001']
  if (LINK_DECEPTION.includes(k)) return linkTech
  if (k === 'link-shortener') return [...linkTech, 'T1608.005']
  if (k === 'link-html-form' || k === 'link-http-login') return ['T1598.003']
  if (k === 'att-html') return credential ? ['T1566.001', 'T1598.002'] : ['T1566.001']
  if (EXEC_ATTACHMENT.includes(k)) return ['T1566.001', 'T1204.002']
  if (k === 'att-double-ext') return ['T1566.001', 'T1204.002', 'T1036.007']
  if (k === 'att-filename-trick') {
    const rtlo = f.evidence.some((e) => /[‪-‮⁦-⁩]/.test(e))
    return ['T1566.001', 'T1204.002', rtlo ? 'T1036.002' : 'T1036']
  }
  if (k === 'att-signature-exec') return ['T1566.001', 'T1204.002', 'T1036.008']
  if (k === 'att-signature-mismatch') return ['T1566.001', 'T1036.008']
  if (k === 'sender-display-brand' || k === 'sender-display-email') return ['T1684.001']
  if (k === 'sender-freemail-org') return ['T1684.001', 'T1585.002']
  if (k === 'auth-dmarc-fail' || k === 'auth-spf-fail' || k === 'auth-conflicting-results') return ['T1684.002']
  if (k === 'content-credentials' || k === 'content-sensitive-info') {
    return report.links.length ? ['T1598.003'] : ['T1598']
  }
  if (k === 'content-payment' && any(IMPERSONATION)) return ['T1684.001']
  if (k === 'rep-safe-browsing' || k === 'rep-urlhaus' || k === 'rep-virustotal-malicious') {
    const malware = f.evidence.some((e) => /MALWARE|UNWANTED_SOFTWARE|malware_download|POTENTIALLY_HARMFUL/i.test(e))
    return malware ? ['T1566.002', 'T1204.001'] : linkTech
  }
  if ((k === 'domain-new' || k === 'domain-gone') && any(DECEPTION)) return ['T1583.001']
  return []
}

/** Fills finding.attack for every finding (mutates and returns the same array). */
export function tagFindings(report: Pick<Report, 'mode' | 'findings' | 'links'>): Finding[] {
  for (const f of report.findings) f.attack = techniquesFor(f, report)
  return report.findings
}

/** Unique techniques across a report, in kill-chain order. */
export function reportTechniques(report: Pick<Report, 'findings'>): Technique[] {
  const ids = new Set(report.findings.flatMap((f) => f.attack))
  return [...ids]
    .map((id) => TECHNIQUES[id])
    .filter((x): x is Technique => Boolean(x))
    .sort((a, b) => TACTIC_ORDER.indexOf(a.tactic) - TACTIC_ORDER.indexOf(b.tactic) || a.id.localeCompare(b.id))
}
