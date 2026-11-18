import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
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
let server, browser, socket, sessionId, base, artifacts
let nextId = 0
const pending = new Map()
const errors = []

function outputMatch(child, stream, pattern) {
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output.slice(-800)}`)), 20000)
    child.once('error', error => { clearTimeout(timer); reject(error) })
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Process exited: ${code}; ${output.slice(-800)}`)) })
    stream.on('data', chunk => {
      output += chunk
      const match = output.match(pattern)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
  })
}

function send(method, params = {}, target = sessionId) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 15000)
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result) }, reject })
    socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}

async function waitFor(expression) {
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => { if (${expression}) resolve(true); else if (performance.now()-started > 6000) reject('Condition timed out'); else requestAnimationFrame(check) };
    check();
  })`)
}

async function navigate(path, width = 1440, height = 900) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}${path}` })
  await waitFor(`location.pathname === ${JSON.stringify(path.split('?')[0])} && document.readyState === 'complete'`)
  await evaluate('document.fonts.ready.then(() => true)')
  if (path.includes('desktop')) await waitFor("!!document.querySelector('.dsh-cc-chrome') && !!document.querySelector('[data-cc-leaf]')")
  await evaluate(`new Promise(resolve => setTimeout(resolve, 750))`)
  if(path.includes('native-rc3')) await waitFor("!!document.querySelector('[data-p3-native-layout],[data-p4-native-layout]') && document.documentElement.getAttribute('data-p4-immersion') !== 'enter'")
  if(path.includes('persona')) await waitFor("document.documentElement.getAttribute('data-p3-immersion') !== 'enter' && document.documentElement.getAttribute('data-p4-immersion') !== 'enter'")
}

async function pointer(selector, click = false) {
  const { x, y } = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); const r = e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  if (click) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x, y })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x, y })
  }
  await evaluate('new Promise(resolve => setTimeout(resolve, 300))')
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(artifacts, `${name}.png`), Buffer.from(data, 'base64'))
}

