import type { FindingKind } from '../config'
import type { FindingSet } from '../findings'
import { defangText } from '../export'
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
    kind: 'content-deal',
    re: /\b((?:up to |save |get )?[5-9]\d ?% off|(?:store|shop) closing|closing (?:down|sale)|going out of business|liquidation|clearance sale|final clearance|today only|last day|only \d+ left|limited stock|while supplies last|free shipping (?:today|on all)|(?:huge|massive|insane) (?:sale|discount)s?|buy (?:1|one) get (?:2|two|3|three) free)\b/gi,
    explanation: 'It advertises a huge discount or a clearance with pressure to buy now, the classic bait of fake online stores.',
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

// Invisible characters scammers use to split words past filters ("pay\u200Bpal") or, with
// direction overrides, to make a link or file name read differently from what it is.
// Zero-width joiners (emoji sequences, some scripts) are left alone.
const DIRECTION = /[\u202A-\u202E\u2066-\u2069]/
const HIDDEN = /[\u202A-\u202E\u2066-\u2069\u200B\u200E\u200F\u2060-\u2064\uFEFF\u00AD]/g
const codeOf = (c: string) => `[U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}]`

/** Flags hidden characters and returns the text without them, so the real links can be checked. */
export function checkHiddenChars(text: string, findings: FindingSet): string {
  const body = text.replace(/^\uFEFF/, '')
  const hits = [...body.matchAll(HIDDEN)]
  if (!hits.length) return body
  const evidence = hits.slice(0, 3).map((m) => {
    const at = m.index
    const around = body.slice(Math.max(0, at - 12), at + 13)
    return `"${defangText(around.replace(HIDDEN, codeOf))}"`
  })
  if (hits.some((m) => DIRECTION.test(m[0]))) {
    findings.add(
      'text-bidi-override',
      'It contains invisible characters that flip the direction of text, a trick to make a link or file name look like something else.',
      evidence,
    )
  } else {
    findings.add(
      'text-invisible-chars',
      'It contains invisible characters hidden inside words or links, a trick to slip names like "PayPal" past spam filters.',
      evidence,
    )
  }
  return body.replace(HIDDEN, '')
}

// Case-sensitive on purpose: the name must be capitalized ("are you coming" is not a name).
const WRONG_NUMBER =
  /^\s*(?:(?:[Hh]i|[Hh]ello|[Hh]ey|[Gg]ood (?:morning|afternoon|evening))\b[^\n?]{0,24}?\b(?:[Ii]s this|[Aa]re you)\s+(?:still\s+)?(?:Mr\.?\s+|Mrs\.?\s+|Ms\.?\s+|Miss\s+)?[A-Z][a-z]+\b[^\n?]{0,30}\?|(?:[Ss]orry,?\s+)?(?:[Ww]rong number|[Dd]id I (?:text|message) the wrong (?:number|person)))/
const CALLBACK = /\b(?:call|contact|dial|phone|reach)\b[^.\n]{0,40}?((?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/i
const ACCOUNT_TALK =
  /\b(account|card|order|charge[ds]?|payment|refund|subscription|locked|suspended|fraud|unauthori[sz]ed|renewal|invoice|security|support|geek squad|norton|mcafee|paypal|amazon|apple|microsoft|bank)\b/i
// Fake renewal/refund receipts: real card alerts with a number say "call the number on the
// back of your card", not "call us to cancel this $399 renewal". All three parts must appear.
const RENEWAL = /\b(?:auto-?renew\w*|renew(?:al|ed)|subscription|membership)\b/i
const AMOUNT = /\$\s?\d/
const CANCEL = /\b(?:cancel\w*|dispute|refund\w*)\b/i
// Gift cards are untraceable; asking for photos of the backs (or the codes) is the tell.
const GIFT_CARD = /\bgift ?cards?\b/i
const GIFT_CODES =
  /\b(?:(?:photos?|pictures?|pics?|snapshots?) of (?:the |both |each |all )?(?:backs?|(?:gift )?cards?|codes?|receipts?|pins?)\b|(?:send|text|give) (?:me|us) the (?:codes?|numbers?|pins?|card numbers?)|(?:codes?|numbers?|pins?) (?:on|from) the back|scratch (?:off )?the)/i
// "Send me the code you just got": taking over an account by relaying a one-time code.
// A plain "send me the code" (wifi, door) needs a sign it is a code the person just received.
const CODE_RELAY =
  /\b(?:send|forward|tell|give|share|text|read)\s+(?:me|us)\s+(?:back\s+)?(?:the|that|this|your)\s+(?:(?:(?:\d|four|five|six|eight)[- ]digit\s+(?:verification\s+|security\s+|login\s+)?code)|(?:verification|security|confirmation|login|one-time|otp|google|whatsapp|facebook|apple)\s+code|code\s+(?:you|that|which)\s+(?:just\s+)?(?:got|received|was sent|came|we sent))/i

export function checkSmsTricks(text: string, findings: FindingSet): void {
  const opener = WRONG_NUMBER.exec(text.slice(0, 240))
  if (opener) {
    findings.add(
      'sms-wrong-number',
      'It opens like a message sent to the wrong person. That is how many investment ("pig butchering") and romance scams start: a polite reply leads to a friendly chat, then to a "can\'t-miss" investment.',
      `"${clip(opener[0].trim(), 80)}"`,
    )
  }
  const call = CALLBACK.exec(text)
  if (call && ACCOUNT_TALK.test(text)) {
    findings.add(
      'sms-callback-number',
      "It asks you to call a phone number about an account or charge. Scammers use their own numbers to get you on the phone; look up the company's real number yourself.",
      `"${clip(call[0].trim(), 80)}"`,
    )
    const renewal = RENEWAL.exec(text)
    if (renewal && AMOUNT.test(text) && CANCEL.test(text)) {
      findings.add(
        'sms-callback-charge',
        'It reports a charge or renewal you did not expect and gives a number to cancel it. This is how refund scams start: the "agent" asks for remote access or your bank login to "refund" you.',
        `"${clip(renewal[0], 40)}"`,
      )
    }
  }
  const gift = GIFT_CODES.exec(text)
  if (gift && GIFT_CARD.test(text)) {
    findings.add(
      'sms-gift-card-codes',
      'It asks you to buy gift cards and send the codes or photos of them. No real company, government office or person in trouble asks for payment this way.',
      `"${clip(gift[0].trim(), 80)}"`,
    )
  }
  const relay = CODE_RELAY.exec(text)
  if (relay) {
    findings.add(
      'sms-code-relay',
      'It asks you to pass on a code that was just texted to you. That code lets them take over your account (WhatsApp, Google, your bank); never share it.',
      `"${clip(relay[0].trim(), 80)}"`,
    )
  }
  const m = SMS_REPLY_TRICK.exec(text)
  if (m) {
    findings.add(
      'sms-reply-to-activate',
      'It asks you to reply so the link becomes tappable, a trick to get around your phone’s protection against links from unknown senders.',
      `"${clip(m[0], 100)}"`,
    )
  }
}
