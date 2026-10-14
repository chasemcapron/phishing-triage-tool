// Interaction checks over the DevTools protocol (no dependencies): clicks, typing,
// keyboard, theme, deep links and the fishing-line layout.
//
//   node scripts/qa-flows.mjs <baseUrl> [chromePath]
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [base = 'http://localhost:4173', chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'] = process.argv.slice(2)
const port = 9900 + Math.floor(Math.random() * 90)
// Fresh profile every run, so the default-theme check never sees a stale saved choice.
const profile = mkdtempSync(join(tmpdir(), 'qa-flows-'))
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], {
  stdio: 'ignore',
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let up = false
for (let i = 0; i < 50 && !up; i++) {
  try {
    await fetch(`http://127.0.0.1:${port}/json/version`)
    up = true
  } catch {
    await sleep(200)
  }
}
if (!up) throw new Error('Chrome did not start')
const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pend = new Map()
const errors = []
ws.addEventListener('message', (m) => {
  const x = JSON.parse(m.data)
  if (x.id) {
    pend.get(x.id)?.(x)
    pend.delete(x.id)
  } else if (
    x.method === 'Runtime.exceptionThrown' ||
    (x.method === 'Log.entryAdded' && x.params.entry.level === 'error') ||
    (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error')
  )
    errors.push(JSON.stringify(x.params).slice(0, 200))
})
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id
    pend.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const ev = async (expr) =>
  (await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value
await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')

const results = []
const check = (name, cond) => results.push(`${cond ? 'ok  ' : 'FAIL'} ${name}`)
const verdict = () => ev(`return document.querySelector('[role=tabpanel]:not([hidden]) .verdict-label')?.textContent ?? null`)
const click = (sel, text) =>
  ev(
    `const els=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>!e.closest('[hidden]')); const el=${text ? `els.find(e=>e.textContent.trim()===${JSON.stringify(text)})` : 'els[0]'}; if(!el) return 'missing'; el.click(); return 'clicked'`,
  )
const setValue = (sel, value) =>
  ev(
    `const ta=document.querySelector(${JSON.stringify(sel)}); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(ta, ${JSON.stringify(value)}); ta.dispatchEvent(new Event('input',{bubbles:true})); return 1`,
  )
const key = async (k, code, vk) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk })
}
const label = () => ev(`return document.querySelector('.site-header .btn-icon').getAttribute('aria-label')`)
// Distance between where the line ends and the top of the card it should hang from (page px).
const lineGap = (sel) =>
  ev(`const l=document.querySelector('.fishing-line'), c=document.querySelector(${JSON.stringify(sel)}); if(!l||!c) return null;
      const p=document.querySelector('.pond-page').getBoundingClientRect();
      const top=parseFloat(l.style.getPropertyValue('--line-y')), len=parseFloat(l.style.getPropertyValue('--line-len'));
      return Math.round(Math.abs(top + len - (c.getBoundingClientRect().top - p.top)))`)

// --- Phone layout: the paste box is visible without scrolling ---
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Page.navigate', { url: base + '/' })
await sleep(1800)
check('default theme is light (day)', (await ev(`return document.documentElement.dataset.theme`)) === 'light')
check('theme toggle offers night fishing', (await label()) === 'Switch to night fishing (dark theme)')
check('phone: input card starts within 650px', (await ev(`return document.querySelector('.tabs').getBoundingClientRect().top`)) < 650)
check('phone: textarea visible without scrolling', (await ev(`return document.querySelector('#text-input').getBoundingClientRect().top`)) < 760)
check('fishing line hangs the input card', ((await lineGap('.tabs')) ?? 99) <= 2)
check(
  'line starts at the rod tip',
  (await ev(
    `const p=document.querySelector('.pond-page').getBoundingClientRect(), f=document.querySelector('.fisher-wrap').getBoundingClientRect(); const l=document.querySelector('.fishing-line'); return Math.abs(parseFloat(l.style.getPropertyValue('--line-x')) - (f.right - p.left)) < 1.5`,
  )) === true,
)
await send('Emulation.clearDeviceMetricsOverride')
await send('Page.reload')
await sleep(1500)