before(async () => {
  assert.ok(executable, 'Set BROWSER_EXE to a Chromium browser executable')
  artifacts = await mkdtemp(join(tmpdir(), 'dsh-cc-ui-'))
  console.log(`UI screenshots: ${artifacts}`)
  server = spawn(process.execPath, ['scripts/preview-server.mjs'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
  base = await outputMatch(server, server.stdout, /preview (http:\/\/127\.0\.0\.1:\d+)/)
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${join(artifacts, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const endpoint = await outputMatch(browser, browser.stderr, /DevTools listening on (ws:\/\/[^\s]+)/)
  socket = new WebSocket(endpoint)
  await once(socket, 'open')
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(JSON.stringify(message.error)))
      else request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) errors.push(message.params.response.url)
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null)
  ;({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null))
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
})

after(async () => {
  if (socket?.readyState === WebSocket.OPEN) {
    await send('Browser.close', {}, null)
    socket.close()
  }
  server?.kill()
})

test('desktop: compact navigation keeps black borders at rest, on hover and when selected', async () => {
  for (const [width, height] of [[1440, 900], [1024, 640], [1024, 500]]) {
    await navigate('/desktop.html', width, height)
    assert.equal(await evaluate("document.querySelector('.dsh-cc-tagline').textContent"), 'TAKE YOUR HEART')
    const cards = await evaluate(`Array.from(document.querySelectorAll('[data-cc-leaf], #acct')).map(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const label = e.querySelector('.xx_wide').getBoundingClientRect();
      return {leaf:e.matches('[data-cc-leaf]'), text:e.textContent.trim(), border:s.borderTopWidth, color:s.borderTopColor, clip:s.clipPath,
        font:parseFloat(s.fontSize), height:parseFloat(s.height), width:parseFloat(s.width), margin:parseFloat(s.marginLeft),
        angle:Math.atan2(new DOMMatrix(s.transform).b,new DOMMatrix(s.transform).a)*180/Math.PI,
        parentWidth:e.parentElement.clientWidth, overflow:e.scrollWidth-e.clientWidth, rect:r.toJSON(), label:label.toJSON()};
    })`)
    assert.equal(cards.length, 4)
    for (const card of cards) {
      assert.equal(card.border, '3px', card.text)
      assert.equal(card.color, 'rgb(12, 12, 12)', card.text)
      assert.equal(card.clip, 'none', card.text)
      assert.ok(card.font <= 30 && card.height <= 44 && card.height >= 32, JSON.stringify(card))
      assert.ok(card.width <= card.parentWidth - 92, JSON.stringify(card))
      assert.ok(Math.abs(card.angle + 2) < 0.01, JSON.stringify(card))
      assert.equal(card.margin, 4 + cards.indexOf(card) * 10)
      if (card.leaf) assert.ok(card.overflow <= 1, JSON.stringify(card))
      assert.ok(card.label.x >= card.rect.x && card.label.right <= card.rect.right, JSON.stringify(card))
    }
    for (let i = 1; i < 3; i++) {
      assert.ok(cards[i].rect.top > cards[i - 1].rect.bottom, JSON.stringify(cards.slice(i - 1, i + 1)))
    }
    await shot(`compact-nav-${width}x${height}`)
    const leaf = '[data-cc-leaf][data-cc-i="1"]'
    await pointer(leaf, true)
    await waitFor(`document.querySelector('${leaf}').hasAttribute('data-cc-morph')`)
    const hover = await evaluate(`(() => {
      const e = document.querySelector('${leaf}'), s = getComputedStyle(e);
      const r = e.getBoundingClientRect(), p = e.querySelector('.dsh-cc-morph').getBoundingClientRect();
      return {border:s.borderTopWidth, color:s.borderTopColor, text:s.color, rect:r.toJSON(), plate:p.toJSON()};
    })()`)
    assert.equal(hover.border, '3px')
    assert.equal(hover.color, 'rgb(12, 12, 12)')
    assert.equal(hover.text, 'rgb(255, 255, 255)')
    assert.ok(hover.plate.x > hover.rect.x && hover.plate.right < hover.rect.right, JSON.stringify(hover))
    await evaluate(`document.querySelector('${leaf}').setAttribute('aria-current', 'page')`)
    await pointer('[data-conversation-header-leading]')
    assert.equal(await evaluate(`document.querySelector('${leaf}').getAttribute('data-cc-morph')`), 'leaf')
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('${leaf} > .dsh-cc-morph')).animationName`), 'none')
    await waitFor("!document.querySelector('.dsh-cc-transition.is-on')")
    const selected = await evaluate(`Array.from(document.querySelectorAll('[data-cc-leaf]')).map(e => e.getBoundingClientRect().toJSON())`)
    for (let i = 1; i < selected.length; i++) assert.ok(selected[i].top > selected[i - 1].bottom, JSON.stringify(selected))
    await shot(`compact-selected-${width}x${height}`)
    await pointer('#acct', true)
    assert.equal(await evaluate("document.querySelector('#acct').getAttribute('aria-expanded')"), 'true')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#acct')).borderTopWidth"), '3px')
    await shot(`compact-more-${width}x${height}`)
  }
})

test('desktop: four localized navigation cards form an even diagonal stack', async () => {
  for (const [width, height, labels] of [
    [1440, 900, ['新会话', '插件', '自动化任务', '更多']],
    [1024, 500, ['新会话', '插件', '自动化任务', '更多']],
    [1024, 500, ['New Session', 'Plugins', 'Automation tasks', 'More']],
  ]) {
    await navigate('/desktop.html', width, height)
    await evaluate(`(() => {
      const extra = document.querySelector('[data-cc-i="1"]').cloneNode(true);
      extra.setAttribute('aria-label', ${JSON.stringify(labels[3])});
      document.querySelector('.wtg9ga_panelList').append(extra);
      ${JSON.stringify(labels)}.forEach((text, i) => document.querySelectorAll('[data-cc-leaf]')[i].querySelector('.xx_wide').textContent=text);
    })()`)
    await waitFor(`document.querySelector('[data-cc-i="3"]')?.textContent === ${JSON.stringify(labels[3])} && !document.querySelector('[data-cc-leaf][data-cc-enter]')`)
    const cards = await evaluate(`Array.from(document.querySelectorAll('[data-cc-leaf]')).map(e => {
      const s=getComputedStyle(e), r=e.getBoundingClientRect(), label=e.querySelector('.xx_wide').getBoundingClientRect();
      const hit=document.elementFromPoint(label.x+label.width/2,label.y+label.height/2);
      return {left:parseFloat(s.marginLeft), top:r.top, bottom:r.bottom, transform:s.transform, visible:e===hit||e.contains(hit), overflow:e.scrollWidth-e.clientWidth};
    })`)
    assert.equal(cards.length, 4)
    for (let i=0; i<4; i++) {
      assert.equal(cards[i].left, 4+i*10)
      assert.equal(cards[i].transform, cards[0].transform)
      assert.ok(cards[i].visible && cards[i].overflow <= 1, JSON.stringify(cards))
      if (i) assert.ok(cards[i].top > cards[i-1].bottom, JSON.stringify(cards))
    }
    await shot(`diagonal-four-${width}x${height}-${labels[3] === 'More' ? 'en' : 'zh'}`)
  }
})

test('desktop: localized navigation and reduced motion retain readable compact cards', async () => {
  await navigate('/desktop.html', 1024, 640)
  await evaluate(`['新会话', '插件', '自动化任务'].forEach((text, i) => {
    document.querySelector('[data-cc-i="'+i+'"] .xx_wide').textContent = text;
  })`)
  await waitFor("document.querySelector('[data-cc-i=\"2\"]').getAttribute('data-cc-lines') === '1'")
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await pointer('[data-cc-i="2"]')
  const state = await evaluate(`(() => {
    const e = document.querySelector('[data-cc-i="2"]'), s = getComputedStyle(e);
    const r = e.getBoundingClientRect(), t = e.querySelector('.xx_wide').getBoundingClientRect();
    return {animation:s.animationName, border:s.borderTopWidth, fits:t.x >= r.x && t.right <= r.right};
  })()`)
  assert.equal(state.animation, 'none')
  assert.equal(state.border, '3px')
  assert.ok(state.fits)
  await shot('compact-nav-chinese-reduced-motion')
  await send('Emulation.setEmulatedMedia', { features: [] })
})

test('desktop: workspace gains usable list height without shrinking its rows', async () => {
  for (const [width, height] of [[1440, 900], [1024, 640], [1024, 500]]) {
    await navigate('/desktop.html', width, height)
    const space = await evaluate(`(() => {
      const region = document.querySelector('.wtg9ga_regionArea');
      const first = document.querySelector('[data-row-key="workspace:dsh"]');
      const available = () => region.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
      const current = available();
      const old = document.createElement('style');
      old.textContent = \`
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf] { margin-top:26px; padding:5px 10px; width:calc(100% - 64px); }
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf][data-cc-lines="1"] { height:\${innerHeight <= 640 ? 42 : 48}px; min-height:40px; max-height:48px; }
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf][data-cc-lines="2"] { min-height:\${innerHeight <= 640 ? 46 : 50}px; max-height:none; }
        html[data-dsh-calling-card-skin] div:has(> [data-shell-overlay]):not([data-sidebar-collapsed]) [data-cc-leaf][data-cc-i="0"] { margin-top:\${innerHeight <= 640 ? '86px' : 'clamp(108px, 17vh, 162px)'}; }
        html[data-dsh-calling-card-skin] [data-signed-out][aria-haspopup="menu"]:not([data-collapsed="true"]) { height:36px !important; }
      \`;
      document.head.append(old);
      const previous = available();
      old.remove();
      const tagline = document.querySelector('.dsh-cc-tagline').getBoundingClientRect();
      const nav = document.querySelector('[data-cc-i="0"]').getBoundingClientRect();
      return {current, previous, gain:current-previous, rowHeight:first.offsetHeight, brandClear:nav.top > tagline.bottom};
    })()`)
    console.log('Workspace space:', JSON.stringify({width, height, ...space}))
    assert.ok(space.gain >= 35, JSON.stringify(space))
    assert.equal(space.rowHeight, 34)
    assert.ok(space.brandClear)
    assert.equal(await evaluate("document.querySelector('#acct').getBoundingClientRect().bottom <= document.documentElement.clientHeight"), true)
    await shot(`workspace-${width}x${height}`)
    await evaluate(`(() => {
      const list = document.querySelector('.GAkraW_listArea'), row = list.querySelector('[data-row-key="session:demo-4"]');
      for (let i=0; i<8; i++) { const copy=row.cloneNode(true); copy.setAttribute('data-row-key','session:overflow-'+i); list.append(copy); }
    })()`)
    await pointer('[data-row-key="workspace:dsh"]')
    await send('Input.dispatchMouseEvent', { type:'mouseWheel', x:100, y:height-125, deltaX:0, deltaY:500 })
    await waitFor("document.querySelector('.wtg9ga_regionArea').scrollTop > 0")
    assert.equal(await evaluate("document.querySelector('#acct').checkVisibility()"), true)
    await shot(`workspace-scrolled-${width}x${height}`)
  }
})

test('desktop: session actions share the row without covering its title', async () => {
  await navigate('/desktop.html')
  const row = '[data-row-key="session:demo-4"]'
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('${row} > [class*="_rowActions"]')).display`), 'none')
  await pointer(row)
  const layout = await evaluate(`(() => { const r=document.querySelector('${row}'); const t=r.querySelector('[class*="_title"]').getBoundingClientRect(); const a=r.querySelector('[class*="_rowActions"]'); return {titleRight:t.right,actionsLeft:a.getBoundingClientRect().left,display:getComputedStyle(a).display,resting:getComputedStyle(r.querySelector('[class*="_rowResting"]')).display} })()`)
  await shot('desktop-actions')
  assert.equal(layout.display, 'flex')
  assert.equal(layout.resting, 'none')
  assert.ok(layout.titleRight <= layout.actionsLeft + 1, JSON.stringify(layout))
})

test('collapsed rail: MORE opens the real fixture menu at desktop and short heights', async () => {
  for (const [width, height] of [[1440, 900], [1024, 640], [1024, 500]]) {
    await navigate('/desktop.html', width, height)
    await pointer('[data-sidebar-toggle]', true)
    await waitFor("document.documentElement.hasAttribute('data-cc-rail')")
    const tagline = await evaluate(`(() => {
      const e = document.querySelector('.dsh-cc-tagline');
      return {text:e.textContent, rect:e.getBoundingClientRect().toJSON()};
    })()`)
    assert.equal(tagline.text, 'TAKE YOUR HEART')
    assert.ok(tagline.rect.x >= 0 && tagline.rect.y >= 0 && tagline.rect.right <= width && tagline.rect.bottom <= height, JSON.stringify(tagline))
    const layout = await evaluate(`(() => { const e=document.querySelector('#acct'); const r=e.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return {r:r.toJSON(),visible:e.checkVisibility(),hit:hit===e||e.contains(hit),label:getComputedStyle(e,'::before').content} })()`)
    await shot(`rail-${width}x${height}`)
    assert.ok(layout.visible && layout.hit, JSON.stringify(layout))
    assert.ok(layout.r.y >= 0 && layout.r.bottom <= height, JSON.stringify(layout))
    assert.equal(layout.label, '"MORE"')
    await pointer('#acct', true)
    assert.equal(await evaluate("document.querySelector('#acct').getAttribute('aria-expanded')"), 'true')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-acct-menu')).display"), 'flex')
    assert.notEqual(await evaluate("getComputedStyle(document.querySelector('#acct'),'::before').display"), 'none')
    await shot(`rail-menu-${width}x${height}`)
    await pointer('#acct', true)
    await pointer('[data-sidebar-toggle]', true)
    await waitFor("!document.documentElement.hasAttribute('data-cc-rail')")
    assert.equal(await evaluate("document.querySelectorAll('[data-cc-rail-btn]').length"), 0)
  }
})

test('menus: hover, keyboard focus, disabled items and tooltips retain readable styles', async () => {
  await navigate('/menus.html')
  await pointer('#m-acct button')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-acct button')).color"), 'rgb(11, 11, 11)')
  await pointer('#m-model [aria-disabled="true"]')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model [aria-disabled]')).color"), 'rgb(138, 138, 138)')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  assert.equal(await evaluate("document.activeElement.matches(':focus-visible')"), true)
  await shot('menus')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[role=tooltip]')).borderRadius"), '0px')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-acct')).animationName"), 'none')
  await send('Emulation.setEmulatedMedia', { features: [] })
})

test('submenus keep their pointer bridge and support keyboard entry and exit', async () => {
  await navigate('/menus.html')
  const trigger = '#m-ctx [aria-haspopup="menu"]'
  await pointer(trigger)
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-submenu')).display"), 'flex')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-submenu')).animationName"), 'none')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#fixture-submenu'),'::before').width"), '10px')
  await pointer('#fixture-submenu button')
  assert.equal(await evaluate("document.querySelector('#fixture-submenu').checkVisibility()"), true)
  await shot('submenu')
  await evaluate("document.querySelector('#fixture-submenu button').focus()")
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  assert.equal(await evaluate("document.querySelector('#fixture-submenu').style.display"), 'none')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  assert.equal(await evaluate("document.querySelector('#fixture-submenu').contains(document.activeElement)"), true)
})

test('model surface preserves its red backing and the internal list still scrolls', async () => {
  await navigate('/menus.html')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model')).overflow"), 'visible')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model > ._9r0rkG_groups')).overflowY"), 'auto')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('#m-model ._9r0rkG_check')).color"), 'rgb(230, 0, 18)')
  assert.equal(await evaluate("getComputedStyle(document.querySelector('[role=tooltip] kbd')).backgroundColor"), 'rgb(230, 0, 18)')
  const scroll = await evaluate(`(() => {
    const list = document.querySelector('#m-model > ._9r0rkG_groups');
    for (let i=0; i<20; i++) list.append(list.querySelector('button').cloneNode(true));
    list.scrollTop = list.scrollHeight;
    return {height:list.clientHeight,total:list.scrollHeight,offset:list.scrollTop};
  })()`)
  assert.ok(scroll.offset > 0 && scroll.total > scroll.height, JSON.stringify(scroll))
  await shot('model-scroll')
})

test('streaming: existing reply text skips document-wide scans and new content still gets styled', async () => {
  await navigate('/desktop.html?letters=plain')
  const scans = await evaluate(`(async () => {
    const paragraph = document.querySelector('[data-chat-flow-kind="assistant-step"] p');
    const query = document.querySelectorAll;
    let count = 0;
    document.querySelectorAll = function (...args) { count++; return query.apply(this, args); };
    try {
      for (let i = 0; i < 60; i++) {
        if (i % 2) paragraph.firstChild.data += 'x';
        else paragraph.textContent += 'x';
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return count;
    } finally {
      document.querySelectorAll = query;
    }
  })()`)
  assert.equal(scans, 0, `Document-wide scans for 60 plain reply updates: ${scans}`)
  await evaluate(`document.querySelector('[data-conversation-scroll]').insertAdjacentHTML('beforeend',
    '<article data-chat-flow-kind="assistant-step" id="new-reply"><p>Stream starts</p><div data-presented-file><p class="xx_fileName">notes.md</p><span class="xx_fileIcon"></span></div></article>')`)
  await waitFor("document.querySelector('#new-reply').hasAttribute('data-cc-enter') && document.querySelector('.xx_fileIcon').getAttribute('data-cc-ext') === 'MD'")
  await evaluate("document.querySelector('.xx_fileName').firstChild.data = 'notes.png'")
  await waitFor("document.querySelector('.xx_fileIcon').getAttribute('data-cc-ext') === 'PNG'")
  await evaluate("document.querySelector('.dsh-cc-letters').click()")
  await waitFor("!!document.querySelector('#new-reply p > .dsh-cc-collage')")
  await evaluate("document.querySelector('#new-reply p').firstChild.data = 'Stream continues'")
  await waitFor("document.querySelector('#new-reply p').getAttribute('data-cc-collage-pending') === 'Stream continues'")
  await waitFor("document.querySelector('#new-reply p').getAttribute('data-cc-collage') === 'Stream continues'")
})

test('non-modal question window preserves the transcript, focus and draft at both dock sizes', async () => {
  await navigate('/widgets.html')
  const popup = '[data-cc-attention-window="question"]:popover-open'
  const mounted = `!!document.querySelector('${popup}')`
  await evaluate(`(() => {
    document.querySelector('[data-phase]').style.height = '100%';
    document.querySelector('[data-conversation-scroll]').insertAdjacentHTML('afterbegin',
      '<details><summary id="summary-test">思考摘要</summary><p>先核对导出路径，再试一张小图。</p></details>');
    document.querySelector('[data-composer-seat]').insertAdjacentHTML('afterbegin',
      '<div data-question-key="new"><section><h2>先导出哪一张？</h2><textarea id="answer-test" aria-label="Answer"></textarea><button type="button" id="submit-test">提交</button></section></div>');
    window.questionOriginal = document.querySelector('[data-question-key]');
    document.querySelector('#submit-test').addEventListener('click', () => window.questionOriginal.remove());
  })()`)
  await waitFor(mounted)
  const sequence = await evaluate(`(() => {
    const panel = document.querySelector('${popup}');
    const seam = document.querySelector('.dsh-cc-window-seam:popover-open');
    return { delay: panel.getAnimations()[0].effect.getTiming().delay,
      tear: getComputedStyle(seam, '::before').animationName,
      clickThrough: getComputedStyle(seam).pointerEvents };
  })()`)
  assert.deepEqual(sequence, { delay: 150, tear: 'dsh-cc-gap-open', clickThrough: 'none' })
  await waitFor(`!document.querySelector('${popup}').getAnimations().length`)
  assert.equal(await evaluate(`document.querySelector('${popup}') === window.questionOriginal && !!window.questionOriginal.closest('[data-composer-seat]')`), true)
  const bounds = (axis) => evaluate(`(() => {
    const reading = document.querySelector('[data-conversation-scroll]').getBoundingClientRect();
    const windowBox = document.querySelector('${popup}').getBoundingClientRect();
    return windowBox.${axis === 'side' ? 'left >= reading.right' : 'top >= reading.bottom'} && windowBox.bottom <= innerHeight;
  })()`)
  assert.equal(await bounds('side'), true)
  await pointer('#summary-test', true)
  assert.equal(await evaluate("document.querySelector('#summary-test').parentElement.open"), true)
  assert.equal(await evaluate(mounted), true)
  await evaluate("document.querySelector('#answer-test').focus()")
  await send('Input.insertText', { text: '保留当前草稿' })
  await pointer('.dsh-cc-window-bar button', true)
  assert.equal(await evaluate(mounted), false)
  assert.equal(await evaluate("!!document.querySelector('[data-cc-window-exit], .dsh-cc-window-seam')"), false)
  assert.equal(await evaluate("document.activeElement.className"), 'dsh-cc-window-chip')
  await pointer('.dsh-cc-window-chip', true)
  assert.equal(await evaluate(mounted), true)
  assert.equal(await evaluate("document.querySelector('#answer-test').value"), '保留当前草稿')
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 640, deviceScaleFactor: 1, mobile: false })
  await waitFor("!!document.querySelector('[data-cc-window-layout=bottom]')")
  await waitFor(`document.querySelector('${popup}').getBoundingClientRect().top >= document.querySelector('[data-conversation-scroll]').getBoundingClientRect().bottom`)
  assert.equal(await bounds('bottom'), true)
  await evaluate("document.querySelector('#submit-test').click()")
  await waitFor(`!!document.querySelector('${popup}[data-cc-window-exit]')`)
  assert.equal(await evaluate(`(() => {
    const sheet = document.querySelector('${popup}[data-cc-window-exit]');
    return sheet.inert && sheet.getAttribute('aria-hidden') === 'true' && !sheet.querySelector('[id]')
      && !window.questionOriginal.isConnected
      && !!document.querySelector('.dsh-cc-window-seam[data-cc-seam-phase=sew]:popover-open')
      && !!document.querySelector('[data-cc-window-layout=bottom]');
  })()`), true)
  await waitFor("!document.querySelector('[data-cc-window-layout]')")
  assert.equal(await evaluate("!!document.querySelector('[data-cc-window-exit], .dsh-cc-window-seam')"), false)
})

test('current errors get a dismissible window, while history and warnings stay inline', async () => {
  await navigate('/widgets.html')
  const popup = '[data-cc-attention-window="error"]:popover-open'
  const mounted = `!!document.querySelector('${popup}')`
  assert.equal(await evaluate(mounted), false)
  await evaluate(`document.querySelector('[data-conversation-scroll]').insertAdjacentHTML('beforeend',
    '<div data-chat-flow><div data-chat-flow-key="current" data-chat-turn="2"></div></div>')`)
  const addNotice = (key, turn, state, position) => evaluate(`document.querySelector('[data-chat-flow]').insertAdjacentHTML('${position}',
    '<div data-chat-flow-key="${key}" data-chat-turn="${turn}"><div class="host_turnErrorRow"><span data-state="${state}"></span><span class="host_turnErrorTitle">导出中断</span><span class="host_turnErrorMessage">输出目录不可写</span></div></div>')`)
  await addNotice('old-error', '1', 'error', 'afterbegin')
  await addNotice('limit', '2', 'warning', 'beforeend')
  assert.equal(await evaluate(mounted), false, 'history and token-limit notices stay quiet')
  await addNotice('new-error', '2', 'error', 'beforeend')
  await waitFor(mounted)
  assert.equal(await evaluate(`document.querySelector('${popup} h2').textContent`), '导出中断')
  await waitFor(`!document.querySelector('${popup}').getAnimations().length`)
  await evaluate(`document.querySelector('${popup} .dsh-cc-window-bar button').click()`)
  await waitFor("!!document.querySelector('[data-cc-window-exit][data-cc-attention-window=error]:popover-open')")
  await waitFor(`!${mounted}`)
  assert.equal(await evaluate("document.querySelector('[data-chat-flow-key=new-error] .host_turnErrorMessage').textContent"), '输出目录不可写')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  try {
    await addNotice('reduced-error', '3', 'error', 'beforeend')
    await waitFor(mounted)
    assert.equal(await evaluate(`document.querySelector('${popup} h2').textContent`), '导出中断')
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('${popup}')).animationName`), 'none')
    await pointer(`${popup} .dsh-cc-window-bar button`, true)
    assert.equal(await evaluate(mounted), false)
  } finally {
    await send('Emulation.setEmulatedMedia', { features: [] })
  }
})

