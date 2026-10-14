// Builds src/engine/data/popular.ts from a Tranco list (https://tranco-list.eu), so lookalike
// checks cover the most visited sites, not just the hand-picked brand list.
//
//   node scripts/make-popular-sites.mjs <tranco top-1m.csv> <list id, e.g. N26LW>
//
// Output: 1,000 lookalike targets (the most popular sites people actually sign in to or buy from,
// skipping CDN/ad/tracking hosts and cheap-TLD domains), and the top 10,000 as "known popular"
// domains that are never flagged as lookalikes themselves. Adult sites are left out of both.
import { readFileSync, writeFileSync } from 'node:fs'
import { getDomain } from 'tldts'

const [csv, listId] = process.argv.slice(2)
if (!csv || !listId) throw new Error('usage: node scripts/make-popular-sites.mjs <top-1m.csv> <list id>')

const TARGETS = 1000
const KNOWN = 10000
// Mirrors RISKY_TLDS in src/engine/data/lists.ts: junk domains climb rankings on these too.
// prettier-ignore
const RISKY_TLDS = new Set(['shop', 'store', 'online', 'site', 'website', 'top', 'xyz', 'icu', 'cyou', 'sbs', 'cfd', 'bond', 'buzz', 'vip', 'click', 'lat', 'rest', 'monster', 'cam', 'boutique', 'sale', 'deals', 'win', 'fun', 'space'])
const INFRA = /cdn|static|adsystem|adservice|adnxs|doubleclick|analytics|metric|tracking|pixel|dns|edge|cloudfront|akamai|syndication|telemetry/
// Sites named after a plain word ("service.gov.uk", "action.com") would make every
// "pik-service" or "action-media" look like an imitation.
// prettier-ignore
const GENERIC = new Set(['service', 'services', 'platform', 'action', 'online', 'mobile', 'nature', 'cloud', 'archive', 'independent', 'clever', 'office', 'news', 'video', 'media', 'today', 'weather', 'search', 'translate', 'usercontent', 'mail', 'games', 'music', 'shopping', 'travel', 'health', 'science', 'energy', 'digital', 'apple-cloudkit'])
// Adult sites never ship, as targets or as known names. Tranco's top ranks are full of them (and
// of mirrors like "xhaccess"), so a pattern alone isn't enough: DENY lists what a manual review of
// the generated target list found.
const ADULT =
  /porn|xxx|xvideo|xhamster|xnxx|redtube|youporn|onlyfans|chaturbate|stripchat|bongacams|spankbang|livejasmin|brazzers|\bsex|sexy|hentai|camsoda|eporner|txxx|fap|jizz|nude|nsfw|pimp|tnaflix|fetlife|boyfriendtv|thisvid|devilz|missav|jable|videoxx|erome|noodlemagazine|^xh[a-z]{3,}\.|pussy|upskirt|prn|jav|escort|manga18|18\.|hitomi|readingmanga|tokyomotion|shahvani|qorno|listcrawler|fatalmodel|cityheaven|joyclub|ladies\.de|simpcity|luxuretv|theblowers|hotornot|eroterest|beeg|fansly|paheal|anal\.|7mmtv|redwap|avple|av-th|avj-th|av19t|av380|doujin|xdate|51cg|nya5|manwa|x-video|xorgasmo|xpaja|arabtnt|kgirls|bokep|swing|erotic|libertine|skokka|skipthegames|anybunny|hotxv|wnacg|imgsrc|leaktube|tgtube|darkero/i
