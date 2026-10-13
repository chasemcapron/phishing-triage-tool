import type { FindingKind } from '../config'
import type { FindingSet } from '../findings'
import { clip } from '../util/text'

// Weak signals: plenty of legitimate mail says "urgent" too, so these are low weight
// and capped in total (see CONTENT_CAP).
const PATTERNS: { kind: FindingKind; re: RegExp; explanation: string }[] = [
  {
    kind: 'content-sensitive-info',
    re: /\b(social security(?: number)?|ssn|date of birth|routing number|account number|bank (?:details|account|information)|banking details|mother'?s maiden name|card (?:number|details)|cvv|one-time (?:code|passcode)|verification code)\b/gi,
    explanation: 'It asks for sensitive personal or banking information that legitimate organizations do not request this way.',
  },
  {
    kind: 'content-urgency',
    re: /\b(within \d+ (?:hours?|hrs?|minutes?|days?)|expires? (?:today|soon|in \d+)|immediately|urgent(?:ly)?|act now|final (?:notice|warning|reminder)|action required|suspen(?:d|ded|sion)|(?:account|card) (?:is |has been )?(?:locked|disabled|on hold)|deactivat\w+|overdue|avoid (?:losing|a late fee|suspension|interruption|service interruption)|limited time|returned to sender|will be (?:closed|deleted|terminated|returned))\b/gi,
    explanation: 'It uses pressure and deadlines to rush you into acting before you think.',
  },
  {
    kind: 'content-credentials',
    re: /\b((?:verify|confirm|validate|update|re-?activate|unlock) (?:your )?(?:account|password|identity|login|credentials|details|information|payment|billing)|sign in to (?:view|confirm|verify|continue|restore)|password (?:expires|expired|will expire)|keep (?:my|your) (?:current )?password)\b/gi,
    explanation: 'It asks you to sign in or "verify" your account, the usual setup for stealing a password.',
  },
  {
    kind: 'content-payment',
    re: /\b(gift ?cards?|wire transfer|wire (?:the|payment)|zelle|venmo|cash ?app|bitcoin|crypto(?:currency)?|western union|moneygram|outstanding (?:toll )?balance|unpaid (?:toll|balance|invoice)|toll balance|late fee|payment (?:required|overdue|due)|pay (?:now|within|today|the balance)|send the balance|deposit the check|banking details have changed)\b/gi,
    explanation: 'It pushes a payment or money transfer, often by methods that are hard to reverse.',
  },
  {
    kind: 'content-generic-greeting',
    re: /^[ \t]*((?:dear|hello|hi)[ \t]+(?:user|customer|client|member|applicant|candidate|sir|madam|sir\/madam|account ?holder|valued [a-z]+|friend|[\w.+-]+@[\w.-]+)|hello|hi there|greetings)[ \t]*[,!:]?[ \t]*$/gim,
    explanation: 'It opens with a generic greeting instead of your name.',
  },
]

const SMS_REPLY_TRICK =
  /\breply\s+(?:with\s+)?["“']?(?:y|yes|1)["”']?\b[^.\n]{0,80}\b(?:re-?open|activate|enable|click|access)\b|\b(?:copy|paste)\s+(?:the|this)\s+link\s+into\b/i

export function checkContent(text: string, findings: FindingSet): void {
  // Phrases may wrap across lines; only the greeting check needs line structure.
  const flat = text.replace(/\s+/g, ' ')
  for (const p of PATTERNS) {
    const source = p.kind === 'content-generic-greeting' ? text : flat
    const hits = [...new Set([...source.matchAll(p.re)].map((m) => clip(m[0], 60).toLowerCase()))]
    if (hits.length) findings.add(p.kind, p.explanation, hits.slice(0, 5).map((h) => `"${h}"`))
  }
}

export function checkSmsTricks(text: string, findings: FindingSet): void {
  const m = SMS_REPLY_TRICK.exec(text)
  if (m) {
    findings.add(
      'sms-reply-to-activate',
      'It asks you to reply so the link becomes tappable, a trick to get around your phone’s protection against links from unknown senders.',
      `"${clip(m[0], 100)}"`,
    )
  }
}