test('paper layers leave the composer and delivered-file actions interactive', async () => {
  await navigate('/widgets.html', 1024, 640)
  await evaluate(`(() => {
    const input = document.querySelector('[data-composer-input]');
    const scroll = document.createElement('div');
    scroll.setAttribute('data-input-scroll', '');
    input.replaceWith(scroll);
    scroll.append(input);
    const preview = document.querySelector('[data-presented-file] [class*="_cardPreview"]');
    preview.addEventListener('click', () => { window.filePreviewClicked = true; });
    preview.scrollIntoView({ block: 'center' });
  })()`)
  await pointer('[data-presented-file] [class*="_cardPreview"]', true)
  assert.equal(await evaluate('window.filePreviewClicked'), true)
  await evaluate(`document.querySelector('[data-composer-input]').scrollIntoView({ block: 'nearest' })`)
  await pointer('[data-composer-input]', true)
  await send('Input.insertText', { text: '保留草稿' })
  const input = await evaluate(`(() => {
    const field = document.querySelector('[data-composer-input]');
    const card = field.closest('[data-composer-card]');
    return { active: document.activeElement === field, draft: field.value, color: getComputedStyle(field).color,
      paper: getComputedStyle(field.parentElement).backgroundColor,
      ignorePointer: getComputedStyle(card, '::after').pointerEvents };
  })()`)
  assert.deepEqual(input, { active: true, draft: '保留草稿', color: 'rgb(20, 20, 20)', paper: 'rgb(247, 244, 238)', ignorePointer: 'none' })
})

test('persona modes: P3 and P4 draw their own scene, clock or calendar, tagline and transition; P5 sheet is off', async () => {
  await navigate('/persona.html?persona=p3&hero=1')
  await waitFor("!!document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-clock')")
  const p3 = await evaluate(`(() => {
    const art = document.querySelector('.dsh-persona-art:not([hidden])');
    const shown = (sel) => getComputedStyle(art.querySelector(sel)).display !== 'none';
    return { persona: document.documentElement.dataset.dshPersona,
      p5Off: document.querySelector('style[data-plugin-css="dsh-calling-card-skin/skin.css"]').media,
      time: /^\\d{1,2}:\\d{2}$/.test(art.querySelector('[data-persona-time]').textContent),
      clock: shown('.dsh-persona-clock'), moon: shown('.dsh-persona-phase'), calendar: shown('.dsh-persona-calendar'),
      tagline: [...art.querySelectorAll('.dsh-persona-tagline span')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent),
      cut: !!document.querySelector('[data-persona-cut]'),
      hero: getComputedStyle(document.querySelector('[data-cc-leaf][data-cc-i="0"]')).color };
  })()`)
  assert.deepEqual(p3, { persona: 'p3', p5Off: 'not all', time: true, clock: true, moon: true, calendar: false,
    tagline: ['MEMENTO MORI'], cut: true, hero: 'rgb(204, 8, 55)' })
  const before = await evaluate("document.querySelector('[data-persona-cut]').getAttribute('data-persona-cut')")
  await evaluate("document.querySelector('[data-conversation-content]').setAttribute('data-conversation-session', 'next')")
  await waitFor(`document.querySelector('[data-persona-cut]').getAttribute('data-persona-cut') !== '${before}'`)
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-phase]'), '::after').animationName`), 'none', 'no lone conversation wipe after whole-app entry')
  const p3Layout = await evaluate(`(() => {
    const art = document.querySelector('.dsh-persona-art:not([hidden])');
    const echo = art.querySelector('.dsh-persona-session');
    return { echo: echo.textContent, vertical: getComputedStyle(echo).writingMode,
      banner: ['WEEKDAY', 'WEEKEND', 'DARK HOUR'].includes(art.querySelector('[data-persona-banner]').textContent),
      card: getComputedStyle(art.querySelector('.dsh-persona-card')).display,
      header: getComputedStyle(art.querySelector('.dsh-persona-header')).display };
  })()`)
  assert.equal(p3Layout.vertical, 'vertical-rl')
  assert.deepEqual({ ...p3Layout, echo: p3Layout.echo.length > 0 }, { echo: true, vertical: 'vertical-rl', banner: true, card: 'block', header: 'none' })
  const cutBeforePage = await evaluate("document.querySelector('[data-persona-cut]').getAttribute('data-persona-cut')")
  await evaluate("document.querySelector('[data-cc-leaf][data-cc-i=\"1\"]').setAttribute('aria-current', 'page')")
  await waitFor(`document.querySelector('[data-persona-cut]').getAttribute('data-persona-cut') !== '${cutBeforePage}'`)
  assert.equal(await evaluate(`document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-session').textContent ===
    document.querySelector('[data-cc-leaf][data-cc-i="1"]').textContent.replace(/\\s+/g, ' ').trim().toUpperCase()`), true)

  await navigate('/persona.html?persona=p4')
  await waitFor("!!document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-calendar')")
  const p4 = await evaluate(`(() => {
    const art = document.querySelector('.dsh-persona-art:not([hidden])');
    const shown = (sel) => getComputedStyle(art.querySelector(sel)).display !== 'none';
    const row = document.querySelector('[data-row-key="session:demo-1"]');
    return { scheme: document.documentElement.style.colorScheme, calendar: shown('.dsh-persona-calendar'), clock: shown('.dsh-persona-clock'),
      day: /^(SUN|MON|TUE|WED|THU|FRI|SAT)$/.test(art.querySelector('[data-persona-day]').textContent),
      tagline: [...art.querySelectorAll('.dsh-persona-tagline span')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent),
      row: [getComputedStyle(row).backgroundColor, getComputedStyle(row).color],
      tv: getComputedStyle(document.querySelector('[data-phase]')).animationName };
  })()`)
  assert.deepEqual(p4, { scheme: 'light', calendar: true, clock: false, day: true, tagline: ['SEEK YOUR TRUTH'],
    row: ['rgb(255, 230, 0)', 'rgb(18, 18, 18)'], tv: p4.tv })
  assert.match(p4.tv, /^p4-tv-[ab]$/)
  const p4Session = await evaluate(`(() => {
    const art = document.querySelector('.dsh-persona-art:not([hidden])');
    const shown = (sel) => getComputedStyle(art.querySelector(sel)).display !== 'none';
    return { tv: shown('.dsh-persona-tv'), stage: shown('.dsh-persona-stage'), days: shown('.dsh-persona-days'),
      echo: art.querySelector('.dsh-persona-session').textContent, oldPanel: shown('.dsh-persona-panel') };
  })()`)
  assert.deepEqual(p4Session, { tv: false, stage: true, days: false, echo: 'SESSION', oldPanel: false })
  await navigate('/persona.html?persona=p4&hero=1')
  await waitFor("!!document.querySelector('.dsh-persona-art:not([hidden]) [data-persona-days] li[data-today]')")
  const p4Hero = await evaluate(`(() => {
    const art = document.querySelector('.dsh-persona-art:not([hidden])');
    const leaf = document.querySelector('[data-cc-leaf][data-cc-i="0"]');
    return { cells: art.querySelectorAll('[data-persona-days] li').length, today: art.querySelectorAll('[data-persona-days] li[data-today]').length,
      days: getComputedStyle(art.querySelector('.dsh-persona-days')).display, disc: getComputedStyle(leaf, '::after').animationName };
  })()`)
  assert.deepEqual(p4Hero, { cells: 7, today: 1, days: 'none', disc: 'p4-stripe' })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  try {
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-phase]')).animationName"), 'none')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-fog i')).animationName"), 'none')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-days')).animationName"), 'none')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-cc-leaf][data-cc-i=\"0\"]'), '::after').animationName"), 'none')
  } finally {
    await send('Emulation.setEmulatedMedia', { features: [] })
  }
  await evaluate("localStorage.removeItem('dsh-calling-card-skin:persona')")
})

