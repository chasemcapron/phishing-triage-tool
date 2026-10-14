// Liveness check. Confirms the Vercel Functions runtime is wired up.
export function GET(): Response {
  return Response.json({ ok: true, service: 'phishing-triage-tool', time: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
}
