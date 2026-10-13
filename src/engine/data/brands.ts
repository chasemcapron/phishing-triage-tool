// Commonly impersonated brands.
//
// keywords: compared against domain labels (after confusable normalization).
//   Keywords of 6+ characters also match as a substring of a label
//   ("paypalsecure"); shorter ones, and any listed in tokenOnly, only match a whole
//   hyphen-separated token so that "pineapple" or "purchase" never hit Apple or Chase.
// domains: registrable domains the brand really uses.
// officialSuffixes: any registrable domain ending in one of these counts as official
//   (e.g. every .gov domain for government services).
// mentions: regex fragments that mean a message or display name claims to be the brand.

export interface Brand {
  name: string
  keywords: string[]
  tokenOnly?: string[]
  domains: string[]
  officialSuffixes?: string[]
  mentions: string[]
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
    mentions: ['google', 'gmail'],
  },
  {
    name: 'Apple',
    keywords: ['apple', 'icloud', 'appleid', 'itunes'],
    domains: ['apple.com', 'icloud.com', 'me.com', 'mac.com', 'apple.co', 'itunes.com'],
    mentions: ['apple', 'icloud', 'apple ?id', 'itunes'],
  },
  {
    name: 'Amazon',
    keywords: ['amazon', 'primevideo', 'aws'],
    domains: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.jobs', 'a.co', 'amzn.to', 'primevideo.com'],
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
  {
    name: 'University login',
    keywords: ['edu', 'instructure', 'duosecurity', 'okta'],
    domains: ['instructure.com', 'blackboard.com', 'duosecurity.com', 'duo.com', 'okta.com'],
    officialSuffixes: ['.edu'],
    mentions: [],
  },
]
