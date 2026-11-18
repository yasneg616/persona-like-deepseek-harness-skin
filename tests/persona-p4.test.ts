import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { createP4Immersion, createP4RouteSplash, createP4Scene } from '../src/client/persona-p4.ts'

const css = readFileSync(new URL('../src/client/persona.css', import.meta.url), 'utf8')

test('P4 assets: glasses, broadcast margin, Inaba townscape, portal rings and panels are original self-contained SVG', () => {
  const glasses = readFileSync(new URL('../assets/p4-glasses.svg', import.meta.url), 'utf8')
  assert.match(glasses, /Original flat vector study/)
  assert.equal(/linearGradient|radialGradient|filter=|feDropShadow|feGaussianBlur|<image|href=|<script|PERSONA|ATLUS/.test(glasses), false)
  for (const ink of ['#12110d', '#ffe600', '#ff9c00', '#79e8ff', '#ffffff', '#f54329', '#58c322', '#1da5f8']) {
    assert.ok(glasses.includes(ink), ink)
  }

  for (const name of ['wide', 'index', 'selected']) {
    const svg = readFileSync(new URL(`../assets/p4-panel-${name}.svg`, import.meta.url), 'utf8')
    assert.match(svg, /Original/)
    assert.match(svg, /preserveAspectRatio="none"/)
    assert.equal(/<rect|<image|<script|filter=|transform=|linearGradient/.test(svg), false)
    assert.ok((svg.match(/<path /g) || []).length >= 3)
  }
  const wide = readFileSync(new URL('../assets/p4-panel-wide.svg', import.meta.url), 'utf8')
  assert.match(wide, /M6 26 952 8 964 354 20 370 19 352 34 348 18 334Z/)
  const top = [946, -18], bottom = [944, -16]
  assert.notEqual(top[0] * bottom[1] - top[1] * bottom[0], 0, 'opposite panel edges are non-parallel')

  for (const name of ['margin', 'tv-dial', 'inaba-skyline', 'tv-frame', 'tv-rings', 'broadcast-disc', 'glasses-drop', 'impact-burst', 'route-wake']) {
    const art = readFileSync(new URL(`../assets/p4-${name}.svg`, import.meta.url), 'utf8')
    assert.match(art, /Original/)
    assert.equal(/<image|href=|<script|feGaussianBlur|feTurbulence|PERSONA|ATLUS/.test(art), false)
  }
  assert.match(css, /--p4-panel-wide:url\('\.\.\/\.\.\/assets\/p4-panel-wide\.svg'\)/)
  assert.match(css, /content:"CHANNEL GUIDE"/)
  assert.match(css, /content:"CHANNEL"/)
})

test('P4 whole-app immersion is a viewport body sibling, settles on input or reduced motion, and leaves P3/P5 untouched', async () => {
  const make = (mode = 'p4', reduced = false) => {
    const dom = new JSDOM(`<html data-dsh-persona="${mode}"><body><div id="frame"><div data-shell-overlay></div><div data-conversation-content></div></div></body></html>`, { pretendToBeVisual: true })
    const w = dom.window
    let match = reduced
    let listener: (() => void) | undefined
    w.matchMedia = (() => ({
      get matches() { return match },
      addEventListener(_type: string, fn: () => void) { listener = fn },
      removeEventListener() { listener = undefined },
    })) as unknown as typeof w.matchMedia
    return { dom, w, d: w.document, motion() { match = true; listener?.() } }
  }
  const tick = () => new Promise(r => setTimeout(r, 0))

  const { dom, w, d } = make()
  const stop = createP4Immersion(d, w as unknown as Window)
  assert.equal(d.documentElement.getAttribute('data-p4-immersion'), 'enter')
  const broadcast = d.querySelector('.dsh-persona-p4-immersion')!
  assert.equal(broadcast.parentElement, d.body)
  assert.equal(d.querySelector('#frame')!.contains(broadcast), false)

  d.querySelector('[data-conversation-content]')!.setAttribute('data-conversation-session', 'synthetic-next')
  await tick()
  assert.equal(d.querySelector('.dsh-persona-p4-immersion'), broadcast)

  d.dispatchEvent(new w.Event('beforeinput', { bubbles: true }))
  assert.equal(d.documentElement.getAttribute('data-p4-immersion'), 'settled')
  assert.equal(d.querySelector('.dsh-persona-p4-immersion'), null)
  stop()
  assert.equal(d.documentElement.hasAttribute('data-p4-immersion'), false)
  dom.window.close()

  const r = make('p4', true)
  const stopR = createP4Immersion(r.d, r.w as unknown as Window)
  assert.equal(r.d.documentElement.getAttribute('data-p4-immersion'), 'settled')
  assert.equal(r.d.querySelector('.dsh-persona-p4-immersion'), null)
  stopR()
  r.dom.window.close()

  for (const other of ['p3', 'p5']) {
    const o = make(other)
    const stopO = createP4Immersion(o.d, o.w as unknown as Window)
    assert.equal(o.d.querySelector('.dsh-persona-p4-immersion'), null)
    assert.equal(o.d.documentElement.hasAttribute('data-p4-immersion'), false)
    stopO()
    o.dom.window.close()
  }
})

