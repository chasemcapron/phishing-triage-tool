// Captures the README screenshots (docs/screenshots/*.png) and the demo GIF's frames from the
// live site in headless Chrome over the DevTools protocol (no dependencies), then stitches the
// GIF with scripts/frames_to_gif.py (Pillow). Re-run after a visual change.
//
//   node scripts/make-readme-media.mjs [baseUrl] [chromePath]
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [base = 'https://gonefishing-app.vercel.app', chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'] = process.argv.slice(2)
const shots = 'docs/screenshots'
const frames = mkdtempSync(join(tmpdir(), 'gp-frames-'))
mkdirSync(shots, { recursive: true })

const port = 9700 + Math.floor(Math.random() * 100)
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'gp-media-'))}`,
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
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value
const phone = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
const desktop = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }

async function open(path, theme, metrics) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await send('Emulation.setTouchEmulationEnabled', { enabled: metrics.mobile })
  await send('Page.navigate', { url: 'about:blank' })
  // ?season=none keeps the original pond, whatever the month.
  const [pagePath, hash] = path.split('#')
  await send('Page.navigate', { url: `${base}${pagePath}?season=none${hash ? `#${hash}` : ''}` })
  await sleep(1200)
  // The theme is read at startup, and a hash-only navigation doesn't restart the app: reload.
  await ev(`localStorage.setItem('theme', '${theme}'); localStorage.setItem('onlineChecks', 'on'); 1`)
  await send('Page.reload')
  await sleep(2500)
}
/** Element (plus a margin) in page coordinates, so it can be captured even when taller than the viewport. */
const box = (sel, pad = 16) =>
  ev(
    `(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.max(0, r.left - ${pad}), y: Math.max(0, r.top + scrollY - ${pad}), width: r.width + ${pad * 2}, height: r.height + ${pad * 2}, scale: 1 } })()`,
  )
async function shoot(name, clip) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: Boolean(clip), ...(clip ? { clip } : {}) })
  writeFileSync(join(shots, `${name}.png`), Buffer.from(shot.data, 'base64'))
  console.log('wrote', name)
}

await send('Page.enable')

// 1. Landing page on a phone, day.
await open('/', 'light', phone)
await shoot('home-phone')

// 2. The catch: fake store ad, verdict and reasons.
await open('/#text/fake-store', 'light', phone)
await sleep(2500)
await shoot('verdict-phone', await box('.verdict'))

// 3. A real Google Safe Browsing hit at night, with Google's required advisory.
await open('/#text/safe-browsing-test', 'dark', phone)
await sleep(4500)
await shoot('safe-browsing-night', await box('.verdict'))

// 4. What to do: matched advice, report links, summary to send someone.
await open('/#text/fake-store', 'light', phone)
await sleep(2500)
await shoot('what-to-do-phone', await box('.todo'))

// 5. Analyst view on desktop: findings with ATT&CK tags, links table, export.
await open('/#text/smishing-toll', 'light', desktop)
await sleep(2500)
await ev(`[...document.querySelectorAll('.results-bar button')].find((b) => b.textContent === 'Analyst').click(); 1`)
await sleep(800)
await ev(`window.scrollTo(0, document.querySelector('#findings-heading').getBoundingClientRect().top + scrollY - 24); 1`)
await sleep(600)
await shoot('analyst-desktop')

// Demo GIF: type the real fake-store link and cast it. The link is checked once off camera first,
// so the page's lookup cache answers instantly and the recording shows one verdict, not the offline
// verdict being lifted a moment later.
await open('/', 'light', { ...phone, deviceScaleFactor: 1 })
const link = 'www.summrfrideays.shop'
const typeLink = (text) =>
  ev(
    `(() => { const ta = document.querySelector('#text-input'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, ${JSON.stringify(text)}); ta.dispatchEvent(new Event('input', { bubbles: true })); return 1 })()`,
  )
await typeLink(link)
await ev(`document.querySelector('#text-input').form.requestSubmit(); 1`)
for (let i = 0; i < 100 && !(await ev(`!!document.querySelector('.verdict') && !document.querySelector('.verdict-checking')`)); i++) await sleep(200)
await sleep(500)
const warmed = await ev(`document.querySelector('.verdict').className`)
console.log('warm-up verdict:', warmed)
// An empty submit clears the result; hide the "paste something first" hint it shows (the CSSOM is CSP-safe).
await typeLink('')
await ev(`document.querySelector('#text-input').form.requestSubmit(); 1`)
await sleep(300)
await ev(`document.querySelector('#text-empty').style.display = 'none'; document.activeElement.blur(); window.scrollTo(0, 0); 1`)
await sleep(1500)
let n = 0
const labels = new Set()
const frame = async (hold = 1) => {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(frames, `${String(n++).padStart(4, '0')}-${hold}.png`), Buffer.from(shot.data, 'base64'))
  const label = await ev(`document.querySelector('.verdict')?.className.replace('verdict ', '') ?? ''`)
  if (label) labels.add(label)
}
await frame(12)
const cardTop = await ev(`document.querySelector('.tabs').getBoundingClientRect().top + scrollY - 40`)
for (let i = 1; i <= 8; i++) {
  await ev(`window.scrollTo(0, ${(cardTop * i) / 8}); 1`)
  await sleep(60)
  await frame()
}
for (let i = 2; i <= link.length; i += 2) {
  await typeLink(link.slice(0, i))
  await frame()
}
await frame(8)
await ev(`document.querySelector('#text-input').form.requestSubmit(); 1`)
for (let i = 0; i < 40; i++) {
  await sleep(110)
  await frame()
}
await frame(10)
const todoTop = await ev(`document.querySelector('.todo').getBoundingClientRect().top + scrollY - 20`)
const from = await ev('scrollY')
for (let i = 1; i <= 10; i++) {
  await ev(`window.scrollTo(0, ${from + ((todoTop - from) * i) / 10}); 1`)
  await sleep(60)
  await frame()
}
await frame(25)
console.log('verdicts shown in the GIF:', [...labels].join(' -> '))

ws.close()
chrome.kill()
execFileSync('python', ['-I', 'scripts/frames_to_gif.py', frames, 'docs/demo.gif'], { stdio: 'inherit' })
rmSync(frames, { recursive: true, force: true })
