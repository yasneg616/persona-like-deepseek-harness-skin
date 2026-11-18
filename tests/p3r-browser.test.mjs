// Real-browser checks for P3R (headless Chrome/Edge over CDP, like browser.test.mjs).
// Run with: npm run build && node --test tests/p3r-browser.test.mjs
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const executable = process.env.BROWSER_EXE || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync)
let server, browser, socket, sessionId, base
let nextId = 0
const pending = new Map()

const outputMatch = (child, stream, pattern) => new Promise((resolve, reject) => {
  let output = ''
  const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output.slice(-500)}`)), 20000)
  child.once('exit', code => { clearTimeout(timer); reject(new Error(`exited ${code}`)) })
  stream.on('data', chunk => { output += chunk; const m = output.match(pattern); if (m) { clearTimeout(timer); resolve(m[1]) } })
})
const send = (method, params = {}, target = sessionId) => {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 15000)
    pending.set(id, { resolve: r => { clearTimeout(timer); resolve(r) }, reject })
    socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }))
  })
}
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}
const waitFor = expression => evaluate(`new Promise((resolve, reject) => { const t0 = performance.now();
  const check = () => { if (${expression}) resolve(true); else if (performance.now() - t0 > 8000) reject('timed out: ' + ${JSON.stringify(expression)}); else setTimeout(check, 50) }; check() })`)
const open = async path => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}${path}` })
  await waitFor(`document.readyState === 'complete' && !!document.querySelector('[data-shell-overlay]')`)
}

before(async () => {
  assert.ok(executable, 'Set BROWSER_EXE to a Chromium browser executable')
  const profile = await mkdtemp(join(tmpdir(), 'dsh-p3r-ui-'))
  server = spawn(process.execPath, ['scripts/preview-server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
  base = await outputMatch(server, server.stdout, /preview (http:\/\/127\.0\.0\.1:\d+)/)
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  socket = new WebSocket(await outputMatch(browser, browser.stderr, /DevTools listening on (ws:\/\/[^\s]+)/))
  await once(socket, 'open')
  socket.addEventListener('message', event => {
    const m = JSON.parse(event.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) }
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null)
  ;({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null))
  await send('Page.enable'); await send('Runtime.enable')
})
after(async () => {
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close', {}, null).catch(() => {}); socket.close() }
  server?.kill()
})

// The preview fixture renders slots once (no re-render on a skin switch), so the switch itself cannot be
// replayed here. What a late P5 cleanup does to us can: it removes html[data-cc-caption] after P3R took over.
test('P3R keeps the native caption hidden when another overlay drops the caption flag', async () => {
  await open('/persona.html?persona=p3')
  await waitFor(`!!document.querySelector('.p3r-tbar[data-on]') && document.documentElement.hasAttribute('data-cc-caption')`)
  await evaluate(`(document.documentElement.removeAttribute('data-cc-caption'), true)`)
  await evaluate('new Promise(r => setTimeout(r, 200))')
  const state = await evaluate(`(() => { const h = document.documentElement, host = document.querySelector('[data-windows-menu], [data-industrial-caption-fallback]');
    return { persona: h.dataset.dshPersona, caption: h.hasAttribute('data-cc-caption'), nativeShown: !!host && getComputedStyle(host).display !== 'none', ours: !!document.querySelector('.p3r-tbar[data-on] .dsh-cc-win') } })()`)
  assert.deepEqual(state, { persona: 'p3r', caption: true, nativeShown: false, ours: true })
})

test('stations stay true circles under the desktop shell superellipse corners, and the seam has the four page buttons', async () => {
  await open('/native-rc3.html?persona=p3')
  await waitFor(`!!document.querySelector('.p3r-tbar') && !!document.querySelector('.p3r-menu button:not([hidden])')`)
  const r = await evaluate(`(() => { const s = document.createElement('style');
    s.textContent = '@supports (corner-shape:superellipse(1.5)){:root{--dsw-corner-shape:superellipse(1.5)}*,:before,:after{corner-shape:var(--dsw-corner-shape)}}'; document.head.prepend(s);
    const node = document.querySelector('[data-row-key^="workspace:"]'), cs = node && getComputedStyle(node, '::before');
    return { supported: CSS.supports('corner-shape', 'round'), node: cs ? [cs.width, cs.height, cs.borderRadius, cs.getPropertyValue('corner-shape')] : null,
      menu: [...document.querySelectorAll('.p3r-menu button:not([hidden])')].map(b => b.dataset.key) } })()`)
  assert.deepEqual(r.menu, ['new', 'plugins', 'automation', 'more'])
  if (r.supported && r.node) assert.deepEqual(r.node, ['50px', '50px', '50%', 'superellipse(1)'])
})