// --- Text mode ---
await click('button[type=submit]')
await sleep(300)
check('empty submit shows error', ((await ev(`return document.querySelector('#text-empty')?.textContent ?? ''`)) || '').includes('Paste'))
await click('.chip', 'Unpaid toll text')
await sleep(800)
check('text sample chip → High', (await verdict()) === 'High risk — likely phishing')
check('high result offers official report links', (await ev(`return [...document.querySelectorAll('.todo-report a')].map(a => a.href).join(' ')`)).includes('reportfraud.ftc.gov'))
check('summary to send someone is offered', (await ev(`return [...document.querySelectorAll('.todo-share button')].some(b => b.textContent.includes('Copy a summary'))`)) === true)
await click('.chip', 'Normal text')
await sleep(1200)
check('normal text chip → No red flags', (await verdict()) === 'No red flags found')
check('five sample buttons', (await ev(`return document.querySelectorAll('#panel-text .chip').length`)) === 5)
check('focus moved to verdict', (await ev(`return document.activeElement?.id`)) === 'verdict-heading')
check('verdict fish is decorative', (await ev(`return document.querySelector('.verdict .fish')?.getAttribute('aria-hidden')`)) === 'true')
await sleep(1000)
check('fishing line moves down to the verdict card', ((await lineGap('[role=tabpanel]:not([hidden]) .verdict')) ?? 99) <= 2)
await click('.segmented button', 'Analyst')
await sleep(300)
check(
  'analyst toggle shows findings + links table',
  (await ev(`return !!document.querySelector('#findings-heading') && !!document.querySelector('#links-table-heading')`)) === true,
)
// Email-looking text in text mode → notice (handoff to the email tab when it is enabled)
const emailTab = await ev(`return !!document.querySelector('#tab-email')`)
await setValue('#text-input', 'Received: from a.example by b.example; Tue, 13 Oct 2026 10:00:00 +0000\nFrom: "PayPal" <x@gmail.com>\nSubject: hi\n\nbody')
await sleep(300)
check('email-looking text shows a notice', (await ev(`return !!document.querySelector('.notice')`)) === true)
if (!emailTab) {
  check('email mode paused: single tab, no email panel', (await ev(`return document.querySelectorAll('[role=tab]').length === 1 && !document.querySelector('#panel-email')`)) === true)
  await ev(`location.hash = '#email/fake-recruiter'; return 1`)
  await sleep(800)
  check('#email deep link falls back to text mode', (await ev(`return document.querySelector('#tab-text').getAttribute('aria-selected')`)) === 'true')
} else {
check('email-looking text shows handoff notice', (await ev(`return !!document.querySelector('.notice .link-btn')`)) === true)
await click('.notice .link-btn')
await sleep(300)
check('handoff switches to email tab', (await ev(`return document.querySelector('#tab-email').getAttribute('aria-selected')`)) === 'true')
check('handoff carries the text', (await ev(`return document.querySelector('#email-input').value.startsWith('Received:')`)) === true)
await click('button[type=submit]')
await sleep(1200)
check('handed-off email analyzes (PayPal from gmail → flagged)', ['High risk — likely phishing', 'Suspicious — be careful'].includes(await verdict()))
await click('.chip', 'Normal newsletter')
await sleep(1200)
check('email sample chip → No red flags', (await verdict()) === 'No red flags found')
// Non-email input in email mode
await setValue('#email-input', 'hello there')
await click('button[type=submit]')
await sleep(800)
check('non-email input shows friendly error', ((await ev(`return document.querySelector('#email-error')?.textContent ?? ''`)) || '').includes('No email headers'))
await sleep(1000)
check('line returns to the input card when there is no result', ((await lineGap('.tabs')) ?? 99) <= 2)
// Keyboard tabs
await ev(`document.querySelector('#tab-email').focus(); return 1`)
await key('ArrowLeft', 'ArrowLeft', 37)
await sleep(300)
check('ArrowLeft moves to text tab', (await ev(`return document.activeElement?.id + ' ' + location.hash`)) === 'tab-text #text')
await key('End', 'End', 35)
await sleep(200)
check('End moves to email tab', (await ev(`return document.activeElement?.id`)) === 'tab-email')
await key('Home', 'Home', 36)
await sleep(200)
check('Home moves to text tab', (await ev(`return document.activeElement?.id`)) === 'tab-text')
}
// Theme toggle: light → dark, persists across reload, then back
await click('.site-header .btn-icon')
await sleep(200)
check('theme toggles to dark (night fishing)', (await ev(`return document.documentElement.dataset.theme`)) === 'dark')
check('toggle now offers day fishing', (await label()) === 'Switch to day fishing (light theme)')
await send('Page.reload')
await sleep(1500)
check('dark theme persists across reload', (await ev(`return document.documentElement.dataset.theme + ' ' + localStorage.getItem('theme')`)) === 'dark dark')
await click('.site-header .btn-icon')
await sleep(200)
check('theme toggles back to light', (await ev(`return document.documentElement.dataset.theme + ' ' + localStorage.getItem('theme')`)) === 'light light')
// Deep links
if (emailTab) {
  await ev(`location.hash = '#email/fake-recruiter'; return 1`)
  await sleep(1500)
  check('hashchange deep link loads email sample', (await verdict()) === 'High risk — likely phishing')
}
await send('Page.navigate', { url: base + '/#text/smishing-toll' })
await sleep(1800)
check('#text/<id> deep link loads text sample', (await verdict()) === 'High risk — likely phishing')
check('skip link targets main', (await ev(`return document.querySelector('.skip-link').getAttribute('href') === '#main' && !!document.querySelector('main#main')`)) === true)
check('no console errors', errors.length === 0)

console.log(results.join('\n'))
if (errors.length) console.log(errors.join('\n'))
ws.close()
chrome.kill()
await sleep(500)
try {
  rmSync(profile, { recursive: true, force: true })
} catch {
  /* Chrome may still hold files; the OS temp cleaner will get it */
}
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0