test('fixtures: conversation and widget pages load without script or resource errors', async () => {
  for (const path of ['/conversation.html', '/widgets.html', '/']) {
    await navigate(path)
    assert.equal(await evaluate("document.documentElement.hasAttribute('data-dsh-calling-card-skin')"), true)
  }
  assert.deepEqual(errors.filter(e => !e.endsWith('/favicon.ico')), [])
})


test('1.3 reference grammar: bold P3 wedge, floating P4 serif, readable 1024 chat, menu and settings', async () => {
  for (const mode of ['p3', 'p4']) {
    await navigate(`/persona.html?persona=${mode}&hero=1`)
    await waitFor("!!document.querySelector('.dsh-persona-art:not([hidden])')")
    const grammar = await evaluate(`(() => {
      const art = document.querySelector('.dsh-persona-art:not([hidden])');
      const leaf = document.querySelector('[data-cc-leaf][data-cc-i="0"]');
      const c = getComputedStyle(leaf);
      return { background: c.backgroundImage, radius: c.borderRadius, cursor:getComputedStyle(leaf,"::before").clipPath,cursorFill:getComputedStyle(leaf,"::before").backgroundColor,cursorPink:getComputedStyle(leaf,"::before").borderTopColor,cursorArt:getComputedStyle(leaf,"::before").backgroundImage,
        font: c.fontFamily, weight: c.fontWeight,
        illustration: getComputedStyle(art.querySelector('.dsh-persona-illustration')).display,
        hudTop: art.querySelector('${mode === 'p3' ? '.dsh-persona-clock' : '.dsh-persona-calendar'}').getBoundingClientRect().top };
    })()`)
    assert.equal(grammar.illustration, 'none', 'no figures')
    assert.ok(grammar.hudTop >= 28, 'HUD clears caption')
    if (mode === 'p3') { assert.equal(grammar.background,'none');assert.equal(grammar.cursor,'none');assert.match(grammar.cursorArt,/Original broad selected P3 block/);assert.equal(grammar.weight,'800') }
    else { assert.equal(grammar.background, 'none'); assert.equal(grammar.radius, '0px'); assert.match(grammar.font, /Georgia/) }
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
    try {
      await navigate(`/persona.html?persona=${mode}`, 1024, 768)
      await waitFor("!!document.querySelector('.dsh-persona-art:not([hidden])')")
      const reading = await evaluate(`(() => { const e = document.querySelector('[data-phase]'); const c = getComputedStyle(e); const r=e.getBoundingClientRect(); return { width:r.width, transform:c.transform, right:r.right } })()`)
      assert.ok(reading.width > (mode === 'p3' ? 480 : 620), JSON.stringify(reading))
      assert.ok(reading.right <= 1024)
      // The TV-on entry animation may still be in flight, so inspect body text, not the stage.
      assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-chat-flow-kind=\"assistant-step\"] p')).transform"), 'none')
    } finally { await send('Emulation.clearDeviceMetricsOverride') }
    for (const query of ['menu=1', 'settings=1']) {
      await navigate(`/persona.html?persona=${mode}&${query}`)
      await waitFor("!!document.querySelector('.dsh-persona-art:not([hidden])')")
      assert.equal(await evaluate(`!!document.querySelector('${query === 'menu=1' ? '[data-menu-material]' : '[data-shortcut-modal="settings"]'}')`), true)
    }
    await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] })
    try {
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-session')).animationName"), 'none')
      assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-shortcut-modal=\"settings\"] [aria-current=\"true\"]'),'::after').animationName"), 'none')
    } finally { await send('Emulation.setEmulatedMedia', { features: [] }) }
  }
})


test('1.5 composition: P3 white index/seam stack, unchanged P4 footer, real toolbar and short-scroll containment', async () => {
 for (const mode of ['p3','p4']) {
  for (const [width,height] of [[1440,900],[1024,768],[1024,600]]) {
   await navigate(`/persona.html?persona=${mode}&long=1`,width,height)
   const layout=await evaluate(`(() => {
    const side=document.querySelector('#sideRoot').getBoundingClientRect();
    const input=document.querySelector('[data-composer-input]').getBoundingClientRect();
    const scroll=document.querySelector('[data-conversation-scroll]'); const sr=scroll.getBoundingClientRect();
    const nav=[...document.querySelectorAll('[data-cc-leaf]')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,text:e.textContent.trim(),scroll:e.scrollWidth,client:e.clientWidth}});
    return {sideX:side.x,nav,input:input.toJSON(),scroll:sr.toJSON(),scrollable:scroll.scrollHeight>scroll.clientHeight,
     fade:getComputedStyle(document.querySelector('[class$="_fade"]')).display,
     body:getComputedStyle(document.querySelector('[data-chat-flow-kind="assistant-step"] p')).transform};
   })()`)
   assert.equal(layout.fade,'none'); assert.equal(layout.body,'none'); assert.ok(layout.scrollable)
   assert.ok(layout.input.y >= layout.scroll.y && layout.input.bottom <= layout.scroll.bottom + 1,JSON.stringify(layout))
   for (const n of layout.nav) {
    assert.ok(n.x>=0 && n.right<=width && n.bottom<=height,JSON.stringify(n))
    assert.ok(n.scroll<=n.client+2,`functional label clipped: ${JSON.stringify(n)}`)
    assert.ok(n.bottom<310,JSON.stringify(n))
   }
   assert.ok(layout.sideX<width*.1,'project index returns to the left'); assert.ok(layout.nav[1].y>layout.nav[0].y,'seam menu is stacked'); assert.ok(layout.nav[2].y>layout.nav[1].y,'third command continues stack')
   await evaluate("document.querySelector('[data-conversation-scroll]').scrollTop=700")
   assert.ok(await evaluate("document.querySelector('[data-conversation-scroll]').scrollTop>500"))
  }
  await navigate(`/persona.html?persona=${mode}&long=1`)
  await pointer('[data-preview-toggle]',true)
  assert.equal(await evaluate("document.querySelector('[data-preview-toggle]').getAttribute('aria-pressed')"),'true')
  await pointer('[data-preview-menu]',true)
  assert.equal(await evaluate("!!document.querySelector('#preview-local-menu')"),true)
  await evaluate("document.querySelector('#preview-local-menu').remove();document.querySelector('[data-composer-input]').focus()")
  await send('Input.insertText',{text:' keyboard check'})
  assert.equal(await evaluate("document.querySelector('[data-composer-input]').textContent.includes('keyboard check')"),true)
  await pointer('[data-sidebar-toggle]',true)
  assert.equal(await evaluate("document.querySelector('#frame').hasAttribute('data-sidebar-collapsed')"),true)
  const rail=await evaluate(`(() => {const e=document.querySelector('[class$="_panelList"]');const r=e.getBoundingClientRect();return {display:getComputedStyle(e).display,w:r.width,buttons:[...e.querySelectorAll('button')].map(b=>{const x=b.getBoundingClientRect();return x.width>20&&x.height>20})}})()`)
  assert.equal(rail.display,'flex');assert.ok(rail.w<60);assert.ok(rail.buttons.every(Boolean))
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  try { assert.equal(await evaluate("getComputedStyle(document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-session')).animationName"),'none') }
  finally { await send('Emulation.setEmulatedMedia',{features:[]}) }
 }
})

