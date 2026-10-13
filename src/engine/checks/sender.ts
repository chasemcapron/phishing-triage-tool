import { FREE_WEBMAIL, MTA_MESSAGE_ID_DOMAINS, ORG_WORDS } from '../data/lists'
import type { FindingSet } from '../findings'
import { domainOfEmail, registrable } from '../util/domain'
import { mentionedBrands, lookalikeExplanation } from './links'
import { findLookalike, isOfficialFor } from './lookalike'

export interface SenderInput {
  fromName: string
  fromAddress: string | null
  replyTo: string | null
  returnPath: string | null
  messageId: string | null
  dmarc: string | null
}

export function checkSender(s: SenderInput, findings: FindingSet): void {
  const fromHost = domainOfEmail(s.fromAddress)
  const fromDomain = registrable(fromHost)
  if (!fromDomain) return
  const isFreemail = FREE_WEBMAIL.has(fromDomain)
  const name = s.fromName.trim()

  // Sender domain itself imitates a brand.
  const hit = fromHost ? findLookalike(fromHost) : null
  if (hit && hit.type !== 'idn') {
    findings.add('sender-lookalike-domain', lookalikeExplanation(hit, 'The sender address uses'), `From: ${s.fromAddress} (${hit.type}: ${hit.brand})`)
  }

  // Display name claims a brand the sending domain doesn't belong to.
  // Free webmail never counts as official, even outlook.com for "Microsoft".
  if (name) {
    for (const brand of mentionedBrands(name)) {
      if (isOfficialFor(brand, fromDomain) && !isFreemail) continue
      findings.add(
        'sender-display-brand',
        `This claims to be from ${brand.name}, but it was sent from ${fromDomain}, which ${isFreemail ? 'is a free personal email service' : `is not a ${brand.name} domain`}.`,
        `From: "${name}" <${s.fromAddress}>`,
      )
    }

    const embedded = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(name)?.[0]?.toLowerCase()
    if (embedded && embedded !== s.fromAddress) {
      findings.add(
        'sender-display-email',
        `The sender's name shows the address ${embedded}, but the message really came from ${s.fromAddress}.`,
        `From: "${name}" <${s.fromAddress}>`,
      )
    }

    if (isFreemail && ORG_WORDS.test(name)) {
      findings.add(
        'sender-freemail-org',
        `"${name}" presents itself as an organization but writes from a free personal ${fromDomain} account, a hallmark of fake recruiter and vendor scams.`,
        `From: "${name}" <${s.fromAddress}>`,
      )
    }
  }

  const replyDomain = registrable(domainOfEmail(s.replyTo))
  if (replyDomain && replyDomain !== fromDomain) {
    findings.add(
      'sender-reply-to-mismatch',
      `Replies would go to ${replyDomain}, not to ${fromDomain} where the message claims to come from.`,
      `From: ${s.fromAddress} | Reply-To: ${s.replyTo}`,
    )
  }

  // With DMARC passing, a different bounce domain is normal (mailing services).
  const rpDomain = registrable(domainOfEmail(s.returnPath))
  if (rpDomain && rpDomain !== fromDomain && s.dmarc !== 'pass') {
    findings.add(
      'sender-return-path-mismatch',
      `Bounces go to ${rpDomain}, a different domain from the visible sender ${fromDomain}.`,
      `From: ${s.fromAddress} | Return-Path: ${s.returnPath}`,
    )
  }

  const midHost = s.messageId ? /@([^>\s]+)/.exec(s.messageId)?.[1] ?? null : null
  const midDomain = registrable(midHost)
  if (midDomain && midDomain !== fromDomain && !MTA_MESSAGE_ID_DOMAINS.has(midDomain) && s.dmarc !== 'pass') {
    findings.add(
      'sender-message-id-mismatch',
      `The message's internal ID was created by ${midDomain}, not by the claimed sender ${fromDomain}.`,
      `Message-ID: ${s.messageId}`,
    )
  }
}
