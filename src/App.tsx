import { useEffect, useState } from 'react'

type Health = { ok: boolean; service: string; time: string }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? (r.json() as Promise<Health>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <main>
      <h1>Phishing Triage</h1>
      <p>Paste a suspicious link, text or email and get an explainable verdict. Coming soon.</p>
      <p className="status" role="status">
        API: {health ? `ok (${health.time})` : error ? `unreachable: ${error}` : 'checking…'}
      </p>
    </main>
  )
}
