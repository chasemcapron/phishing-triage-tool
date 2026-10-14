export const FREE_WEBMAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com',
  'pm.me', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'yandex.ru', 'zoho.com', 'tutanota.com',
  'tuta.io', 'fastmail.com', 'qq.com', '163.com', 'mail.ru', 'inbox.com', 'hushmail.com',
])

/** Words in a display name that claim to speak for an organization. */
export const ORG_WORDS =
  /\b(hr|human resources|department|dept|recruit\w*|talent|hiring|careers?|support|team|help ?desk|security|billing|payroll|accounts?|finance|inc|llc|ltd|corp(oration)?|company|bank|university|college|admin(istrator)?|services?|official|customer care|traders|group|staff)\b/i

export const URL_SHORTENERS = new Set([
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly',
  'shorturl.at', 't.ly', 'rb.gy', 'tiny.cc', 's.id', 'v.gd', 'bl.ink', 'short.io', 'lnkd.in', 'qrco.de',
  'tinu.be', 'shorturl.com', 'clck.ru', 'u.to', 'x.co',
])

/** Query parameters that commonly carry a second, forwarded-to URL. */
export const REDIRECT_PARAMS = new Set([
  'url', 'u', 'redirect', 'redirect_url', 'redirect_uri', 'redirecturl', 'redir', 'next', 'return', 'returnurl',
  'return_url', 'returnto', 'continue', 'dest', 'destination', 'target', 'goto', 'go', 'r', 'link', 'out', 'to',
])

/** Message-ID hosts used by large mail platforms (a From/Message-ID mismatch is normal for them). */
export const MTA_MESSAGE_ID_DOMAINS = new Set([
  'outlook.com', 'gmail.com', 'google.com', 'amazonses.com', 'sendgrid.net', 'mcsv.net', 'mailchimp.com',
  'mailgun.org', 'sparkpostmail.com', 'mandrillapp.com', 'exacttarget.com', 'salesforce.com', 'hubspot.com',
  'yahoo.com', 'icloud.com', 'zendesk.com', 'freshdesk.com', 'postmarkapp.com', 'mtasv.net', 'sendinblue.com',
  'brevo.com', 'constantcontact.com', 'ccsend.com', 'klaviyomail.com', 'xt.local',
])

export const EXEC_EXTS = new Set([
  'exe', 'scr', 'com', 'pif', 'bat', 'cmd', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'hta', 'lnk', 'msi',
  'msix', 'ps1', 'jar', 'cpl', 'reg', 'dll', 'appx', 'appinstaller', 'url', 'scf', 'chm',
])
export const DISK_IMAGE_EXTS = new Set(['iso', 'img', 'vhd', 'vhdx'])
export const ONENOTE_EXTS = new Set(['one', 'onepkg'])
export const MACRO_EXTS = new Set(['docm', 'dotm', 'xlsm', 'xltm', 'xlsb', 'xlam', 'pptm', 'potm', 'ppam', 'sldm'])
export const HTML_EXTS = new Set(['html', 'htm', 'shtml', 'xhtml', 'mht', 'mhtml', 'svg'])
export const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z', 'gz', 'tgz', 'tar', 'cab', 'ace', 'arj', 'bz2', 'xz'])
/** Extensions a double-extension trick pretends to be. */
export const DOC_EXTS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'jpg', 'jpeg', 'png', 'gif',
  'mp3', 'mp4', 'mov', 'wav', 'zip', 'html', 'htm', 'odt', 'ods',
])

/**
 * Domain endings that are cheap to register and heavily used by short-lived fake stores and
 * phishing pages (per Spamhaus, Interisle and Netcraft TLD abuse reports). A weak signal only.
 */
export const RISKY_TLDS = new Set([
  'shop', 'store', 'online', 'site', 'website', 'top', 'xyz', 'icu', 'cyou', 'sbs', 'cfd', 'bond', 'buzz',
  'vip', 'click', 'lat', 'rest', 'monster', 'cam', 'boutique', 'sale', 'deals', 'win', 'fun', 'space',
])

/**
 * Domains one mail provider uses for its own servers. A hop between two of them is internal,
 * not a handoff between organizations (Microsoft passes mail from outlook.com to office365.com).
 */
export const PROVIDER_FAMILIES: string[][] = [
  ['outlook.com', 'office365.com', 'microsoft.com', 'office.com', 'exchangelabs.com'],
  ['google.com', 'gmail.com', 'googlemail.com'],
  ['yahoo.com', 'yahoodns.net', 'aol.com'],
  ['icloud.com', 'me.com', 'apple.com'],
]

