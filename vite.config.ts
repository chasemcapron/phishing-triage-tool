import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serve the production security headers (CSP etc.) from `vite preview` too, so
// violations show up locally before deploy.
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const securityHeaders = Object.fromEntries(vercel.headers.flatMap((h) => h.headers.map((x) => [x.key, x.value])))
delete securityHeaders['Strict-Transport-Security']

export default defineConfig({
  plugins: [react()],
  preview: {
    headers: {
      ...securityHeaders,
      // upgrade-insecure-requests would break plain-http localhost previews.
      'Content-Security-Policy': String(securityHeaders['Content-Security-Policy']).replace('; upgrade-insecure-requests', ''),
    },
  },
})
