// QA harness: drives headless Chrome over the DevTools protocol (no dependencies),
// emulating real device widths. For each page it records console errors/CSP
// violations, horizontal overflow, and saves a full-page screenshot.
//
//   node scripts/qa-screens.mjs <baseUrl> <outDir> [chromePath]
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [base = 'http://localhost:4173', outDir = 'qa-out', chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'] =
  process.argv.slice(2)
mkdirSync(outDir, { recursive: true })

const ALL_PAGES = [
  ['home', '/'],
  ['text-toll', '/#text/smishing-toll'],
  ['text-package', '/#text/smishing-package'],
  ['text-sb', '/#text/safe-browsing-test'],
  ['email-m365', '/#email/m365-credential-phish'],
  ['email-recruiter', '/#email/fake-recruiter'],
  ['email-invoice', '/#email/invoice-attachments'],
  ['email-newsletter', '/#email/legit-newsletter'],
  // No sample lands on Suspicious, so this one is typed in (a lookalike on a reserved .test name).
  ['text-suspicious', '/#text', 'Sign in to keep your account: https://paypa1-login.test/'],
  // A real fake store (Oct 2026). Live, the browser domain-age fallback should lift it to High.
  ['text-fakeshop', '/#text', 'www.summrfrideays.shop'],
]
// Optional filters for quick iteration: ONLY=home,email-m365 DEVICES=phone CLIP=.verdict
const PAGES = process.env.ONLY ? ALL_PAGES.filter(([n]) => process.env.ONLY.split(',').includes(n)) : ALL_PAGES
const ALL_DEVICES = [
  ['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }],
  ['desktop', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }],
]
const DEVICES = process.env.DEVICES ? ALL_DEVICES.filter(([n]) => process.env.DEVICES.split(',').includes(n)) : ALL_DEVICES
const THEMES = (process.env.THEMES ?? 'dark').split(',')

const port = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu',
  `--user-data-dir=${join(outDir, '.profile')}`, 'about:blank',
], { stdio: 'ignore' })

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
const events = []
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method) events.push(msg)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')

const report = []
for (const theme of THEMES) {
  for (const [device, metrics] of DEVICES) {
    await send('Emulation.setDeviceMetricsOverride', metrics)
    await send('Emulation.setTouchEmulationEnabled', { enabled: metrics.mobile })
    for (const [name, path, typed] of PAGES) {
      events.length = 0
      await send('Page.navigate', { url: 'about:blank' })
      await sleep(100)
      await send('Page.navigate', { url: base + path })
      await sleep(1200)
      await send('Runtime.evaluate', { expression: `localStorage.setItem('theme','${theme}'); location.reload()` })
      await sleep(2500)
      if (typed) {
        await send('Runtime.evaluate', {
          expression: `(() => { const ta = document.querySelector('#text-input'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, ${JSON.stringify(typed)}); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.form.requestSubmit() })()`,
        })
        await sleep(4000) // room for the live lookups
      }
      const { result } = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `({ sw: document.documentElement.scrollWidth, cw: ${metrics.width},
          verdict: document.querySelector('.verdict-label')?.textContent ?? null,
          wide: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > ${metrics.width} + 1 && !e.parentElement?.closest('.table-wrap') && getComputedStyle(e).position !== 'absolute' }).slice(0, 5).map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)) })`,
      })
      const problems = events
        .filter(
          (e) =>
            (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)) ||
            (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)) ||
            e.method === 'Runtime.exceptionThrown',
        )
        .map((e) => e.params.entry?.text ?? e.params.exceptionDetails?.text ?? e.params.args?.map((a) => a.value).join(' '))
      // CLIP=.verdict captures just that element (with a margin) instead of the whole page.
      let clip
      if (process.env.CLIP) {
        const { result: box } = await send('Runtime.evaluate', {
          returnByValue: true,
          expression: `(() => { const r = document.querySelector(${JSON.stringify(process.env.CLIP)})?.getBoundingClientRect(); return r && { x: Math.max(0, r.left - 24), y: Math.max(0, r.top + scrollY - 70), width: r.width + 48, height: r.height + 94, scale: 1 } })()`,
        })
        clip = box.value ?? undefined
      }
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, ...(clip ? { clip } : {}) })
      const file = `${theme}-${device}-${name}.png`
      writeFileSync(join(outDir, file), Buffer.from(shot.data, 'base64'))
      report.push({ file, verdict: result.value.verdict, overflow: result.value.sw > result.value.cw, sw: result.value.sw, wide: result.value.wide, problems })
    }
  }
}
ws.close()
chrome.kill()
for (const r of report) {
  const flags = [r.overflow ? `OVERFLOW sw=${r.sw} ${JSON.stringify(r.wide)}` : '', ...r.problems.map((p) => `CONSOLE: ${p}`)].filter(Boolean)
  console.log(`${flags.length ? 'FAIL' : 'ok  '} ${r.file.padEnd(36)} ${r.verdict ?? '(no verdict)'}${flags.length ? '\n     ' + flags.join('\n     ') : ''}`)
}
process.exitCode = report.some((r) => r.overflow || r.problems.length) ? 1 : 0
