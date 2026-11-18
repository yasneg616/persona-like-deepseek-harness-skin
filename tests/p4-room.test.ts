import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { deskCamera, hashIndex, matrixCss, quadDeviation, quadMatrix, screenMargins, type Quad } from '../src/client/p4-room/projector.ts'
import { createP4Room, findScreen, readMode, readSessionRows, roomWords } from '../src/client/p4-room/controller.ts'
import { P4_ROOM_CSS } from '../src/client/p4-room/style.ts'

const apply = (m: number[], x: number, y: number) => {
  const w = m[3] * x + m[7] * y + m[15]
  return { x: (m[0] * x + m[4] * y + m[12]) / w, y: (m[1] * x + m[5] * y + m[13]) / w }
}

test('P4 room: the conversation rect maps exactly onto any screen quad', () => {
  const w = 800, h = 600
  const identity: Quad = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
  const id = quadMatrix(w, h, identity)!
  assert.deepEqual(id.map(v => +v.toFixed(9)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  assert.equal(quadDeviation(w, h, identity), 0)
  const keystone: Quad = [{ x: 310, y: 120 }, { x: 402, y: 131 }, { x: 398, y: 205 }, { x: 306, y: 199 }]
  const m = quadMatrix(w, h, keystone)!
  for (const [i, [x, y]] of ([[0, 0], [w, 0], [w, h], [0, h]] as const).entries()) {
    const p = apply(m, x, y)
    assert.ok(Math.abs(p.x - keystone[i].x) < 1e-6 && Math.abs(p.y - keystone[i].y) < 1e-6, `corner ${i}`)
  }
  assert.match(matrixCss(m), /^matrix3d\(([-\d.e]+,){15}[-\d.e]+\)$/)
  assert.equal(quadMatrix(0, h, keystone), null)
  assert.equal(quadMatrix(w, h, [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]), null)
})

test('P4 room: the column becomes a centred 4:3 box that leaves the room visible around it', () => {
  for (const [cw, ch] of [[1160, 860], [700, 900], [1800, 700]]) {
    const { mx, my, w, h } = screenMargins(cw, ch)
    assert.ok(Math.abs(w / h - 4 / 3) < .01)
    assert.ok(w <= cw * .94 + 1 && h <= ch * .9 + 1)
    assert.ok(Math.abs(cw - 2 * mx - w) <= 1 && Math.abs(ch - 2 * my - h) <= 1)
  }
})

test('P4 room: the pushed-in camera puts the screen on the box, straight on', () => {
  const s = { x: -0.72, y: 0.755, z: -1.475 }
  const box = { left: 420, top: 70, width: 960, height: 720 }
  const { pos, tgt } = deskCamera(box, 1440, 900, 40, 0.33, s)
  assert.equal(tgt.x, pos.x); assert.equal(tgt.y, pos.y); assert.ok(tgt.z < pos.z)
  // project the screen centre through a pinhole with the same fov
  const f = 450 / Math.tan(20 * Math.PI / 180), d = pos.z - s.z
  const px = 720 + (s.x - pos.x) / d * f, py = 450 - (s.y - pos.y) / d * f
  assert.ok(Math.abs(px - (box.left + box.width / 2)) < 1e-6 && Math.abs(py - (box.top + box.height / 2)) < 1e-6)
  assert.ok(Math.abs(0.33 / d * f - box.height) < 1e-6)
})

test('P4 room: ambient hue follows the session id only', () => {
  assert.equal(hashIndex('session:a', 6), hashIndex('session:a', 6))
  const seen = new Set(Array.from({ length: 40 }, (_, i) => hashIndex('session:' + i, 6)))
  assert.ok(seen.size >= 5)
})

function fixture() {
  const dom = new JSDOM(`<!doctype html><html lang="zh-Hant" data-dsh-persona="p4"><body>
    <div id="frame"><div class="side"><button data-sidebar-toggle></button></div>
      <div id="center"><div data-phase="active"><div data-conversation-content data-conversation-session="s1" data-conversation-region="chat"><div data-conversation-scroll><div></div></div></div></div></div>
      <div class="dsh-persona-art"></div><div data-shell-overlay></div></div></body></html>`, { pretendToBeVisual: true })
  return dom
}

test('P4 room: picks the conversation column, never the sidebar or the art', () => {
  const { window } = fixture()
  const frame = window.document.getElementById('frame')!
  assert.equal(findScreen(frame)?.id, 'center')
})

test('P4 room: without WebGL the 2D P4 stays and nothing is touched', () => {
  const { window } = fixture()
  const doc = window.document, frame = doc.getElementById('frame')!, art = doc.querySelector<HTMLElement>('.dsh-persona-art')!
  let loaded = 0
  const room = createP4Room(doc, window as unknown as Window, frame, art, () => { loaded++; throw new Error('must not load three.js') })
  room.sync()
  assert.equal(loaded, 0)
  assert.equal(doc.documentElement.hasAttribute('data-p4-3d'), false)
  assert.equal(doc.querySelector('[data-p4-screen], .dsh-p4-room-gl, .dsh-p4-room-glass, .dsh-p4-room-hud'), null)
  room.dispose()
})

test('P4 room: styles are scoped to the 3D flag, keep native layout and honour no-motion by not mounting', () => {
  const rules = P4_ROOM_CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(r => r.trim()).filter(r => r && !r.startsWith('@keyframes') && !/^\d|^(from|to)\b|^\d+%/.test(r))
  for (const rule of rules) {
    const selector = rule.split('{')[0].trim()
    if (!selector || /^(from|to|\d)/.test(selector) || selector.startsWith('50%')) continue
    assert.ok(/data-p4-|^\.dsh-p4-/.test(selector), selector)
  }
  assert.doesNotMatch(P4_ROOM_CSS, /display:\s*none\s*!important[^}]*\[data-p4-screen\]\s*{/)
  assert.match(P4_ROOM_CSS, /\[data-p4-screen\][^{]*{[^}]*transform-origin: 0 0/)
})

test('P4 tower: conversations come from the sidebar rows (key, title, age, selection), not the chat', () => {
  const { window } = new JSDOM(`<div><div data-row-key="workspace:w"><span class="x_title">W</span></div>
    <div data-row-key="session:a" aria-selected="true"><span class="x_title">  修正 側欄 </span><span class="x_time">2分钟</span></div>
    <div data-row-key="session:b" class="x_sessionRow"><span class="x_title">B</span></div><main><p data-conversation-content>secret chat</p></main></div>`)
  const rows = readSessionRows(window.document)
  assert.deepEqual(rows, [{ key: 'session:a', title: '修正 側欄', time: '2分钟', selected: true }, { key: 'session:b', title: 'B', time: '', selected: false }])
  assert.ok(!JSON.stringify(rows).includes('secret'))
})

test('P4 tower: the scene choice defaults to the room and survives storage errors', () => {
  assert.equal(readMode({ localStorage: { getItem: () => null } } as unknown as Window), 'room')
  assert.equal(readMode({ localStorage: { getItem: () => 'tower' } } as unknown as Window), 'tower')
  assert.equal(readMode({ get localStorage() { throw new Error('blocked') } } as unknown as Window), 'room')
})

test('P4 room: every piece of furniture has a name plate and a line, in the app language', () => {
  const day = new Date(2026, 10, 18)
  for (const lang of ['zh-hant', 'zh-cn', 'en']) {
    const w = roomWords(lang, 0, day)
    for (const [k, [name, line]] of Object.entries(w)) assert.ok(name && line, `${lang} ${k}`)
  }
  assert.equal(roomWords('zh-tw', 0, day).calendar[1], '今天是 11 月 18 日（三）。')
  assert.match(roomWords('zh-cn', 3, day).table[1], /叠了 4 张/)
  assert.equal(roomWords('zh-hant', 0, day).wardrobe[0], '衣櫃')
})