test('P4 broadcast scene decorates secondary pages, quiets while editing, pauses hidden, and manages rc3 native layout', () => {
  const dom = new JSDOM('<html data-dsh-persona="p4"><body><div id="frame"><aside><button data-sidebar-toggle></button><button data-cc-leaf data-cc-i="1" aria-current="page" aria-label="Plugins">Plugins</button></aside><main><h1>Plugins / 插件</h1><article data-plugin-package="test"><input aria-label="search"></article></main><div data-shell-overlay></div></div></body></html>', { pretendToBeVisual: true })
  const d = dom.window.document, f = d.querySelector('#frame') as HTMLElement
  const scene = createP4Scene(d, dom.window as unknown as Window, f)
  scene.sync(); scene.sync()
  assert.equal(d.querySelectorAll('.dsh-p4-broadcast-page').length, 1)
  assert.equal(d.querySelector('.dsh-p4-broadcast-page')!.getAttribute('aria-hidden'), 'true')
  assert.equal(d.querySelector('.dsh-p4-broadcast-page')!.textContent, 'CHANNEL / PLUGINS / 插件')

  d.querySelector('input')!.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(f.hasAttribute('data-p4-quiet'), true)

  Object.defineProperty(d, 'hidden', { value: true, configurable: true })
  d.dispatchEvent(new dom.window.Event('visibilitychange'))
  assert.equal(d.documentElement.hasAttribute('data-p4-suspended'), true)

  for (const mode of ['p3', 'p5']) {
    d.documentElement.dataset.dshPersona = mode
    scene.sync()
    assert.equal(d.querySelector('.dsh-p4-broadcast-page'), null)
    assert.equal(f.hasAttribute('data-p4-route-motion'), false)
  }
  scene.dispose()
  dom.window.close()

  const rc3Html = readFileSync(new URL('../preview/native-rc3.html', import.meta.url), 'utf8').replace(/<style[\s\S]*?<\/style>/g, '')
  const rc3Dom = new JSDOM(rc3Html, { pretendToBeVisual: true })
  const rd = rc3Dom.window.document
  rd.documentElement.setAttribute('data-dsh-persona', 'p4')
  const rf = rd.querySelector('#frame') as HTMLElement
  const rc3Scene = createP4Scene(rd, rc3Dom.window as unknown as Window, rf)
  rc3Scene.sync()
  assert.equal(rf.getAttribute('data-p4-native-layout'), 'rc3')
  const nav = Array.from(rd.querySelectorAll('[data-cc-leaf]'))
  assert.equal(nav.length, 4)
  assert.deepEqual(nav.map(n => n.getAttribute('data-cc-label')), ['新会话', 'Plugins', 'Automation tasks', '更多'])
  rc3Scene.dispose()
  assert.equal(rf.getAttribute('data-p4-native-layout'), null)
  rc3Dom.window.close()
})

