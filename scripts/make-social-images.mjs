// Renders the link-preview image (public/og.png, 1200×630) from the live hero, and the
// home-screen icon (public/apple-touch-icon.png, 180×180) from the favicon, in headless Chrome
// over the DevTools protocol (no dependencies). Re-run after a visual change to the hero.
//
//   node scripts/make-social-images.mjs [baseUrl] [chromePath]
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [base = 'https://gonefishing-app.vercel.app', chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'] = process.argv.slice(2)
const port = 9800 + Math.floor(Math.random() * 100)
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gp-social-'))}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let version
for (let i = 0; i < 50 && !version; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
  } catch {
    await sleep(200)
  }
}
if (!version) throw new Error('Chrome did not start')
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result)
    pending.delete(msg.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
const shoot = async (file, width, height) => {
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } })
  writeFileSync(file, Buffer.from(shot.data, 'base64'))
  console.log('wrote', file)
}
await send('Page.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })

// Preview card: the day pond's hero (title, fisher, line), motion paused.
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/` })
await sleep(1500)
await send('Runtime.evaluate', { expression: "localStorage.setItem('theme','light'); location.reload()" })
await sleep(2500)
// Just the scene: no theme button, and no sliver of the input card at the bottom edge.
await send('Runtime.evaluate', {
  expression: "for (const s of ['.theme-toggle', '.pond-content']) document.querySelectorAll(s).forEach((e) => e.style.setProperty('visibility', 'hidden'))",
})
await sleep(300)
await shoot('public/og.png', 1200, 630)

// Home-screen icon: the favicon full-bleed (iOS rounds the corners itself).
const svg = readFileSync('public/favicon.svg', 'utf8').replace(' rx="8"', '')
const html = `<body style="margin:0"><img style="display:block;width:180px;height:180px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`
await send('Emulation.setDeviceMetricsOverride', { width: 180, height: 180, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `data:text/html;base64,${Buffer.from(html).toString('base64')}` })
await sleep(800)
await shoot('public/apple-touch-icon.png', 180, 180)

ws.close()
chrome.kill()