test('1.5 capsule seam: white/blue composition, device, native menu hit targets and motion accessibility', async () => {
 for (const [w,h] of [[1440,900],[1024,768],[1024,600]]) {
  await navigate('/persona.html?persona=p3&hero=1',w,h)
  const scene=await evaluate(`(() => {
   const art=document.querySelector('.dsh-persona-art:not([hidden])');const hero=art.querySelector('.dsh-p3-submerge');
   const d=hero.getBoundingClientRect();const buttons=[...document.querySelectorAll('[data-cc-leaf]')].map(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e.contains(hit)});
   return {seam:getComputedStyle(art,'::before').backgroundImage,bg:getComputedStyle(art).backgroundImage,device:d.toJSON(),arrival:getComputedStyle(hero).animationName,buttons,
    nativeMoon:getComputedStyle(art.querySelector('.dsh-persona-phase')).display};
  })()`)
  assert.match(scene.seam,/svg|data:image/);assert.match(scene.bg,/radial-gradient/);assert.equal(scene.arrival,'p3-seam-arrive');assert.ok(scene.device.width>=140 && scene.device.width<=200);assert.ok(scene.buttons.every(Boolean),'all actual commands retain unobstructed native hit targets');assert.notEqual(scene.nativeMoon,'none')
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  try {
   const animations=await evaluate(`(() => {const root=document.querySelector('.dsh-persona-art:not([hidden])');return [...root.querySelectorAll('.dsh-p3-submerge,.dsh-p3-player,.dsh-p3-release,.dsh-p3-wake')].map(e=>getComputedStyle(e).animationName)})()`)
   assert.ok(animations.every(a=>a==='none'))
  } finally {await send('Emulation.setEmulatedMedia',{features:[]})}
 }
})

test('1.5.1 immersion moves the entire app under one full-viewport surface, then settles without replay while typing', async()=>{
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
 await send('Page.navigate',{url:`${base}/persona.html?persona=p3&long=1`})
 await waitFor("document.documentElement.getAttribute('data-p3-immersion')==='enter'")
 const entry=await evaluate(`(() => {const water=document.querySelector('.dsh-persona-immersion');const r=water.getBoundingClientRect();const f=document.querySelector('#frame');return {rect:r.toJSON(),parent:water.parentElement===document.body,whole:getComputedStyle(f).animationName,pointer:getComputedStyle(water).pointerEvents,all:['[data-sidebar-toggle]','[data-cc-leaf]','[data-composer-card]','.dsh-persona-wordmark','[data-conversation-content]'].every(s=>f.contains(document.querySelector(s)))}})()`)
 assert.equal(entry.rect.width,1440);assert.equal(entry.rect.height,900);assert.equal(entry.parent,true);assert.equal(entry.whole,'p3-world-descent');assert.equal(entry.pointer,'none');assert.equal(entry.all,true)
 await evaluate("document.querySelector('[data-composer-input]').dispatchEvent(new InputEvent('beforeinput',{bubbles:true,inputType:'insertText',data:'x'}))")
 assert.equal(await evaluate("document.documentElement.getAttribute('data-p3-immersion')"),'settled')
 assert.equal(await evaluate("!!document.querySelector('.dsh-persona-immersion')"),false)
 await evaluate("document.querySelector('[data-conversation-content]').setAttribute('data-conversation-session','next');document.querySelector('[data-composer-input]').focus()")
 await send('Input.insertText',{text:' steady draft'})
 assert.equal(await evaluate("document.documentElement.getAttribute('data-p3-immersion')"),'settled')
 assert.equal(await evaluate("getComputedStyle(document.querySelector('#frame')).transform"),'none')
 assert.equal(await evaluate("document.querySelector('[data-composer-input]').textContent.includes('steady draft')"),true)
})

test('1.5.2 narrow title margin: all native navigation/index/compact controls are blue-side and reading gains real width', async()=>{
 for(const [w,h] of [[1440,900],[1024,768],[1024,600]]) {
  await navigate('/persona.html?persona=p3&long=1',w,h)
  const read=()=>evaluate(`(() => {const art=document.querySelector('.dsh-persona-art:not([hidden])');const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {margin:parseFloat(getComputedStyle(art,'::before').width),stage:rect('[data-phase]'),index:rect('[class$="_regionArea"]'),nav:[...document.querySelectorAll('[data-cc-leaf]')].map(e=>e.getBoundingClientRect().toJSON()),brand:art.querySelector('.dsh-persona-wordmark').getBoundingClientRect().toJSON(),title:art.querySelector('.dsh-persona-session').getBoundingClientRect().toJSON(),fade:document.querySelector('[class$="_fade"]')?getComputedStyle(document.querySelector('[class$="_fade"]')).display:'none'}})()`)
  const a=await read();assert.ok(a.margin/w>=.08 && a.margin/w<=.13,JSON.stringify(a));assert.ok(a.index.x>w*.08 && a.index.width>=230 && a.index.width<=300,JSON.stringify(a));assert.ok(a.nav.every(r=>r.x>w*.08));assert.ok(a.stage.width>(w===1440?850:520),JSON.stringify(a));assert.ok(a.title.right<a.margin);assert.ok(a.brand.x>a.margin);assert.equal(a.fade,'none')
  await pointer('[data-sidebar-toggle]',true)
  const b=await read();assert.ok(b.stage.width>w*.73,JSON.stringify(b));assert.ok(b.brand.x>b.margin,JSON.stringify(b));const rail=await evaluate("document.querySelector('[class$=\"_panelList\"]').getBoundingClientRect().x");assert.ok(rail>w*.08)
 }
})


test('1.5.4 native polygon panels: straight text, status semantics, file actions and keyboard survive at 1440/1024',async()=>{
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 try {
  for(const [w,h] of [[1440,900],[1024,760]]) {
   await navigate('/persona.html?persona=p3&long=1&frames=1',w,h)
   const data=await evaluate(`(() => {
    const selected=document.querySelector('[data-row-key][aria-selected="true"]');const e=document.querySelector('[data-presented-file]');
    const dot=document.querySelector('.LOmM4q_turnErrorDot');const body=document.querySelector('[data-chat-flow-kind="assistant-step"] p');
    return {selected:getComputedStyle(selected,'::before').backgroundImage,row:getComputedStyle(selected).borderRadius,body:getComputedStyle(body).transform,file:getComputedStyle(e).borderRadius,
     files:document.querySelectorAll('[data-presented-file]').length,status:dot.dataset.state,statusRole:dot.parentElement.getAttribute('role'),grid:getComputedStyle(e.parentElement).gridTemplateColumns,
     duration:getComputedStyle(selected,'::before').transitionDuration,nav:[...document.querySelectorAll('[data-cc-leaf]')].map(e=>({scroll:e.scrollWidth,client:e.clientWidth}))};})()`)
   assert.match(data.selected,/Original broad selected P3 block/);assert.equal(data.row,'0px');assert.equal(data.body,'none');assert.equal(data.file,'0px');assert.equal(data.files,2);assert.equal(data.status,'error');assert.equal(data.statusRole,'status');assert.equal(data.grid.trim().split(' ').length,2);assert.equal(data.duration,'0s');assert.ok(data.nav.every(n=>n.scroll<=n.client+2))
   await evaluate(`(() => {const sc=document.querySelector('[data-conversation-scroll]'),e=document.querySelector('.LOmM4q_turnErrorRow');sc.scrollTop+=e.getBoundingClientRect().top-sc.getBoundingClientRect().top-10})()`)
   const hits=await evaluate(` [...document.querySelectorAll('[data-open-path-open],[data-open-path-more]')].map(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}) `)
   assert.ok(hits.every(Boolean),'file preview overlay must not steal native open/menu actions')
   await pointer('[data-open-path-more]',true)
   assert.ok((await evaluate('window.__frameAuditActions')).includes('更多打开方式'))
   await evaluate("document.querySelector('[data-open-path-open]').focus()")
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
   assert.equal(await evaluate("document.activeElement.hasAttribute('data-open-path-more')"),true)
   await evaluate("document.querySelector('.hSzSIW_header').scrollIntoView({block:'start'})")
   await pointer('.hSzSIW_header',true)
   assert.equal(await evaluate("document.querySelector('.hSzSIW_header').getAttribute('aria-expanded')"),'true')
  }
 } finally {await send('Emulation.setEmulatedMedia',{features:[]})}
})

test('1.5.4 popup/settings keep irregular P3 selections without transforming native content',async()=>{
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 try {
  await navigate('/persona.html?persona=p3&menu=1',1024,760)
  const menu=await evaluate(`(() => {const e=document.querySelector('[role="menuitem"][data-highlighted]')||document.querySelector('[role="menuitem"]');return {radius:getComputedStyle(e).borderRadius,transform:getComputedStyle(e).transform,height:e.getBoundingClientRect().height}})()`)
  assert.equal(menu.radius,'0px');assert.equal(menu.transform,'none');assert.ok(menu.height>=30)
  await navigate('/persona.html?persona=p3&settings=1',1024,600)
  const modal=await evaluate(`(() => {const e=document.querySelector('[data-shortcut-modal="settings"]');const r=e.getBoundingClientRect();const c=e.querySelector('select');const cr=c.getBoundingClientRect();return {radius:getComputedStyle(e).borderRadius,outline:getComputedStyle(e,'::before').content,inside:r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight,select:c.contains(document.elementFromPoint(cr.x+cr.width/2,cr.y+cr.height/2))}})()`)
  assert.equal(modal.radius,'0px');assert.equal(modal.outline,'"CONFIG"');assert.equal(modal.inside,true);assert.equal(modal.select,true)
 } finally {await send('Emulation.setEmulatedMedia',{features:[]})}
})


test('1.5.4 irregular planes are background-only; native frame text/actions/focus are never clipped or skewed',async()=>{
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 try {
  for(const [w,h] of [[1440,900],[1024,760],[1024,600]]) {
   await navigate('/persona.html?persona=p3&long=1&frames=1',w,h)
   const panels=await evaluate(`(() => {const pick=s=>{const e=document.querySelector(s),c=getComputedStyle(e),r=e.getBoundingClientRect();return {clip:c.clipPath,transform:c.transform,overflow:c.overflow,height:r.height,bg:getComputedStyle(e,['[data-composer-card]','[data-chat-flow-kind="tool-call"]'].includes(s)?'::after':'::before').backgroundImage,pointer:getComputedStyle(e,['[data-composer-card]','[data-chat-flow-kind="tool-call"]'].includes(s)?'::after':'::before').pointerEvents}};return {composer:pick('[data-composer-card]'),file:pick('[data-presented-file]'),tool:pick('[data-chat-flow-kind="tool-call"]'),body:getComputedStyle(document.querySelector('[data-chat-flow-kind="assistant-step"] p')).transform}})()`)
   for(const e of [panels.composer,panels.file,panels.tool]) {assert.equal(e.clip,'none');assert.equal(e.transform,'none');assert.equal(e.overflow,'visible');assert.equal(e.pointer,'none')}
   assert.match(panels.composer.bg,/Original P3 irregular quadrilateral/);assert.match(panels.file.bg,/Original P3 irregular quadrilateral/);assert.ok(panels.composer.height>=150);assert.ok(panels.file.height>=108);assert.equal(panels.body,'none')
   await evaluate("document.querySelector('[data-composer-input]').focus()")
   await send('Input.insertText',{text:' polygon focus check'})
   assert.equal(await evaluate("document.querySelector('[data-composer-input]').textContent.includes('polygon focus check')"),true)
  }
  await navigate('/persona.html?persona=p3&menu=1',1024,760)
  const menu=await evaluate(`(() => {const e=document.querySelector('#m-ctx'),c=getComputedStyle(e);return {bg:c.backgroundImage,clip:c.clipPath,transform:c.transform,position:c.position,blur:getComputedStyle(e.querySelector('[class*="_material_"]')).backdropFilter}})()`)
  assert.match(menu.bg,/Original P3 irregular quadrilateral/);assert.equal(menu.clip,'none');assert.equal(menu.transform,'none');assert.equal(menu.position,'fixed');assert.equal(menu.blur,'none')
 } finally {await send('Emulation.setEmulatedMedia',{features:[]})}
})


