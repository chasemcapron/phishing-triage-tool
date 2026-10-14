// Plain-language next steps, matched to the kind of scam, plus where to report it.
import type { Report } from './types'

export type ScamKind = 'wrong-number' | 'callback' | 'shop' | 'toll' | 'delivery' | 'login' | 'general'

export interface ReportLink {
  label: string
  href: string
}

export interface Advice {
  kind: ScamKind
  /** The first step is the most important one; the UI shows it in bold. */
  steps: string[]
  report: ReportLink[]
}

const TOLL = ['E-ZPass', 'SunPass', 'FasTrak', 'TxTag']
const DELIVERY = ['USPS', 'UPS', 'FedEx', 'DHL']
const RETAIL = [
  'Summer Fridays', 'Lululemon', 'Walmart', 'Costco', 'Best Buy', 'The Home Depot', 'Sephora', 'Ulta Beauty', 'Shein', 'Temu',
  'Nike', 'Adidas', 'Stanley', 'Skims', 'Dyson', 'Crocs', 'UGG', 'Ray-Ban', 'The North Face', 'Le Creuset', 'LEGO', 'Ticketmaster',
]

const REPORT = {
  google: { label: 'Report the link to Google', href: 'https://safebrowsing.google.com/safebrowsing/report_phish/' },
  ftc: { label: 'Report it to the FTC', href: 'https://reportfraud.ftc.gov/' },
  ic3: { label: 'Lost money? Report it to the FBI (IC3)', href: 'https://www.ic3.gov/' },
} satisfies Record<string, ReportLink>

/**
 * The link to report: the most suspicious web link, without its ?query and #fragment (they can
 * carry tracking codes that identify the person it was sent to). Google's form pre-fills from it.
 */
export function reportUrl(r: Pick<Report, 'links'>): string | null {
  const web = r.links.filter((l) => l.scheme === 'http' || l.scheme === 'https')
  const link = [...web].sort((a, b) => b.flags.length - a.flags.length)[0]
  if (!link) return null
  const u = new URL(link.url)
  return `${u.origin}${u.pathname}`
}

export function scamKind(r: Pick<Report, 'findings'>): ScamKind {
  const kinds = new Set(r.findings.map((f) => f.kind))
  const said = r.findings.map((f) => `${f.explanation} ${f.evidence.join(' ')}`).join(' ')
  const names = (list: string[]) => list.some((n) => said.includes(n))
  if (kinds.has('sms-wrong-number')) return 'wrong-number'
  if (kinds.has('sms-callback-number')) return 'callback'
  if (names(TOLL) || /\btoll/i.test(said)) return 'toll'
  if (names(DELIVERY)) return 'delivery'
  if (kinds.has('content-deal') || names(RETAIL)) return 'shop'
  if (kinds.has('content-credentials') || kinds.has('link-http-login') || kinds.has('link-html-form')) return 'login'
  return 'general'
}

export function adviceFor(r: Pick<Report, 'verdict' | 'mode' | 'findings' | 'links'>): Advice {
  const email = r.mode === 'email'
  if (r.verdict === 'none') {
    return {
      kind: 'general',
      steps: [
        "If you weren't expecting it, don't use its links. Open the company's app or type its website address yourself.",
        'Never share passwords, one-time codes or card numbers in reply to a message.',
      ],
      report: [],
    }
  }

  const kind = scamKind(r)
  const junk = email
    ? 'Report it as phishing in your mail app (for example "Report phishing" in Gmail or Outlook), then delete it.'
    : 'Report it as junk in your Messages app, or forward the text to 7726 (SPAM) in the US, then delete it.'
  const card = 'Already entered card details? Call your bank using the number on the back of your card.'
  const password = 'Already entered a password? Change it on the real site, and anywhere else you reuse it.'

  const steps: Record<ScamKind, string[]> = {
    'wrong-number': [
      "Don't reply, not even to say it's the wrong number. A reply tells them your number is active.",
      'Block the number and delete the message.',
      'If a stranger you start chatting with steers the talk to investing or crypto, it is a scam.',
    ],
    callback: [
      "Don't call that number.",
      "Worried about the account? Use the number on your card or on the company's real website.",
      'Never let a caller connect to your computer or read you a code to type in.',
      junk,
    ],
    shop: [
      "Don't buy anything from this site.",
      'Already paid? Call your bank or card company now using the number on the back of your card. Dispute the charge and ask for a new card number.',
      'Expect follow-up "refund" calls or texts afterwards: they come from the same scammers.',
      junk,
    ],
    toll: [
      "Don't tap the link or pay. Toll agencies don't collect unpaid tolls by text.",
      "To check for real tolls, open your toll account's app or type its website yourself.",
      junk,
      card,
    ],
    delivery: [
      `Don't tap the link. Carriers don't text you to pay a fee or "confirm your address".`,
      "Track packages in the carrier's app, or type its website yourself.",
      junk,
      card,
    ],
    login: [
      `Don't sign in through ${email ? 'its links' : 'this link'}. Open the app or type the website address yourself.`,
      password,
      junk,
    ],
    general: [`Don't tap or open ${email ? 'its links or attachments' : 'the link'}, and don't reply.`, junk, card, password],
  }
  const out = [...steps[kind]]
  if (email) out.push('At work, report it to your IT or security team before deleting it.')

  const report = [...(reportUrl(r) ? [{ ...REPORT.google, href: `${REPORT.google.href}?url=${encodeURIComponent(reportUrl(r)!)}` }] : []), REPORT.ftc, ...(kind === 'shop' || kind === 'wrong-number' || kind === 'callback' ? [REPORT.ic3] : [])]
  return { kind, steps: out, report }
}
