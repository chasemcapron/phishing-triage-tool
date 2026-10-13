import PostalMime from 'postal-mime'
import { LIMITS } from './config'
import { analyzeAttachments } from './checks/attachments'
import { checkAuth, summarizeAuth } from './checks/auth'
import { checkContent, checkSmsTricks } from './checks/content'
import { checkBrandMentions, checkLinks } from './checks/links'
import { checkRelay } from './checks/relay'
import { checkSender } from './checks/sender'
import { FindingSet } from './findings'
import { extractHtmlLinks, extractTextLinks, htmlToText, inertParser, normalizeLinks, type HtmlParser } from './links/extract'
import { parseAllAuthResults } from './parse/authResults'
import { extractAddress, firstHeader, parseHeaders } from './parse/headers'
import { parseReceivedChain } from './parse/received'
import { scoreFindings, topReasons } from './score'
import type { AttachmentInfo, EmailDetails, Finding, Iocs, LinkInfo, Report } from './types'
import { refang } from './util/defang'
import { domainOfEmail, isNonRoutable, registrable } from './util/domain'

export interface AnalyzeOptions {
  /** HTML parser override (tests). Defaults to an inert DOMParser document. */
  parseHtml?: HtmlParser
}

export class InputError extends Error {}

/** Mode 1: a pasted link, SMS or chat message. */
export function analyzeText(input: string): Report {
  const text = refang(input.slice(0, LIMITS.maxTextChars))
  const links = normalizeLinks(extractTextLinks(text))
  const findings = new FindingSet()
  checkLinks(links, findings)
  checkBrandMentions(text, links, findings)
  checkContent(text, findings)
  checkSmsTricks(text, findings)
  return buildReport('text', findings.list(), links, null)
}

/** Mode 2: raw email source, headers only, or the bytes of an .eml file. */
export async function analyzeEmail(raw: string | ArrayBuffer | Uint8Array, opts: AnalyzeOptions = {}): Promise<Report> {
  const size = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw.byteLength
  if (size > LIMITS.maxEmailBytes) throw new InputError(`That email is larger than ${LIMITS.maxEmailBytes / 1024 / 1024} MB.`)
  const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
  const headers = parseHeaders(text)
  if (!headers.some((h) => ['from', 'received', 'subject', 'authentication-results', 'message-id'].includes(h.name))) {
    throw new InputError('No email headers found. Paste the full message source ("Show original" / "View source") or drop in an .eml file.')
  }
  const parseHtml = opts.parseHtml ?? inertParser
  const parsed = await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer' })

  const from = parsed.from && 'address' in parsed.from && parsed.from.address
    ? { name: parsed.from.name ?? '', address: parsed.from.address.toLowerCase() }
    : (() => {
        const address = extractAddress(firstHeader(headers, 'from'))
        return address ? { name: '', address } : null
      })()
  const replyToEntry = parsed.replyTo?.find((a) => 'address' in a && a.address)
  const replyTo = replyToEntry && 'address' in replyToEntry ? replyToEntry.address!.toLowerCase() : null
  const returnPath = extractAddress(firstHeader(headers, 'return-path'))
  const messageId = firstHeader(headers, 'message-id')

  const hops = parseReceivedChain(headers)
  const auth = summarizeAuth(parseAllAuthResults(headers), hops)
  const findings = new FindingSet()

  checkAuth(auth, findings, registrable(domainOfEmail(from?.address)))
  checkSender({ fromName: from?.name ?? '', fromAddress: from?.address ?? null, replyTo, returnPath, messageId, dmarc: auth.dmarc }, findings)
  checkRelay(hops, findings)

  const links = normalizeLinks([
    ...(parsed.text ? extractTextLinks(parsed.text) : []),
    ...(parsed.html ? extractHtmlLinks(parsed.html, parseHtml) : []),
  ])
  checkLinks(links, findings)

  const body = parsed.text || (parsed.html ? htmlToText(parsed.html, parseHtml) : '')
  checkContent([parsed.subject ?? '', body].join('\n'), findings)

  const attachments = await analyzeAttachments(
    parsed.attachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      disposition: a.disposition,
      content: a.content instanceof Uint8Array ? a.content : typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content),
    })),
    findings,
  )

  const email: EmailDetails = {
    subject: parsed.subject ?? null,
    date: parsed.date ?? null,
    from,
    replyTo,
    returnPath,
    messageId,
    auth,
    hops,
    attachments,
  }
  return buildReport('email', findings.list(), links, email)
}

export function collectIocs(links: LinkInfo[], email: EmailDetails | null, attachments: AttachmentInfo[] = email?.attachments ?? []): Iocs {
  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))]
  const web = links.filter((l) => l.scheme === 'http' || l.scheme === 'https')
  const boundaryIp = email?.hops.find((h) => h.isBoundary && h.fromIp && h.ipClass && !isNonRoutable(h.ipClass))?.fromIp
  return {
    urls: uniq(web.map((l) => l.url)),
    domains: uniq(web.map((l) => l.registrableDomain)),
    ips: uniq([...web.filter((l) => l.isIp).map((l) => l.host), boundaryIp]),
    emails: uniq([email?.from?.address, email?.replyTo, email?.returnPath]),
    hashes: uniq(attachments.map((a) => a.sha256)),
  }
}

export function buildReport(mode: Report['mode'], findings: Finding[], links: LinkInfo[], email: EmailDetails | null): Report {
  return {
    mode,
    ...scoreFindings(findings),
    findings,
    reasons: topReasons(findings),
    links,
    email,
    iocs: collectIocs(links, email),
  }
}