test('P4 route splash fires once on confirmed page/session switches, coalesces rapid switches, and cancels on typing', () => {
  const dom = new JSDOM('<html data-dsh-persona="p4"><body><div id="frame"><button data-cc-leaf data-cc-i="1">Plugins</button><button data-cc-leaf data-cc-i="2">Automation</button><div data-row-key="workspace:one" aria-expanded="true"></div><div data-row-key="session:two"></div><main><div data-conversation-content data-conversation-session="one"><p>synthetic content</p><input></div></main></div></body></html>', { pretendToBeVisual: true })
  const d = dom.window.document, w = dom.window as unknown as Window, f = d.querySelector('#frame') as HTMLElement
  let now = 1000, id = 0
  const timers = new Map<number, { due: number; fn: () => void }>()
  const media = { matches: false, addEventListener() {}, removeEventListener() {} }
  Object.defineProperty(w.performance, 'now', { value: () => now })
  w.matchMedia = () => media as unknown as MediaQueryList
  w.setTimeout = ((fn: () => void, ms: number) => { timers.set(++id, { due: now + ms, fn }); return id }) as typeof w.setTimeout
  w.clearTimeout = (n) => { if (n !== undefined) timers.delete(n) }
  const advance = (ms: number) => {
    const target = now + ms
    for (let cap = 0; cap < 100; cap++) {
      const item = [...timers].sort((a, b) => a[1].due - b[1].due)[0]
      if (!item || item[1].due > target) break
      now = item[1].due; timers.delete(item[0]); item[1].fn()
    }
    now = target
  }
  const select = (page: string) => {
    for (const e of Array.from(f.querySelectorAll('[data-cc-leaf]'))) e.removeAttribute('aria-current')
    f.querySelector(`[data-cc-i="${page}"]`)?.setAttribute('aria-current', 'page')
  }
  const bind = (next: string) => f.querySelector('[data-conversation-content]')!.setAttribute('data-conversation-session', next)

  const splash = createP4RouteSplash(d, w, f)
  const layer = d.querySelector('.dsh-p4-route-splash') as HTMLElement
  splash.sync()

  f.querySelector('[data-row-key^="workspace:"]')!.setAttribute('aria-expanded', 'false')
  f.querySelector('p')!.append('stream')
  splash.sync(); advance(100)
  assert.equal(layer.dataset.sequence, undefined)

  bind('two'); splash.sync(); advance(32)
  assert.equal(layer.dataset.sequence, '1')
  assert.equal(layer.dataset.kind, 'workspace')
  assert.equal(layer.hidden, false)

  splash.sync(); advance(1000)
  assert.equal(layer.hidden, true)

  select('1'); splash.sync(); advance(32)
  assert.equal(layer.dataset.sequence, '2')
  assert.equal(layer.dataset.kind, 'page')
  f.querySelector('input')!.dispatchEvent(new dom.window.Event('beforeinput', { bubbles: true }))
  assert.equal(layer.hidden, true)
  assert.equal(d.documentElement.hasAttribute('data-p4-route-active'), false)

  splash.dispose()
  assert.equal(timers.size, 0)
  assert.equal(d.querySelector('.dsh-p4-route-splash'), null)
  dom.window.close()
})

test('P4 footArea keeps settings/account 更多 button visible in rc3, standard, and collapsed modes', () => {
  assert.match(css, /\[data-p4-native-layout\]:not\(\[data-sidebar-collapsed\]\) \.wtg9ga_footerActions:not\(:has\(button,a,\[role="button"\],\[aria-haspopup\]\)\)\s*\{\s*display:none!important;\s*\}/)
  assert.match(css, /\[data-p4-native-layout\]:not\(\[data-sidebar-collapsed\]\) \.wtg9ga_settingsArea\s*\{\s*flex:1 1 0%!important;\s*width:auto!important;/)
  assert.match(css, /:not\(\[data-p4-native-layout\]\) \[class\$="_footerActions"\]:not\(:has\(button,a,\[role="button"\],\[aria-haspopup\]\)\)\s*\{\s*display:none!important;\s*\}/)
  assert.match(css, /:not\(\[data-p4-native-layout\]\) \[class\$="_footArea"\] :is\(button,\[aria-haspopup="menu"\],\[data-signed-out\]\[aria-haspopup="menu"\]\)/)
  assert.match(css, /\[data-sidebar-collapsed\]:not\(\[data-sidebar-drawer\]\) \[class\$="_footArea"\] :is\(\[class\*="_label"\],\[data-signed-out\]\[aria-haspopup="menu"\]::before\)/)
})
