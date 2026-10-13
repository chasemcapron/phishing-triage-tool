/** hxxps[://]example[.]com/path — safe to paste into tickets and chats. */
export function defangUrl(url: string): string {
  const m = /^([a-z][a-z0-9+.-]*):(\/\/)?([^/?#]*)(.*)$/i.exec(url)
  if (!m) return defangHost(url)
  const [, scheme = '', slashes, authority = '', rest = ''] = m
  const s = scheme.toLowerCase().replace(/^http/, 'hxxp')
  if (!slashes) return `${s}[:]${authority}${rest}`
  return `${s}[://]${defangHost(authority)}${rest}`
}

export function defangHost(host: string): string {
  return host.replace(/\./g, '[.]').replace(/@/g, '[@]')
}

export function defangEmail(address: string): string {
  return address.replace(/@/g, '[@]').replace(/\./g, '[.]')
}

/** Reverses common defanging so pasted analyst indicators can be analyzed. */
export function refang(text: string): string {
  return text
    .replace(/\bhxxp(s?)/gi, 'http$1')
    .replace(/\bfxp\b/gi, 'ftp')
    .replace(/\[:\/\/\]/g, '://')
    .replace(/\[:\]/g, ':')
    .replace(/\[(\.|dot)\]|\((\.|dot)\)|\{(\.|dot)\}/gi, '.')
    .replace(/\[@\]|\[at\]/gi, '@')
}