// Reviewed by hand against list N26LW: adult-adjacent, piracy and downloader sites, DNS and
// registrar infrastructure, and opaque ad, tracking or device-telemetry domains nobody would type
// or be phished with.
// prettier-ignore
const DENY = new Set([
  // adult-adjacent
  'janitorai.com', 'polybuzz.ai', 'donmai.us', 'dlsite.com', 'furaffinity.net', 'tsyndicate.com', 'toyhou.se',
  // piracy and downloaders
  'asurascans.com', 'comix.to', 'mangabuff.ru', 'savefrom.net', 'fdown.net', 'sotwe.com', 'liteapks.com', 'ssstik.io', 'snaptik.app',
  'fastdl.app', 'croxyproxy.com', 'musicdel.ir', 'mangago.me', 'czbooks.net', 'freewebnovel.com', 'goojara.to', 'nontondrama.my',
  'taktube.net', 'twkan.com', 'indown.io',
  // infrastructure and reserved
  'example.com', 'root-servers.net', 'gtld-servers.net', 'domaincontrol.com', 'registrar-servers.com', 'akahost.net',
  // opaque ad, tracking, telemetry and parked domains
  'hicloudcam.com', 'triplinkintl.com', 'ailawandorder.com', 'wsdvs.com', 'imcmdb.net', 'mangosip.ru', 'tagomi.com', 'allawnos.com',
  'shalltry.com', 'dotaplabs.net', 'rwwsje.com', 'zenecn.net', 'ueiwsp.com', 'feinidi.com', 'kslawin.com', 'mythad.com', 'salthasher.com',
  'wscvip.cn', 'inkuai.com', 'queniuaa.com', 'vtwenty.com', 'platorelay.com', 'dyingbirds.com', 'vedsalb.com', 'technorail.com',
  'beyondwickedmapping.org', 'rayjump.com', 'adaether.com', 'luugy.com', 'nmrodam.com', 'supertms.com', 'cmediahub.ru', 'geobasket.ru',
  'stbid.ru', 'loobygamesonline.com', 'cootlogix.com', 'kueezrtb.com', 'alphonso.tv', 'iscorp.com', 'wswebpic.com', 'evo-games.com',
  'adgrx.com', 'vidaahub.com', 'shiabank.com', 'yellowblue.io', 'rings.solutions', 'internetwarriors.net', 'bblaa.com', 'luticlip.com',
  'therapservices.net', 'search-start.org', 'wshifen.com', 'admanmedia.com', 'cpmstar.com', 'verify.hn',
])
const excluded = (d) => ADULT.test(d) || DENY.has(d) || d.endsWith('.arpa')

const domains = []
const seen = new Set()
for (const line of readFileSync(csv, 'utf8').split(/\r?\n/)) {
  if (domains.length >= KNOWN) break
  const host = line.split(',')[1]?.trim().toLowerCase()
  if (!host) continue
  const domain = getDomain(host)
  if (!domain || seen.has(domain) || excluded(domain)) continue
  seen.add(domain)
  domains.push(domain)
}

const label = (d) => d.split('.')[0]
const targets = domains
  .filter((d) => !RISKY_TLDS.has(d.split('.').pop()) && /^[a-z][a-z-]{3,}[a-z]$/.test(label(d)) && !INFRA.test(d) && !GENERIC.has(label(d)))
  .slice(0, TARGETS)

// The engine only needs the known domains that could ever be mistaken for a target, so keep
// just those: anything whose name (with common look-alike swaps undone) is within two edits of a
// target, or contains a target as a hyphen-separated word. This cuts the shipped list ~10x.
const ascii = (l) => l.replace(/-/g, '').replace(/0/g, 'o').replace(/[1i]/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/rn/g, 'm').replace(/vv/g, 'w')
function within2(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (Math.min(...cur) > 2) return false
    prev = cur
  }
  return prev[b.length] <= 2
}
const targetNames = targets.map((d) => ascii(label(d)))
const targetSet = new Set(targets)
const knownNeeded = domains.filter((d) => {
  if (targetSet.has(d)) return false // targets are excluded from matching by name already
  const name = ascii(label(d))
  const words = label(d).split('-').map(ascii)
  return targetNames.some((t) => within2(name, t) || words.includes(t))
})

const out = `// Generated by scripts/make-popular-sites.mjs from Tranco list ${listId}
// (https://tranco-list.eu/list/${listId}). Do not edit by hand.
// Tranco: Le Pochat et al., "Tranco: A Research-Oriented Top Sites Ranking Hardened Against
// Manipulation", NDSS 2019.

export const TRANCO_LIST_ID = '${listId}'

/** ${targets.length.toLocaleString('en-US')} popular sites that links are compared against, most popular first. */
export const POPULAR_TARGETS: readonly string[] = ${JSON.stringify(targets.join(' '))}.split(' ')

/**
 * Popular domains (Tranco top ${domains.length.toLocaleString('en-US')}) that are never flagged as lookalikes. Only the
 * ${knownNeeded.length} whose names come close to a target are listed; the rest could never match.
 */
export const POPULAR_KNOWN: readonly string[] = ${JSON.stringify(knownNeeded.join(' '))}.split(' ')
`
writeFileSync(new URL('../src/engine/data/popular.ts', import.meta.url), out)
console.log(`wrote ${targets.length} targets, ${knownNeeded.length} of ${domains.length} known domains, ${(out.length / 1024).toFixed(0)} KB`)
