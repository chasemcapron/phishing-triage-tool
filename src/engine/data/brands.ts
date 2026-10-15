// Commonly impersonated brands.
//
// keywords: compared against domain labels (after confusable normalization).
//   Keywords of 6+ characters also match as a substring of a label
//   ("paypalsecure"); shorter ones, and any listed in tokenOnly, only match a whole
//   hyphen-separated token so that "pineapple" or "purchase" never hit Apple or Chase.
// domains: registrable domains the brand really uses.
// officialSuffixes: any registrable domain ending in one of these counts as official
//   (e.g. every .gov domain for government services).
// countryDomains: the brand owns this name on every country ending ("google.de", "amazon.co.jp").
// mentions: regex fragments that mean a message or display name claims to be the brand.
// storeOnly: the name is an everyday word ("coach", "yeti"), so domains only match it on a cheap
//   ending (.shop, .top, ...) or next to a store word ("coach-outlet").

export interface Brand {
  name: string
  keywords: string[]
  tokenOnly?: string[]
  domains: string[]
  officialSuffixes?: string[]
  countryDomains?: string
  mentions: string[]
  storeOnly?: boolean
}

export const BRANDS: Brand[] = [
  {
    name: 'Microsoft',
    keywords: ['microsoft', 'microsoftonline', 'office365', 'microsoft365', 'onedrive', 'sharepoint', 'outlook', 'hotmail'],
    tokenOnly: ['outlook'],
    domains: [
      'microsoft.com', 'microsoftonline.com', 'microsoft365.com', 'office.com', 'office365.com', 'office.net',
      'live.com', 'outlook.com', 'hotmail.com', 'msn.com', 'sharepoint.com', 'onedrive.com', 'onenote.com',
      'skype.com', 'azure.com', 'windows.net', 'msauth.net', 'msftauth.net', 'aka.ms',
    ],
    mentions: ['microsoft', 'office ?365', 'outlook', 'onedrive', 'sharepoint', 'hotmail'],
  },
  {
    name: 'Google',
    keywords: ['google', 'gmail', 'googledocs', 'googledrive'],
    domains: ['google.com', 'gmail.com', 'googlemail.com', 'youtube.com', 'googleapis.com', 'gstatic.com', 'g.co', 'goo.gl', 'withgoogle.com'],
    countryDomains: 'google',
    mentions: ['google', 'gmail'],
  },
  {
    name: 'Apple',
    keywords: ['apple', 'icloud', 'appleid', 'itunes'],
    // "icloud" only as a whole word: inside a name it matches every "…cloud" ("huaweicloud").
    tokenOnly: ['icloud'],
    domains: ['apple.com', 'icloud.com', 'me.com', 'mac.com', 'apple.co', 'itunes.com'],
    mentions: ['apple', 'icloud', 'apple ?id', 'itunes'],
  },
  {
    name: 'Amazon',
    keywords: ['amazon', 'primevideo', 'aws'],
    domains: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.jobs', 'a.co', 'amzn.to', 'primevideo.com'],
    countryDomains: 'amazon',
    mentions: ['amazon', 'prime video'],
  },
  {
    name: 'PayPal',
    keywords: ['paypal'],
    domains: ['paypal.com', 'paypal.me', 'paypalobjects.com'],
    mentions: ['paypal'],
  },
  {
    name: 'Chase',
    keywords: ['chase', 'jpmorgan', 'jpmorganchase'],
    domains: ['chase.com', 'jpmorgan.com', 'jpmorganchase.com'],
    mentions: ['chase bank', 'jpmorgan', '^chase\\b'],
  },
  {
    name: 'Bank of America',
    keywords: ['bankofamerica', 'bofa'],
    domains: ['bankofamerica.com', 'bofa.com'],
    mentions: ['bank of america', 'bofa'],
  },
  {
    name: 'Wells Fargo',
    keywords: ['wellsfargo'],
    domains: ['wellsfargo.com', 'wf.com'],
    mentions: ['wells ?fargo'],
  },
  {
    name: 'Citi',
    keywords: ['citibank', 'citi'],
    domains: ['citi.com', 'citibank.com'],
    mentions: ['citibank', 'citi bank'],
  },
  {
    name: 'Capital One',
    keywords: ['capitalone'],
    domains: ['capitalone.com'],
    mentions: ['capital ?one'],
  },
  {
    name: 'U.S. Bank',
    keywords: ['usbank'],
    domains: ['usbank.com'],
    mentions: ['u\\.?s\\.? bank'],
  },
  {
    name: 'Navy Federal',
    keywords: ['navyfederal'],
    domains: ['navyfederal.org'],
    mentions: ['navy federal'],
  },
  {
    name: 'USPS',
    keywords: ['usps'],
    domains: ['usps.com'],
    officialSuffixes: ['.gov'],
    mentions: ['usps', 'postal service'],
  },
  {
    name: 'UPS',
    keywords: ['ups'],
    domains: ['ups.com'],
    mentions: ['\\bups\\b'],
  },
  {
    name: 'FedEx',
    keywords: ['fedex'],
    domains: ['fedex.com'],
    mentions: ['fedex'],
  },
  {
    name: 'DHL',
    keywords: ['dhl'],
    domains: ['dhl.com', 'dhl.de'],
    mentions: ['\\bdhl\\b'],
  },
  {
    name: 'Netflix',
    keywords: ['netflix'],
    domains: ['netflix.com'],
    mentions: ['netflix'],
  },
  {
    name: 'DocuSign',
    keywords: ['docusign'],
    domains: ['docusign.com', 'docusign.net'],
    mentions: ['docu ?sign'],
  },
  {
    name: 'LinkedIn',
    keywords: ['linkedin'],
    domains: ['linkedin.com', 'lnkd.in'],
    mentions: ['linkedin'],
  },
  // Payment apps: mentions are anchored to the start of a line ("Venmo: ...") so a friend
  // saying "I'll send it on Cash App" next to an unrelated link doesn't count as a claim.
  // Zelle is left out: banks send real Zelle texts from their own domains.
  {
    name: 'Venmo',
    keywords: ['venmo'],
    domains: ['venmo.com'],
    mentions: ['^venmo\\b'],
  },
  {
    name: 'Cash App',
    keywords: ['cashapp'],
    domains: ['cash.app', 'cashapp.com', 'cash.me', 'squareup.com'],
    mentions: ['^cash ?app\\b'],
  },
  {
    name: 'Coinbase',
    keywords: ['coinbase'],
    domains: ['coinbase.com'],
    mentions: ['^coinbase\\b','coinbase (?:support|security|account|wallet)'],
  },
  {
    name: 'E-ZPass',
    keywords: ['ezpass'],
    domains: ['e-zpassny.com', 'ezpassnj.com', 'ezpassva.com', 'ezpassmd.com', 'ezpassde.com', 'ezpassoh.com', 'e-zpassiag.com', 'paytollsny.com'],
    officialSuffixes: ['.gov'],
    mentions: ['e-?z ?pass'],
  },
  {
    name: 'SunPass',
    keywords: ['sunpass'],
    domains: ['sunpass.com'],
    officialSuffixes: ['.gov'],
    mentions: ['sun ?pass'],
  },
  {
    name: 'FasTrak',
    keywords: ['fastrak'],
    domains: ['bayareafastrak.org', 'thetollroads.com'],
    officialSuffixes: ['.gov'],
    mentions: ['fastrak'],
  },
  {
    name: 'TxTag',
    keywords: ['txtag'],
    domains: ['txtag.org'],
    officialSuffixes: ['.gov'],
    mentions: ['txtag'],
  },
  {
    name: 'DMV',
    keywords: ['dmv'],
    domains: [],
    officialSuffixes: ['.gov'],
    mentions: ['\\bdmv\\b', 'department of motor vehicles'],
  },
  {
    name: 'IRS',
    keywords: ['irs'],
    domains: [],
    officialSuffixes: ['.gov'],
    mentions: ['\\birs\\b', 'internal revenue service'],
  },
  // Retailers copied by fake online stores (usually promoted through social media ads).
  {
    name: 'Summer Fridays',
    keywords: ['summerfridays'],
    domains: ['summerfridays.com'],
    mentions: ['summer ?fridays'],
  },
  {
    name: 'Lululemon',
    keywords: ['lululemon'],
    domains: ['lululemon.com', 'lululemon.ca', 'lululemon.co.uk'],
    mentions: ['lululemon'],
  },
  {
    name: 'Walmart',
    keywords: ['walmart'],
    domains: ['walmart.com', 'walmart.ca', 'walmartimages.com'],
    mentions: ['walmart'],
  },
  {
    name: 'Costco',
    keywords: ['costco'],
    domains: ['costco.com', 'costco.ca', 'costco.co.uk'],
    mentions: ['costco'],
  },
  {
    name: 'Best Buy',
    keywords: ['bestbuy'],
    domains: ['bestbuy.com', 'bestbuy.ca'],
    mentions: ['best ?buy'],
  },
  {
    name: 'The Home Depot',
    keywords: ['homedepot'],
    domains: ['homedepot.com', 'homedepot.ca'],
    mentions: ['home ?depot'],
  },
  {
    name: 'Sephora',
    keywords: ['sephora'],
    domains: ['sephora.com', 'sephora.ca', 'sephora.co.uk'],
    mentions: ['sephora'],
  },
  {
    name: 'Ulta Beauty',
    keywords: ['ultabeauty', 'ulta'],
    domains: ['ulta.com'],
    mentions: ['ulta beauty'],
  },
  {
    name: 'Shein',
    keywords: ['shein'],
    domains: ['shein.com'],
    countryDomains: 'shein',
    mentions: ['\\bshein\\b'],
  },
  {
    name: 'Temu',
    keywords: ['temu'],
    domains: ['temu.com'],
    mentions: ['\\btemu\\b'],
  },
  {
    name: 'Nike',
    keywords: ['nike'],
    domains: ['nike.com'],
    mentions: ['\\bnike\\b'],
  },
  {
    name: 'Adidas',
    keywords: ['adidas'],
    domains: ['adidas.com', 'adidas.co.uk', 'adidas.ca'],
    mentions: ['adidas'],
  },
  {
    name: 'Stanley',
    keywords: ['stanley1913', 'stanleycup'],
    domains: ['stanley1913.com'],
    mentions: ['stanley (?:cup|quencher|tumbler)'],
  },
  {
    name: 'Skims',
    keywords: ['skims'],
    domains: ['skims.com'],
    mentions: ['\\bskims\\b'],
  },
  {
    name: 'Dyson',
    keywords: ['dyson'],
    domains: ['dyson.com', 'dyson.co.uk', 'dyson.ca'],
    mentions: ['\\bdyson\\b'],
  },
  {
    name: 'Crocs',
    keywords: ['crocs'],
    domains: ['crocs.com'],
    mentions: ['\\bcrocs\\b'],
  },
  {
    name: 'UGG',
    keywords: ['ugg'],
    domains: ['ugg.com'],
    mentions: ['\\bugg\\b'],
  },
  {
    name: 'Ray-Ban',
    keywords: ['rayban'],
    domains: ['ray-ban.com'],
    mentions: ['ray-?ban'],
  },
  {
    name: 'The North Face',
    keywords: ['thenorthface', 'northface'],
    domains: ['thenorthface.com'],
    mentions: ['north face'],
  },
  {
    name: 'Le Creuset',
    keywords: ['lecreuset'],
    domains: ['lecreuset.com'],
    mentions: ['le creuset'],
  },
  {
    name: 'LEGO',
    keywords: ['lego'],
    domains: ['lego.com'],
    mentions: ['\\blego\\b'],
  },
  ...(
    [
      ['Coach', ['coach'], ['coach.com', 'coachoutlet.com'], ['coach (?:outlet|bags?|purses?|handbags?)']],
      ['Kate Spade', ['katespade'], ['katespade.com', 'katespadeoutlet.com'], ['kate ?spade']],
      ['Michael Kors', ['michaelkors'], ['michaelkors.com'], ['michael ?kors']],
      ['Hoka', ['hoka'], ['hoka.com'], ['hoka (?:shoes|sneakers|running|clifton|bondi)']],
      ['Yeti', ['yeti'], ['yeti.com'], ['yeti (?:coolers?|tumblers?|ramblers?|mugs?)']],
      ['Pandora', ['pandora'], ['pandora.net', 'pandora.com'], ['pandora (?:jewel(?:le)?ry|charms?|bracelets?|rings?)']],
      ['Zara', ['zara'], ['zara.com'], ['zara (?:sale|clearance|outlet|order)']],
      ['Oura', ['oura', 'ouraring'], ['ouraring.com', 'oura.com'], ['oura ring']],
      ['Birkenstock', ['birkenstock'], ['birkenstock.com'], ['birkenstocks?']],
    ] as const
  ).map(([name, keywords, domains, mentions]): Brand => ({ name, keywords: [...keywords], domains: [...domains], mentions: [...mentions], storeOnly: true })),
  {
    name: 'Ticketmaster',
    keywords: ['ticketmaster'],
    domains: ['ticketmaster.com', 'livenation.com'],
    countryDomains: 'ticketmaster',
    mentions: ['ticketmaster'],
  },
  {
    name: 'University login',
    keywords: ['edu', 'instructure', 'duosecurity', 'okta'],
    domains: ['instructure.com', 'blackboard.com', 'duosecurity.com', 'duo.com', 'okta.com'],
    officialSuffixes: ['.edu'],
    mentions: [],
  },
]