test('1.5.5 coastal environment spans the blue scene, keeps native hit targets, and stays absent in P4/P5',async()=>{
 for(const [w,h] of [[1440,900],[1024,600]]) {
  await navigate('/persona.html?persona=p3&long=1',w,h)
  const check=await evaluate(`(()=>{const e=document.querySelector('.dsh-persona-art:not([hidden]) .dsh-p3-environment'),r=e.getBoundingClientRect(),a=e.closest('.dsh-persona-art'),input=document.querySelector('[data-composer-input]'),i=input.getBoundingClientRect();return {left:r.left,width:r.width,height:r.height,hidden:a.getAttribute('aria-hidden'),pointer:getComputedStyle(e).pointerEvents,clip:getComputedStyle(input).clipPath,hit:input.contains(document.elementFromPoint(i.x+i.width/2,i.y+i.height/2)),anim:getComputedStyle(e.querySelector('.dsh-p3-outside')).animationName}})()`)
  assert.ok(check.left>=w*.08&&check.left<=w*.13);assert.ok(check.width>w*.86);assert.ok(check.height>h*.85);assert.equal(check.hidden,'true');assert.equal(check.pointer,'none');assert.equal(check.clip,'none');assert.equal(check.hit,true);assert.equal(check.anim,'p3-coastal-commute')
  await pointer('[data-sidebar-toggle]',true)
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.dsh-persona-art:not([hidden]) .dsh-p3-environment')).display"),'block')
 }
 for(const mode of ['p4','p5']) {
  await navigate('/persona.html?persona='+mode+'&long=1',1024,700)
  assert.equal(await evaluate("[...document.querySelectorAll('.dsh-p3-environment,.dsh-p3-disc')].every(e=>getComputedStyle(e).display==='none')"),true)
 }
})
test('1.5.5 reduced motion freezes coastal scenery and keeps complete final underwater composition',async()=>{
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 try {
  await navigate('/persona.html?persona=p3&hero=1',1440,900)
  const value=await evaluate(`(()=>{const a=document.querySelector('.dsh-persona-art:not([hidden])');return {entry:document.documentElement.dataset.p3Immersion,motion:[...a.querySelectorAll('.dsh-p3-outside,.dsh-p3-glass,.dsh-p3-disc')].map(e=>({name:getComputedStyle(e).animationName,transform:getComputedStyle(e).transform})),image:getComputedStyle(a.querySelector('.dsh-p3-carriage')).backgroundImage}})()`)
  assert.notEqual(value.entry,'enter');assert.ok(value.motion.every(v=>v.name==='none'&&v.transform==='none'));assert.match(value.image,/Original empty carriage/)
 } finally {await send('Emulation.setEmulatedMedia',{features:[]})}
})


test('1.5.6 moon is outside panes, surface spans viewport and secondary record controls remain native at both widths',async()=>{
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 try {
  for(const w of [1440,1024]) {
   await navigate('/persona.html?persona=p3&secondary=plugins',w,760)
   await waitFor("!!document.querySelector('[data-p3-secondary] .dsh-p3-record-page')")
   const value=await evaluate(`(()=>{const art=document.querySelector('.dsh-persona-art:not([hidden])'),moon=art.querySelector('.dsh-p3-window-moon'),surface=art.querySelector('.dsh-p3-surface'),m=moon.getBoundingClientRect(),s=surface.getBoundingClientRect(),input=document.querySelector('[data-p3-secondary] input'),r=input.getBoundingClientRect();return {moon:m.width,surface:s.width,top:s.top,caption:parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dsh-windows-titlebar-height"))||0,order:moon.nextElementSibling.className,record:document.querySelector('.dsh-p3-record-page').getAttribute('aria-hidden'),hit:input.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),motion:getComputedStyle(moon).animationName,body:getComputedStyle(input).transform}})()`)
   assert.ok(value.moon>=140);assert.ok(value.surface>=w);assert.ok(value.top>=value.caption-3&&value.top<value.caption+5);assert.equal(value.order,'dsh-p3-outside');assert.equal(value.record,'true');assert.equal(value.hit,true);assert.equal(value.motion,'none');assert.equal(value.body,'none')
   await pointer('[data-cc-i="2"]',true)
   await waitFor("document.querySelector('[data-p3-secondary] h1').textContent.includes('AUTOMATION')")
   assert.equal(await evaluate("document.querySelectorAll('.dsh-p3-record-page').length"),1)
   const caption=await evaluate("document.querySelector('.dsh-p3-record-page').textContent");assert.match(caption,/AUTOMATION/)
  }
 }finally{await send('Emulation.setEmulatedMedia',{features:[]})}
})
test('1.5.6 editing and new content never replay route/whole-app entry; hidden page pauses decoration',async()=>{
 await navigate('/persona.html?persona=p3&long=1',1440,900)
 const key=await evaluate("document.querySelector('#frame').dataset.p3RouteMotion")
 await evaluate("document.querySelector('[data-composer-input]').focus()")
 await send('Input.insertText',{text:' steady composition'})
 assert.equal(await evaluate("document.querySelector('#frame').hasAttribute('data-p3-quiet')"),true)
 await evaluate("document.querySelector('#flows').append(document.createElement('p'))")
 assert.equal(await evaluate("document.querySelector('#frame').dataset.p3RouteMotion"),key)
 assert.notEqual(await evaluate("document.documentElement.dataset.p3Immersion"),'enter')
 await evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))")
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.dsh-persona-art:not([hidden]) .dsh-p3-window-moon')).animationPlayState"),'paused')
 await evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
})


test('1.5.7 confirmed native page/workspace switches create one whole-viewport splash; repeat/folder/stream do not',async()=>{
 await navigate('/persona.html?persona=p3&long=1',1440,900)
 const seq=()=>evaluate("Number(document.querySelector('.dsh-p3-route-splash').dataset.sequence||0)")
 assert.equal(await seq(),0)
 await pointer('[data-cc-i="1"]',true);assert.equal(await seq(),1)
 const full=await evaluate(`(()=>{const e=document.querySelector('.dsh-p3-route-splash'),r=e.getBoundingClientRect();return {width:r.width,height:r.height,pointer:getComputedStyle(e).pointerEvents,hidden:e.getAttribute('aria-hidden'),kind:e.dataset.kind}})()`)
 assert.equal(full.width,1440);assert.equal(full.height,900);assert.equal(full.pointer,'none');assert.equal(full.hidden,'true');assert.equal(full.kind,'page')
 await evaluate('new Promise(r=>setTimeout(r,1200))');await pointer('[data-cc-i="1"]',true);assert.equal(await seq(),1)
 await pointer('[data-row-key="session:other-workspace"]',true);assert.equal(await seq(),2)
 assert.equal(await evaluate("document.querySelector('.dsh-p3-route-splash').dataset.kind"),'workspace')
 assert.equal(await evaluate("document.querySelector('[data-conversation-content]').getAttribute('data-conversation-session')"),'other-workspace')
 await evaluate('new Promise(r=>setTimeout(r,1200))');await pointer('[data-row-key="session:other-workspace"]',true);assert.equal(await seq(),2)
 await pointer('[data-row-key="workspace:stst"]',true);await evaluate("document.querySelector('#flows').append(document.createElement('p'))");await evaluate('new Promise(r=>setTimeout(r,100))');assert.equal(await seq(),2)
})
test('1.5.7 rapid changes coalesce, native input cancels wake and compact/keyboard navigation remain usable',async()=>{
 await navigate('/persona.html?persona=p3&long=1',1024,760)
 await evaluate("window.__p3ShowSecondary('plugins');window.__p3ShowSecondary('automation')")
 await evaluate('new Promise(r=>setTimeout(r,100))');assert.equal(await evaluate("document.querySelector('.dsh-p3-route-splash').dataset.sequence"),'1')
 await evaluate('new Promise(r=>setTimeout(r,1200))');await pointer('[data-row-key="session:demo-2"]',true)
 await evaluate("document.querySelector('[data-composer-input]').focus()")
 await send('Input.insertText',{text:' cancel water while typing'})
 assert.equal(await evaluate("document.querySelector('.dsh-p3-route-splash').hidden"),true)
 assert.equal(await evaluate("document.querySelector('[data-composer-input]').textContent.includes('cancel water while typing')"),true)
 await pointer('[data-sidebar-toggle]',true);assert.ok(await evaluate("document.querySelector('[data-composer-input]').getBoundingClientRect().width>650"))
})
test('1.5.7 reduced motion suppresses route effects while native secondary and session binding changes still complete',async()=>{
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 try {
  await navigate('/persona.html?persona=p3&long=1',1024,760)
  await pointer('[data-cc-i="1"]',true);await pointer('[data-row-key="session:demo-2"]',true)
  assert.equal(await evaluate("document.querySelector('.dsh-p3-route-splash').hidden"),true)
  assert.equal(await evaluate("document.querySelector('[data-conversation-content]').dataset.conversationSession"),'demo-2')
  await evaluate("document.querySelector('[data-row-key=\"session:demo-3\"]').focus()")
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
  assert.equal(await evaluate("document.querySelector('[data-conversation-content]').dataset.conversationSession"),'demo-3')
 }finally{await send('Emulation.setEmulatedMedia',{features:[]})}
})

