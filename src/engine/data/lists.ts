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
  'brevo.com', 'constantcontact.com', 'ccsend.com', 'klaviyomail.com',
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