/**
 * Email security gateways organizations put in front of their mailboxes: the domains their
 * servers use, and the authserv-ids their Authentication-Results headers carry.
 */
export const GATEWAYS: { name: string; hosts: string[]; authserv: string[] }[] = [
  { name: 'Proofpoint', hosts: ['pphosted.com', 'ppe-hosted.com', 'proofpoint.com'], authserv: ['ppops.net', 'pphosted.com', 'proofpoint.com'] },
  { name: 'Mimecast', hosts: ['mimecast.com', 'mimecast-offshore.com'], authserv: ['mimecast.com'] },
  { name: 'Cisco Secure Email', hosts: ['iphmx.com'], authserv: ['iphmx.com'] },
  { name: 'Barracuda', hosts: ['barracudanetworks.com', 'cudasvc.com'], authserv: ['barracudanetworks.com'] },
  { name: 'Broadcom Email Security', hosts: ['messagelabs.com'], authserv: ['messagelabs.com'] },
  { name: 'Trend Micro', hosts: ['trendmicro.com', 'trendmicro.eu'], authserv: ['trendmicro.com'] },
]

/**
 * Free website, form and file hosts where anyone can publish a page in minutes. Their main
 * domains are old and reputable, so blocklists and domain age often miss phishing hosted there.
 * exact: the host itself is the user-content host (forms.gle); otherwise a subdomain is required
 * (anything.pages.dev, but not www.wordpress.com). path: only that path counts (Google Forms).
 */
export const FREE_HOSTS: { host: string; name: string; kind: 'site' | 'form'; exact?: boolean; path?: string }[] = [
  ...(
    [
      ['pages.dev', 'Cloudflare Pages'], ['workers.dev', 'Cloudflare Workers'], ['r2.dev', 'Cloudflare R2'], ['trycloudflare.com', 'a Cloudflare tunnel'],
      ['github.io', 'GitHub Pages'], ['gitlab.io', 'GitLab Pages'], ['vercel.app', 'Vercel'], ['netlify.app', 'Netlify'],
      ['web.app', 'Firebase'], ['firebaseapp.com', 'Firebase'], ['glitch.me', 'Glitch'], ['onrender.com', 'Render'],
      ['herokuapp.com', 'Heroku'], ['replit.app', 'Replit'], ['repl.co', 'Replit'], ['weebly.com', 'Weebly'], ['weeblysite.com', 'Weebly'],
      ['wixsite.com', 'Wix'], ['square.site', 'Square Online'], ['godaddysites.com', 'GoDaddy'], ['webflow.io', 'Webflow'],
      ['framer.website', 'Framer'], ['framer.app', 'Framer'], ['blogspot.com', 'Blogger'], ['wordpress.com', 'WordPress.com'],
      ['carrd.co', 'Carrd'], ['notion.site', 'Notion'], ['canva.site', 'Canva'], ['jimdosite.com', 'Jimdo'], ['mystrikingly.com', 'Strikingly'],
      ['yolasite.com', 'Yola'], ['000webhostapp.com', '000webhost'], ['azurewebsites.net', 'Azure'], ['web.core.windows.net', 'Azure Storage'],
      ['ngrok-free.app', 'ngrok'], ['ipfs.io', 'IPFS'], ['dweb.link', 'IPFS'], ['s3.amazonaws.com', 'Amazon S3'],
      ['typeform.com', 'Typeform'],
    ] as const
  ).map(([host, name]) => ({ host, name, kind: host === 'typeform.com' ? ('form' as const) : ('site' as const) })),
  { host: 'storage.googleapis.com', name: 'Google Cloud Storage', kind: 'site', exact: true },
  { host: 'firebasestorage.googleapis.com', name: 'Firebase Storage', kind: 'site', exact: true },
  { host: 'sites.google.com', name: 'Google Sites', kind: 'site', exact: true },
  { host: 'forms.gle', name: 'Google Forms', kind: 'form', exact: true },
  { host: 'docs.google.com', name: 'Google Forms', kind: 'form', exact: true, path: '/forms' },
  { host: 'forms.office.com', name: 'Microsoft Forms', kind: 'form', exact: true },
  { host: 'forms.microsoft.com', name: 'Microsoft Forms', kind: 'form', exact: true },
  { host: 'form.jotform.com', name: 'Jotform', kind: 'form', exact: true },
]