test('rc3 real host structure: navigation never overlaps workspace or main at screenshot, wide and short sizes',async()=>{
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 for(const [w,h] of [[1024,657],[1440,900],[1024,500]]){
  await navigate('/native-rc3.html?persona=p3',w,h)
  const r=await evaluate(`(()=>{let box=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,r:r.right,b:r.bottom,w:r.width,h:r.height}},main=box(document.querySelector('[class$="_centerCol"]')),region=box(document.querySelector('.wtg9ga_regionArea')),nav=[...document.querySelectorAll('.wtg9ga_newSession,.wtg9ga_panelRow')].map(box);return {main,region,nav,labels:[...document.querySelectorAll('[data-cc-label]')].map(e=>e.dataset.ccLabel),echo:document.querySelector('.dsh-persona-art:not([hidden]) .dsh-persona-session').textContent}})()`)
  assert.equal(r.nav.length,4);assert.ok(!/ctrl|control/i.test(r.echo));assert.equal(r.labels[0],'新会话')
  for(const n of r.nav){assert.ok(n.x>=0&&n.r<=r.main.x+1,JSON.stringify(r));assert.ok(n.b<=r.region.y+1,JSON.stringify(r));assert.ok(n.w>=140&&n.h>=28)}
  for(let i=1;i<r.nav.length;i++)assert.ok(r.nav[i].y>=r.nav[i-1].b-1)
 }
})
test('rc3 native landing/chat: stacked headline, readable badge and bounded real composer/scrollport',async()=>{
 for(const q of ['', '&english=1','&chat=1']){
  await navigate('/native-rc3.html?persona=p3'+q,1024,657)
  const r=await evaluate(`(()=>{const box=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,r:r.right,b:r.bottom}},main=box(document.querySelector('[class$="_centerCol"]')),scroll=box(document.querySelector('[data-conversation-scroll]')),card=box(document.querySelector('[data-composer-card]')),group=document.querySelector('[data-cc-hero-group]');return {main,scroll,card,group:group?getComputedStyle(group).flexDirection:null,badge:group?.querySelector('[data-cc-hero-tag]')?.textContent}})()`)
  assert.ok(r.scroll.b<=r.main.b+1,JSON.stringify(r));assert.ok(r.card.x>=r.main.x&&r.card.r<=r.main.r&&r.card.b<=657,JSON.stringify(r));if(q!=='&chat=1'){assert.equal(r.group,'column');assert.equal(r.badge,'Preview')}
 }
})
test('rc3 native commands remain clickable through compact, secondary page and menu state',async()=>{
 await navigate('/native-rc3.html?persona=p3',1024,657)
 for(const selector of ['.wtg9ga_newSession','.wtg9ga_panelEntry .wtg9ga_panelRow','.wtg9ga_moreAnchor button']){
  assert.equal(await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit)})()`),true)
  await pointer(selector,true)
 }
 assert.ok(await evaluate('window.__nativeLog.length>=3'));assert.ok(await evaluate('!!document.querySelector("#nativePopup [role=menuitem]")'))
 await waitFor('getComputedStyle(document.querySelector(".wtg9ga_moreAnchor button .wtg9ga_panelTitle")).color === "rgb(204, 8, 55)"')
 await navigate('/native-rc3.html?persona=p3&compact=1',1024,657)
 assert.equal(await evaluate('document.querySelector("#frame").getAttribute("data-p3-native-layout")'),'rc3')
 assert.equal(await evaluate(`(()=>{let nav=[...document.querySelectorAll('.wtg9ga_newSession,.wtg9ga_panelRow')];return nav.every(e=>{let r=e.getBoundingClientRect();return r.width>=28&&r.height>=28&&r.y>=40&&r.bottom<=657})})()`),true)
 await send('Emulation.setEmulatedMedia',{features:[]})
})

test('1.6.0 P4 overhaul: glasses/tuner seam, Inaba golden-hour & Midnight Channel environment, immersion, broadcast page, route splash and rc3 layout',async()=>{
 await navigate('/persona.html?persona=p4&long=1&frames=1',1440,900)
 const entry=await evaluate(`(()=>{const root=document.documentElement,imm=document.querySelector('.dsh-persona-p4-immersion'),art=document.querySelector('.dsh-persona-art:not([hidden])'),chrome=document.querySelector('.dsh-persona-p4-chrome[data-on]'),phase=document.querySelector('[data-phase]');return {immersion:root.dataset.p4Immersion,caption:root.hasAttribute('data-cc-caption'),hasChrome:!!chrome,hostHidden:getComputedStyle(document.querySelector('[data-windows-menu]')).display==='none'&&getComputedStyle(document.querySelector('[data-industrial-caption-fallback]')).display==='none',menus:chrome?.querySelectorAll('.dsh-cc-menu').length||0,wins:chrome?.querySelectorAll('.dsh-cc-win').length||0,crtBezel:parseFloat(getComputedStyle(phase).borderBottomWidth)||0,hasImm:!!imm,glasses:art.querySelector('.dsh-p4-glasses-seam')?.getBoundingClientRect().width||0,tuner:art.querySelector('.dsh-p4-tuner-seam')?.getBoundingClientRect().width||0,sun:art.querySelector('.dsh-p4-portal-sun')?.getBoundingClientRect().width||0,inaba:art.querySelector('.dsh-p4-inaba')?.getBoundingClientRect().height||0,frameBg:getComputedStyle(document.querySelector('[data-presented-file]'),'::before').backgroundImage,titleTf:getComputedStyle(document.querySelector('[data-chat-flow-kind="assistant-step"] p')).transform}})()`)
 assert.equal(entry.immersion,'settled')
 assert.equal(entry.caption,true)
 assert.equal(entry.hasChrome,true)
 assert.equal(entry.hostHidden,true)
 assert.equal(entry.menus,2)
 assert.equal(entry.wins,3)
 assert.ok(entry.crtBezel>=28)
 assert.ok(entry.glasses>=100)
 assert.ok(entry.tuner>=50)
 assert.ok(entry.sun>=180)
 assert.ok(entry.inaba>=100)
 assert.match(entry.frameBg,/data:image\/svg\+xml/)
 assert.equal(entry.titleTf,'none')
 await evaluate("document.querySelector('[data-composer-input]').focus()")
 await send('Input.insertText',{text:' seek truth'})
 assert.equal(await evaluate("document.documentElement.dataset.p4Immersion"),'settled')
 assert.equal(await evaluate("document.querySelector('#frame').hasAttribute('data-p4-quiet')"),true)
 await shot('p4-chat-1440')
 await pointer('[data-sidebar-toggle]',true)
 assert.equal(await evaluate("document.querySelector('#frame').hasAttribute('data-sidebar-collapsed')"),true)
 await shot('p4-collapsed-1440')
 await pointer('[data-sidebar-toggle]',true)
 assert.equal(await evaluate("document.querySelector('#frame').hasAttribute('data-sidebar-collapsed')"),false)
 await evaluate('new Promise(r=>setTimeout(r,950))')
 await pointer('[data-cc-i="1"]',true)
 assert.equal(await evaluate("document.querySelector('.dsh-p4-route-splash').dataset.sequence"),'1')
 assert.equal(await evaluate("document.querySelector('.dsh-p4-route-splash').dataset.kind"),'page')
 await navigate('/persona.html?persona=p4&secondary=plugins',1440,760)
 await waitFor("!!document.querySelector('[data-p4-secondary] .dsh-p4-broadcast-page')")
 const bcast=await evaluate("document.querySelector('.dsh-p4-broadcast-page').textContent")
 assert.match(bcast,/PLUGINS/)
 await shot('p4-secondary-plugins')
 await navigate('/native-rc3.html?persona=p4',1024,657)
 const rc3=await evaluate(`(()=>{let box=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,r:r.right,b:r.bottom,w:r.width,h:r.height}},main=box(document.querySelector('[class$="_centerCol"]')),region=box(document.querySelector('.wtg9ga_regionArea')),nav=[...document.querySelectorAll('.wtg9ga_newSession,.wtg9ga_panelRow')].map(box);return {layout:document.querySelector('#frame').getAttribute('data-p4-native-layout'),nav,main,region,labels:[...document.querySelectorAll('[data-cc-label]')].map(e=>e.dataset.ccLabel)}})()`)
 assert.equal(rc3.layout,'rc3')
 assert.equal(rc3.nav.length,4)
 assert.equal(rc3.labels[0],'新会话')
 for(const n of rc3.nav){assert.ok(n.x>=0&&n.r<=rc3.main.x+1);assert.ok(n.b<=rc3.region.y+1)}
 await shot('p4-rc3-landing')
 await navigate('/persona.html?persona=p4&settings=1',1024,657)
 await shot('p4-settings-1024')
 await navigate('/persona.html?persona=p3&long=1',1440,760)
 await evaluate("document.querySelector('[data-composer-input]').focus()")
 await send('Input.insertText',{text:' dive deep'})
 await shot('p3-chat-1440')
 await navigate('/native-rc3.html?persona=p3',1024,657)
 await shot('p3-rc3-landing')
})

test('1.5.10 P3R overhaul: fast diagonal shard immersion (<1s), shard route cut, untangled seam, feathered composer and collapsed rail',async()=>{
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:760,deviceScaleFactor:1,mobile:false})
 try {
  await send('Page.navigate',{url:`${base}/persona.html?persona=p3&long=1`})
  await waitFor("document.documentElement.getAttribute('data-p3-immersion')==='enter'")
  await evaluate('new Promise(r=>setTimeout(r,210))')
  const entry=await evaluate(`(()=>{const imm=document.querySelector('.dsh-persona-immersion'),f=document.querySelector('#frame'),shard=imm?.querySelector('.dsh-p3-entry-shard--cyan'),sonar=imm?.querySelector('.dsh-p3-entry-sonar');return {hasImm:!!imm,hasShard:!!shard,hasSonar:!!sonar,dur:parseFloat(getComputedStyle(f).animationDuration)||0,anim:getComputedStyle(f).animationName}})()`)
  assert.equal(entry.hasImm,true);assert.equal(entry.hasShard,true);assert.equal(entry.hasSonar,true)
  assert.equal(entry.anim,'p3-world-descent');assert.ok(entry.dur>0&&entry.dur<1.0,JSON.stringify(entry))
  await shot('p3-entry-mid')
  await waitFor("document.documentElement.getAttribute('data-p3-immersion')==='settled'")
  const settled=await evaluate(`(()=>{const art=document.querySelector('.dsh-persona-art:not([hidden])'),sub=art.querySelector('.dsh-p3-submerge').getBoundingClientRect(),head=art.querySelector('.dsh-p3-headphones-seam').getBoundingClientRect(),seat=document.querySelector('[data-composer-seat]'),card=document.querySelector('[data-composer-card]');card.querySelector('[data-composer-input]')?.focus();return {subB:sub.bottom,headT:head.top,seatBg:getComputedStyle(seat).backgroundImage,outline:getComputedStyle(card).outlineWidth}})()`)
  assert.ok(settled.subB<=settled.headT+4,JSON.stringify(settled))
  assert.match(settled.seatBg,/linear-gradient/);assert.equal(settled.outline,'0px')
  await pointer('[data-cc-i="1"]',true)
  await evaluate('new Promise(r=>setTimeout(r,140))')
  const midSplash=await evaluate(`(()=>{const s=document.querySelector('.dsh-p3-route-splash'),art=document.querySelector('.dsh-persona-art:not([hidden])');return {active:document.documentElement.hasAttribute('data-p3-route-active'),hidden:s.hidden,cyan:!!s.querySelector('.dsh-p3-route-shard-cyan'),rings:!!s.querySelector('.dsh-p3-route-rings'),subOpacity:parseFloat(getComputedStyle(art.querySelector('.dsh-p3-submerge')).opacity),headOpacity:parseFloat(getComputedStyle(art.querySelector('.dsh-p3-headphones-seam')).opacity)}})()`)
  assert.equal(midSplash.active,true);assert.equal(midSplash.hidden,false);assert.equal(midSplash.cyan,true);assert.equal(midSplash.rings,true)
  assert.ok(midSplash.subOpacity>0.9);assert.ok(midSplash.headOpacity>0.85)
  await shot('p3-splash-mid')
  await evaluate('new Promise(r=>setTimeout(r,600))')
  assert.equal(await evaluate("document.querySelector('.dsh-p3-route-splash').hidden"),true)
  await navigate('/persona.html?persona=p3&secondary=plugins',1440,760)
  await waitFor("!!document.querySelector('[data-p3-secondary] .dsh-p3-record-page')")
  await shot('p3-secondary-plugins')
  await navigate('/persona.html?persona=p3&long=1',1440,760)
  await pointer('[data-sidebar-toggle]',true)
  await evaluate('new Promise(r=>setTimeout(r,200))')
  await shot('p3-collapsed-1440')
 } finally { await send('Emulation.clearDeviceMetricsOverride') }
})

test('1.6.1 P5 Calling Card secondary menus: Settings modal, sub-controls, Plugins & Automation pages',async()=>{
 await navigate('/persona.html?persona=p5&settings=1',1440,900)
 await waitFor("!!document.querySelector('[data-shortcut-modal=\"settings\"]')")
 const st=await evaluate(`(()=>{const root=document.documentElement,modal=document.querySelector('[data-shortcut-modal="settings"]'),mr=modal.getBoundingClientRect(),navActive=modal.querySelector('.AnXs9G_active'),cubeSel=modal.querySelector('.Iwzhua_selected'),sel=modal.querySelector('select#st-skin'),sr=sel.getBoundingClientRect(),cfg=modal.querySelector('.AnXs9G_actions button'),close=modal.querySelector('.AnXs9G_close'),sw=modal.querySelector('[role="switch"]'),stepper=modal.querySelector('._7qxJPq_stepper');return {skin:root.hasAttribute('data-dsh-calling-card-skin'),p3:root.hasAttribute('data-p3-immersion'),p4:root.hasAttribute('data-p4-immersion'),inside:mr.x>=0&&mr.right<=innerWidth&&mr.y>=0&&mr.bottom<=innerHeight,modalRadius:getComputedStyle(modal).borderRadius,navBg:getComputedStyle(navActive).backgroundColor,navRot:getComputedStyle(navActive).rotate,cubeBg:getComputedStyle(cubeSel).backgroundColor,cubeRadius:getComputedStyle(cubeSel).borderRadius,selRadius:getComputedStyle(sel).borderRadius,selHit:sel.contains(document.elementFromPoint(sr.x+sr.width/2,sr.y+sr.height/2)),cfgText:cfg.textContent.trim(),closeBg:getComputedStyle(close).backgroundColor,swRadius:getComputedStyle(sw).borderRadius,swBg:getComputedStyle(sw).backgroundColor,stepperRadius:getComputedStyle(stepper).borderRadius}})()`)
 assert.equal(st.skin,true);assert.equal(st.p3,false);assert.equal(st.p4,false);assert.equal(st.inside,true)
 assert.equal(st.modalRadius,'0px');assert.equal(st.cubeRadius,'0px');assert.equal(st.selRadius,'0px');assert.equal(st.swRadius,'0px');assert.equal(st.stepperRadius,'0px')
 assert.equal(st.selHit,true);assert.equal(st.cfgText,'打开配置文件')
 assert.equal(st.navBg,'rgb(230, 0, 18)');assert.equal(st.cubeBg,'rgb(230, 0, 18)');assert.equal(st.closeBg,'rgb(230, 0, 18)');assert.equal(st.swBg,'rgb(230, 0, 18)')
 await shot('p5-settings-1440')
 await pointer('.Iwzhua_themeCube:first-child',true)
 const afterCube=await evaluate("({active:document.querySelector('.Iwzhua_themeCube:first-child').classList.contains('Iwzhua_selected'),bg:getComputedStyle(document.querySelector('.Iwzhua_themeCube:first-child')).backgroundColor})")
 assert.equal(afterCube.active,true);assert.equal(afterCube.bg,'rgb(230, 0, 18)')
 await navigate('/persona.html?persona=p5&secondary=plugins',1440,900)
 await waitFor("document.querySelector('#center')?.getAttribute('data-secondary-fixture')==='plugins'")
 await waitFor("!document.querySelector('.dsh-cc-transition.is-on')")
 const plug=await evaluate(`(()=>{const card=document.querySelector('#center [data-plugin-package]'),btn=document.querySelector('#center .fixture-secondary-toolbar button'),inp=document.querySelector('#center .fixture-secondary-toolbar input'),deck=document.querySelector('#sideRoot').getBoundingClientRect(),center=document.querySelector('#center').getBoundingClientRect();return {cardRadius:getComputedStyle(card).borderRadius,cardBg:getComputedStyle(card).backgroundColor,btnBg:getComputedStyle(btn).backgroundColor,btnRadius:getComputedStyle(btn).borderRadius,inpRadius:getComputedStyle(inp).borderRadius,rightOfDeck:center.x>=deck.right-2}})()`)
 assert.equal(plug.cardRadius,'0px');assert.equal(plug.btnRadius,'0px');assert.equal(plug.inpRadius,'0px');assert.equal(plug.btnBg,'rgb(230, 0, 18)');assert.equal(plug.rightOfDeck,true)
 await shot('p5-secondary-plugins')
 await navigate('/persona.html?persona=p5&secondary=automation',1440,900)
 await waitFor("document.querySelector('#center')?.getAttribute('data-secondary-fixture')==='automation'")
 const auto=await evaluate("({count:document.querySelectorAll('#center [data-fixture-automation]').length,radius:getComputedStyle(document.querySelector('#center [data-fixture-automation]')).borderRadius})")
 assert.equal(auto.count,3);assert.equal(auto.radius,'0px')
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 try {
  await navigate('/persona.html?persona=p5&settings=1',1440,900)
  await waitFor("!!document.querySelector('[data-shortcut-modal=\"settings\"]')")
  const red=await evaluate("({anim:getComputedStyle(document.querySelector('[data-shortcut-modal=\"settings\"]')).animationName,navRot:getComputedStyle(document.querySelector('[data-shortcut-modal=\"settings\"] .AnXs9G_active')).rotate})")
  assert.equal(red.anim,'none');assert.equal(red.navRot,'none')
 } finally { await send('Emulation.setEmulatedMedia',{features:[]}) }
})

test('1.6.2 P3 & P4 secondary menus match P5 spec: crisp theme cubes, config controls, switches & sub-controls',async()=>{
 for(const mode of ['p3','p4']){
  await navigate(`/persona.html?persona=${mode}&settings=1`,1024,657)
  await waitFor("!!document.querySelector('[data-shortcut-modal=\"settings\"]')")
  const st=await evaluate(`(()=>{const modal=document.querySelector('[data-shortcut-modal="settings"]'),mr=modal.getBoundingClientRect(),navAct=modal.querySelector('.AnXs9G_active'),cubeSel=modal.querySelector('.Iwzhua_selected'),cubeIdle=modal.querySelector('.Iwzhua_themeCube:not(.Iwzhua_selected)'),cfg=modal.querySelector('.AnXs9G_actions button'),close=modal.querySelector('.AnXs9G_close'),sw=modal.querySelector('[role="switch"]'),stepper=modal.querySelector('._7qxJPq_stepper'),sel=modal.querySelector('select#st-skin'),sr=sel.getBoundingClientRect();return {inside:mr.x>=0&&mr.right<=innerWidth&&mr.y>=0&&mr.bottom<=innerHeight,modalRadius:getComputedStyle(modal).borderRadius,navColor:getComputedStyle(navAct).color,navBg:getComputedStyle(navAct).backgroundColor,cubeSelBg:getComputedStyle(cubeSel).backgroundColor,cubeSelColor:getComputedStyle(cubeSel).color,cubeSelRadius:getComputedStyle(cubeSel).borderRadius,cubeIdleBg:getComputedStyle(cubeIdle).backgroundColor,cfgRadius:getComputedStyle(cfg).borderRadius,cfgText:cfg.textContent.trim(),closeRadius:getComputedStyle(close).borderRadius,swRadius:getComputedStyle(sw).borderRadius,swBg:getComputedStyle(sw).backgroundColor,stepperRadius:getComputedStyle(stepper).borderRadius,selRadius:getComputedStyle(sel).borderRadius,selHit:sel.contains(document.elementFromPoint(sr.x+sr.width/2,sr.y+sr.height/2))}})()`)
  assert.equal(st.inside,true,JSON.stringify(st))
  assert.equal(st.modalRadius,'0px');assert.equal(st.cubeSelRadius,'0px');assert.equal(st.cfgRadius,'0px');assert.equal(st.closeRadius,'0px');assert.equal(st.swRadius,'0px');assert.equal(st.stepperRadius,'0px');assert.equal(st.selRadius,'0px')
  assert.equal(st.cfgText,'打开配置文件');assert.equal(st.selHit,true)
  assert.notEqual(st.cubeSelBg,st.cubeIdleBg)
  if(mode==='p3'){
   assert.equal(st.navColor,'rgb(164, 14, 64)')
   assert.equal(st.cubeSelColor,'rgb(204, 8, 55)')
   assert.equal(st.swBg,'rgb(244, 255, 255)')
   await shot('p3-settings-1024')
  }else{
   assert.equal(st.navBg,'rgb(255, 230, 0)')
   assert.equal(st.cubeSelBg,'rgb(255, 230, 0)')
   assert.equal(st.swBg,'rgb(255, 230, 0)')
   await shot('p4-settings-1024')
  }
 }
})
