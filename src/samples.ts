import manifest from '../samples/manifest.json'

// Bundled at build time as plain strings. Samples are synthetic (see samples/manifest.json).
const RAW = import.meta.glob<string>('../samples/*.{eml,txt}', { query: '?raw', import: 'default', eager: true })

const SHORT_LABELS: Record<string, string> = {
  'm365-credential-phish': 'Microsoft 365 phish',
  'fake-recruiter': 'Fake job offer',
  'invoice-attachments': 'Invoice + attachments',
  'legit-newsletter': 'Normal newsletter',
  'smishing-toll': 'Unpaid toll text',
  'smishing-package': 'Package delivery text',
  'safe-browsing-test': 'Safe Browsing test links',
}

export interface Sample {
  id: string
  mode: 'email' | 'text'
  title: string
  label: string
  content: string
}

export const SAMPLES: Sample[] = manifest.samples.map((s) => ({
  id: s.id,
  mode: s.mode as Sample['mode'],
  title: s.title,
  label: SHORT_LABELS[s.id] ?? s.title,
  content: RAW[`../samples/${s.file}`] ?? '',
}))
