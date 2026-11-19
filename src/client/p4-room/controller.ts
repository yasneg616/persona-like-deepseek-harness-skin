import { hashIndex, matrixCss, quadDeviation, quadMatrix, screenMargins, type Box, type Quad } from './projector.ts'
import { P4_ROOM_CSS } from './style.ts'
import { sidebarColumn } from '../leaves.ts'
import { createWarp } from './warp.ts'

type SceneModule = typeof import('./scene.ts')
type TowerModule = typeof import('./tower.ts')
type RoomScene = import('./scene.ts').RoomScene
type TowerScene = import('./tower.ts').TowerScene
type V3 = { x: number; y: number; z: number }
type Frame = { c: V3; right: V3; normal: V3; w: number; h: number }

const STYLE_ID = 'dsh-calling-card-skin/p4-room.css'
const MODE_KEY = 'dsh-calling-card-skin:p4-mode'
export type P4Mode = 'room' | 'tower'

/** Is a real WebGL context available? (jsdom and blocked GPUs answer no → the 2D P4 stays.) */
export function webglAvailable(doc: Document): boolean {
  try {
    const c = doc.createElement('canvas')
    return !!(c.getContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch { return false }
}

/** Which frame child is the conversation column we lay onto the CRT. */
export function findScreen(frame: Element): HTMLElement | null {
  const kids = Array.from(frame.children) as HTMLElement[]
  const side = sidebarColumn(frame.ownerDocument)
  const usable = kids.filter(n => n !== side && !n.matches('[data-shell-overlay], .dsh-persona-art, .p3r-back, .dsh-p4-room-glass, .dsh-p4-tower-input, .dsh-p4-warp, .dsh-p4-slogan, [data-rightbar-col], [data-side]'))
  return usable.find(n => n.querySelector('[data-conversation-region], [data-conversation-content]'))
    ?? usable.find(n => n.matches('main, [role="main"]') || !!n.querySelector('main, [role="main"]'))
    ?? null
}

/** Conversations as listed by the host sidebar: key, title and age label (row chrome only, never chat text). */
export function readSessionRows(root: ParentNode) {
  const out: { key: string; title: string; time: string; selected: boolean; ws: string }[] = []
  let ws = ''
  for (const row of Array.from(root.querySelectorAll<HTMLElement>('[data-row-key^="workspace:"], [data-row-key^="session:"]'))) {
    const key = row.getAttribute('data-row-key')!
    if (key.startsWith('workspace:')) { ws = key; continue }
    out.push({
      key,
      title: (row.querySelector('[class*="_title"]')?.textContent || row.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
      time: (row.querySelector('[class*="_time"]')?.textContent || '').trim(),
      selected: row.getAttribute('aria-selected') === 'true' || /_selected\b/.test(row.className),
      ws,
    })
  }
  return out
}

export function readMode(win: Window): P4Mode {
  try { return win.localStorage.getItem(MODE_KEY) === 'tower' ? 'tower' : 'room' } catch { return 'room' }
}

type Thing = import('./scene.ts').RoomThing
/** Name plate + one line of flavour text per piece of furniture (no characters, original lines). */
export function roomWords(lang: string, papers: number, now = new Date()): Record<Thing, [string, string]> {
  const m = now.getMonth() + 1, d = now.getDate()
  const WD = '日一二三四五六'[now.getDay()]
  if (/^zh-(tw|hk|mo|hant)/.test(lang)) return {
    tv: ['電視', '點一下靠近一點看。'], window: ['窗戶', '雨一直下個不停……聽說這種晚上，午夜的電視會播出奇怪的節目。'],
    calendar: ['日曆', `今天是 ${m} 月 ${d} 日（${WD}）。`], poster: ['海報', 'DSH-TV 的宣傳海報。上面寫著「午夜零點」。'],
    wardrobe: ['衣櫃', '裡面掛著制服。明天也要上學。'], shelf: ['書架', '漫畫和參考書混在一起。'], rack: ['金屬架', '堆了一些雜物和舊遊戲盒。'],
    cabinet: ['電視櫃', '錄影機的時鐘一直閃著綠光。'], table: ['矮桌', papers ? `桌上的節目表疊了 ${papers + 1} 張……這集聊得真久。` : '桌上攤著今天的電視節目表。'],
    sofa: ['沙發', '坐起來還算舒服。從這裡剛好看得到電視。'] }
  if (lang.startsWith('zh')) return {
    tv: ['电视', '点一下靠近一点看。'], window: ['窗户', '雨一直下个不停……听说这种晚上，午夜的电视会播出奇怪的节目。'],
    calendar: ['日历', `今天是 ${m} 月 ${d} 日（${WD}）。`], poster: ['海报', 'DSH-TV 的宣传海报。上面写着「午夜零点」。'],
    wardrobe: ['衣柜', '里面挂着制服。明天也要上学。'], shelf: ['书架', '漫画和参考书混在一起。'], rack: ['金属架', '堆了一些杂物和旧游戏盒。'],
    cabinet: ['电视柜', '录像机的时钟一直闪着绿光。'], table: ['矮桌', papers ? `桌上的节目表叠了 ${papers + 1} 张……这集聊得真久。` : '桌上摊着今天的电视节目表。'],
    sofa: ['沙发', '坐起来还算舒服。从这里刚好看得到电视。'] }
  return {
    tv: ['TV', 'Click to take a closer look.'], window: ['Window', 'It just keeps raining... they say on nights like this the midnight channel shows strange things.'],
    calendar: ['Calendar', `Today is ${now.toLocaleDateString('en', { month: 'long', day: 'numeric', weekday: 'short' })}.`], poster: ['Poster', 'A DSH-TV poster. It says "Midnight · 00:00".'],
    wardrobe: ['Wardrobe', 'The school uniform hangs inside. School again tomorrow.'], shelf: ['Bookshelf', 'Manga and study guides, all mixed up.'], rack: ['Metal rack', 'Odds and ends and old game boxes.'],
    cabinet: ['TV stand', 'The VCR clock keeps blinking green.'], table: ['Low table', papers ? `${papers + 1} TV guides piled up... this episode is running long.` : "Today's TV guide is spread out on the table."],
    sofa: ['Sofa', 'Comfortable enough. You can see the TV from here.'] }
}

function labels(doc: Document) {
  const lang = doc.documentElement.lang.toLowerCase()
  if (/^zh-(tw|hk|mo|hant)/.test(lang)) return { room: '房間', tower: '電視塔', back: '退後看看房間', front: '回到電視前', orbit: '退後環視電視塔', mode: '場景', closed: '先在左邊展開這個工作區', entering: '調頻中' }
  if (lang.startsWith('zh')) return { room: '房间', tower: '电视塔', back: '退后看看房间', front: '回到电视前', orbit: '退后环视电视塔', mode: '场景', closed: '先在左边展开这个工作区', entering: '调频中' }
  return { room: 'Room', tower: 'TV tower', back: 'Step back', front: 'Back to the TV', orbit: 'Look around the tower', mode: 'Scene', closed: 'Open this workspace on the left first', entering: 'Tuning in' }
}

const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const pad = (n: number) => String(n).padStart(2, '0')
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k })
const ROOM_FOV = 40, ORBIT_FOV = 56

/**
 * P4 rainy-night room and TV-tower studio. Lives while the P4 persona is on, WebGL works and motion
 * is allowed; otherwise the 2D P4 stays. Native DOM, buttons and accessibility are untouched: the
 * conversation column only gets a 4:3 margin box and a CSS transform onto whichever TV is on screen.
 * The scenes react to the session id, the send button's [data-sending] state, the scroll height and
 * the sidebar rows' titles; chat content is never read.
 */
export function createP4Room(doc: Document, win: Window, frame: HTMLElement, art: HTMLElement, load: () => SceneModule, loadTower?: () => TowerModule) {
  const html = doc.documentElement
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)')
  let mounted: ReturnType<typeof mount> | null = null
  let failed = false

  let gl: boolean | null = null
  const wanted = () => /^p4g?$/.test(html.dataset.dshPersona ?? '') && !reduced?.matches && !failed && (gl ??= webglAvailable(doc))

  function mount() {
    const R = load()
    const style = doc.createElement('style'); style.dataset.pluginCss = STYLE_ID; style.textContent = P4_ROOM_CSS; doc.head.append(style)
    const canvas = doc.createElement('canvas'); canvas.className = 'dsh-p4-room-gl'; canvas.setAttribute('aria-hidden', 'true')
    const flash = doc.createElement('div'); flash.className = 'dsh-p4-room-flash'; flash.setAttribute('aria-hidden', 'true')
    art.prepend(canvas, flash)
    let room: RoomScene
    try { room = R.createRoomScene(canvas, doc) }
    catch (error) { canvas.remove(); flash.remove(); style.remove(); throw error }
    html.setAttribute('data-p4-3d', 'on')
    frame.setAttribute('data-p4-frame', '')
    const words = labels(doc)

    // screen glass (static, midnight, tune, lightning zap) follows the column's transform
    const glass = doc.createElement('div'); glass.className = 'dsh-p4-room-glass'; glass.setAttribute('aria-hidden', 'true')
    glass.innerHTML = '<i class="off"></i><i class="mc"></i><i class="tz"></i><i class="bar"></i>'
    {
      const n = doc.createElement('canvas'); n.width = n.height = 128; const cx = n.getContext('2d')
      if (cx) { const img = cx.createImageData(128, 128); for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255 } cx.putImageData(img, 0, 0); glass.style.setProperty('--p4-noise', `url(${n.toDataURL()})`) }
    }
    frame.append(glass)
    // drag / wheel / pick surface for the tower (under the native columns)
    const input = doc.createElement('div'); input.className = 'dsh-p4-tower-input'; input.setAttribute('aria-hidden', 'true')
    const back = frame.querySelector(':scope > .p3r-back, :scope > .dsh-persona-art')
    if (back) back.after(input); else frame.prepend(input)
    const tip = doc.createElement('div'); tip.className = 'dsh-p4-tower-tip'; tip.setAttribute('aria-hidden', 'true'); frame.append(tip)
    const plate = doc.createElement('div'); plate.className = 'dsh-p4-plate'; plate.setAttribute('aria-hidden', 'true'); frame.append(plate)
    const check = doc.createElement('div'); check.className = 'dsh-p4-check'; check.setAttribute('aria-hidden', 'true'); check.textContent = 'CHECK!!'; frame.append(check)
    const msg = doc.createElement('div'); msg.className = 'dsh-p4-msg'; msg.setAttribute('role', 'status'); msg.innerHTML = '<span class="who"></span><p></p>'; frame.append(msg)
    const slogan = doc.createElement('div'); slogan.className = 'dsh-p4-slogan'; slogan.setAttribute('aria-hidden', 'true')
    slogan.innerHTML = `<div class="band"><div class="y"><b>${'TUNING IN'.split('').map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</b></div><div class="k"></div></div>`
    frame.append(slogan)
    const warp = createWarp(doc, win, frame)

    // HUD: scene switch + step back / forward
    const hud = doc.createElement('div'); hud.className = 'dsh-p4-room-hud'
    hud.innerHTML = `<span class="mode" role="group" aria-label="${words.mode}"><button type="button" data-m="room">${words.room}</button><button type="button" data-m="tower">${words.tower}</button></span><button type="button" class="step"></button>`
    const stepBtn = hud.querySelector<HTMLButtonElement>('.step')!
    const overlay = () => frame.querySelector<HTMLElement>(':scope > [data-shell-overlay]')
    const placeHud = () => { const o = overlay(); if (o && hud.parentElement !== o) o.append(hud) }
    placeHud()
    let mode: P4Mode = readMode(win)
    const syncHud = () => {
      hud.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode)))
      stepBtn.textContent = view === 'desk' ? words.back : view === 'focus' ? words.orbit : words.front
    }

    // ---------- worlds and views ----------
    let world: 'room' | 'tower' = 'room'
    let view: 'room' | 'desk' | 'orbit' | 'focus' = 'room'
    let tower: TowerScene | null = null
    type Pose = { pos: V3; tgt: V3; fov: number }
    const cam: Pose = { pos: { x: 1.45, y: 2.05, z: 2.25 }, tgt: { x: -0.55, y: 0.62, z: -1.0 }, fov: ROOM_FOV }
    let tween: { from: Pose; to: () => Pose; via?: V3; start: number; dur: number; done?: () => void } | null = null
    const ORB = { yaw: 0, pitch: .14, r: 3.7, rt: 3.7, vy: 0, vp: 0 }
    const PMIN = -.12, PMAX = .72
    let screen: HTMLElement | null = null
    let box: Box | null = null
    let margins = { mx: 0, my: 0 }
    let focusKey = ''
    const roomPose = (): Pose => ({ pos: { ...R.ROOM_VIEW.pos }, tgt: { ...R.ROOM_VIEW.tgt }, fov: ROOM_FOV })
    const roomFrame = (): Frame => room.roomFrame()
    const currentFrame = (): Frame | null => world === 'room' ? roomFrame() : (tower && focusKey ? tower.frameOf(focusKey) : null)
    /** Straight-on camera that lands the frame's picture exactly on the column box. */
    const facePose = (f: Frame | null): Pose | null => {
      if (!f || !box) return null
      const t = Math.tan(ROOM_FOV * Math.PI / 360)
      const dist = (f.h / (2 * t)) * (cr.height / box.height), k = (2 * dist * t) / cr.height
      const ox = box.left - cr.left + box.width / 2 - cr.width / 2, oy = box.top - cr.top + box.height / 2 - cr.height / 2
      let pos = add(f.c, f.normal, dist); pos = add(pos, f.right, -ox * k); pos = add(pos, { x: 0, y: 1, z: 0 }, oy * k)
      return { pos, tgt: add(pos, f.normal, -1), fov: ROOM_FOV }
    }
    const closePose = (f: Frame): Pose => { const pos = add(f.c, f.normal, .32); return { pos, tgt: { ...f.c }, fov: ROOM_FOV } }
    const orbitPose = (r = ORB.r): Pose => {
      const c = tower?.center ?? { x: 0, y: 1.5, z: 0 }
      // slide the camera sideways so the tower sits in the middle of what the paper leaves visible
      const mid = box ? box.left - cr.left + box.width / 2 : cr.width / 2
      const shift = (mid - cr.width / 2) * (2 * r * Math.tan(ORBIT_FOV * Math.PI / 360) / Math.max(1, cr.height))
      const rx = Math.cos(ORB.yaw) * -shift, rz = -Math.sin(ORB.yaw) * -shift
      return { pos: { x: c.x + rx + Math.sin(ORB.yaw) * Math.cos(ORB.pitch) * r, y: c.y + Math.sin(ORB.pitch) * r, z: c.z + rz + Math.cos(ORB.yaw) * Math.cos(ORB.pitch) * r }, tgt: { x: c.x + rx, y: c.y, z: c.z + rz }, fov: ORBIT_FOV }
    }
    const viewTarget = (): Pose => view === 'desk' ? (facePose(roomFrame()) ?? roomPose()) : view === 'room' ? roomPose() : view === 'focus' ? (facePose(currentFrame()) ?? orbitPose()) : orbitPose()
    const setView = (next: typeof view, dur = 1200, opts: { from?: Pose; via?: V3; done?: () => void } = {}) => {
      view = next
      plate.classList.remove('on'); check.classList.remove('on')
      room.setDetail(next === 'desk' || next === 'focus' ? 'blurred' : 'full')
      html.setAttribute('data-p4-room-view', next)
      syncHud()
      tween = { from: opts.from ?? { pos: { ...cam.pos }, tgt: { ...cam.tgt }, fov: cam.fov }, to: viewTarget, via: opts.via, start: performance.now(), dur, done: opts.done }
      wake()
    }

    // ---------- layout: 4:3 box inside the grid cell ----------
    let size = { w: 0, h: 0 }
    let marked: Element | null = null
    let cr: DOMRect = canvas.getBoundingClientRect()
    const measure = () => {
      const el = findScreen(frame)
      if (el !== screen) {
        if (screen) release(screen)
        screen = el
        if (screen) { screen.setAttribute('data-p4-screen', ''); margins = { mx: 0, my: 0 }; observeScreen(screen) }
      }
      if (!screen) { box = null; return }
      // the conversation root (the 2D P4 bezel lived on it) is marked here instead of matched with :has()
      const root = screen.querySelector('[data-conversation-content]')?.parentElement ?? null
      if (root !== marked) { marked?.removeAttribute('data-p4-root'); marked = root; root?.setAttribute('data-p4-root', '') }
      // reads (one layout) …
      const ow = screen.offsetWidth, oh = screen.offsetHeight, ol = screen.offsetLeft, ot = screen.offsetTop
      const op = (screen.offsetParent as HTMLElement | null) ?? doc.body
      const pr = op.getBoundingClientRect(), fr = frame.getBoundingClientRect()
      cr = canvas.getBoundingClientRect()
      // … then the maths: the cell is the column box plus our current margins, the new box is the cell minus the new ones
      const cellW = ow + 2 * margins.mx, cellH = oh + 2 * margins.my
      const m = screenMargins(cellW, cellH)
      const cellL = pr.left + op.clientLeft + ol - margins.mx, cellT = pr.top + op.clientTop + ot - margins.my
      const next = { left: cellL + m.mx, top: cellT + m.my, width: cellW - 2 * m.mx, height: cellH - 2 * m.my }
      const same = box && Math.abs(box.left - next.left) < .5 && Math.abs(box.top - next.top) < .5 && Math.abs(box.width - next.width) < .5 && Math.abs(box.height - next.height) < .5
      // … then the writes
      if (Math.abs(m.mx - margins.mx) > .5 || Math.abs(m.my - margins.my) > .5) {
        margins = { mx: m.mx, my: m.my }
        screen.style.setProperty('--p4-mx', `${m.mx}px`); screen.style.setProperty('--p4-my', `${m.my}px`)
      }
      box = next
      if (!same) Object.assign(glass.style, { left: `${box.left - fr.left - frame.clientLeft}px`, top: `${box.top - fr.top - frame.clientTop}px`, width: `${box.width}px`, height: `${box.height}px` })
      const w = Math.max(1, Math.round(cr.width)), h = Math.max(1, Math.round(cr.height))
      if (w !== size.w || h !== size.h) { size = { w, h }; room.setSize(w, h) }
      if (!same) wake()
    }
    const release = (el: HTMLElement) => {
      el.removeAttribute('data-p4-screen'); el.style.removeProperty('--p4-mx'); el.style.removeProperty('--p4-my'); el.style.removeProperty('transform')
      screenObs?.disconnect(); scrollObs?.disconnect()
    }

    // ---------- reactions (never read chat text) ----------
    let screenObs: MutationObserver | null = null, scrollObs: ResizeObserver | null = null
    let sending = false, boltTimer = 0, sessionKey = '', scrollH = 0
    const flag = (name: string, ms: number) => { glass.removeAttribute(name); void glass.offsetWidth; glass.setAttribute(name, ''); win.setTimeout(() => glass.removeAttribute(name), ms) }
    const lightning = () => { if (world !== 'room') return; room.lightning(); flag('data-zap', 340); flash.animate?.([{ opacity: .32 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' }) }
    const stormCheck = () => {
      const now = !!screen?.querySelector('[data-sending]')
      if (now === sending) return
      sending = now; room.setStorm(now); tower?.setThinking(now); win.clearTimeout(boltTimer)
      if (now) { const next = (d: number) => { boltTimer = win.setTimeout(() => { lightning(); next(6000 + Math.random() * 4000) }, d) }; next(420) }
      wake()
    }
    const sessionCheck = () => {
      const content = frame.querySelector('[data-conversation-content]')
      const page = frame.querySelector('[data-cc-leaf][aria-current="page"]')?.getAttribute('data-cc-i') ?? '0'
      const key = page !== '0' ? 'page:' + page : 'session:' + (content?.getAttribute('data-conversation-session') ?? '')
      if (key === sessionKey) return
      const first = !sessionKey; sessionKey = key
      if (page !== '0') room.setAmbientHex(0xffd44a)
      else room.setAmbient(hashIndex(key, R.AMBIENT_COUNT))
      room.setKnob(hashIndex(key, 12) * .52)
      scrollH = 0; papers(false)
      if (!first && !entering && world === 'room') { flag('data-tune', 1000); room.flick(.5) }
    }
    const papers = (animate: boolean) => {
      const content = screen?.querySelector('[data-conversation-scroll]')?.firstElementChild as HTMLElement | null | undefined
      const h = content?.scrollHeight ?? 0
      if (h > scrollH + 40) room.pulse(.3)
      scrollH = h
      room.setPapers(Math.floor(h / 650), animate)
    }
    const observeScreen = (el: HTMLElement) => {
      screenObs?.disconnect()
      screenObs = new (win as Window & typeof globalThis).MutationObserver(() => { stormCheck(); sessionCheck(); watchScroll() })
      screenObs.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-sending', 'data-conversation-session'], childList: true })
      watchScroll()
    }
    let watchedScroll: Element | null = null
    const watchScroll = () => {
      const content = screen?.querySelector('[data-conversation-scroll]')?.firstElementChild ?? null
      if (content === watchedScroll) return
      watchedScroll = content; scrollObs?.disconnect()
      if (content) { scrollObs = new ResizeObserver(() => papers(true)); scrollObs.observe(content) }
    }
    const onInput = () => room.pulse(.18)
    frame.addEventListener('input', onInput, true)

    // ---------- the tower's conversations (titles from the sidebar rows) ----------
    const known = new Map<string, { key: string; title: string; time: string; ws: string }>()
    let selectedKey = ''
    const syncSessions = () => {
      const rows = readSessionRows(frame)
      for (const r of rows) known.set(r.key, { key: r.key, title: r.title, time: r.time, ws: r.ws || known.get(r.key)?.ws || '' })
      const sel = rows.find(r => r.selected)?.key ?? ''
      const changed = sel !== selectedKey
      selectedKey = sel
      if (tower) {
        tower.setSessions([...known.values()], selectedKey, world === 'tower')
        if (changed && world === 'tower' && selectedKey && !warp.busy()) focusOn(selectedKey)
      }
    }
    const ensureTower = () => {
      if (tower || !loadTower) return tower
      tower = loadTower().createTowerScene(doc)
      tower.setSessions([...known.values()], selectedKey, false)
      return tower
    }

    // ---------- tower views ----------
    const yawOfFrame = (f: Frame) => Math.atan2(f.normal.x, f.normal.z)
    const viaAround = (a: V3, b: V3): V3 => {
      const c = tower!.center
      const a0 = Math.atan2(a.x - c.x, a.z - c.z), a1 = Math.atan2(b.x - c.x, b.z - c.z), d = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)), m = a0 + d / 2, r = 2.1 + 1.9 * Math.abs(d) / Math.PI
      return { x: c.x + Math.sin(m) * r, y: (a.y + b.y) / 2 + .3, z: c.z + Math.cos(m) * r }
    }
    const focusOn = (key: string, dur = 1150) => {
      if (!tower) return
      const b = tower.bandOf(key); if (b !== tower.band()) tower.setBand(b)
      const go = () => {
        const f = tower!.frameOf(key); if (!f) return
        const wasFocus = view === 'focus'
        focusKey = key; ORB.yaw = yawOfFrame(f); ORB.vy = ORB.vp = 0
        ORB.pitch = Math.max(PMIN, Math.min(PMAX, Math.asin(Math.max(-1, Math.min(1, (f.c.y - tower!.center.y) / ORB.r)))))
        hideTip()
        setView('focus', wasFocus ? dur * 1.25 : dur, { done: () => flag('data-tune', 1000) })
        if (tween) { // go round the outside of the tower, never through it
          const to = viewTarget(), c = tower!.center, a0 = Math.atan2(tween.from.pos.x - c.x, tween.from.pos.z - c.z), a1 = Math.atan2(to.pos.x - c.x, to.pos.z - c.z)
          if (wasFocus || Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))) > .5) tween.via = viaAround(tween.from.pos, to.pos)
        }
      }
      const wait = Math.max(0, tower.droppingUntil() - performance.now(), b !== tower.band() ? 0 : 0)
      win.setTimeout(go, Math.max(wait, tower.band() !== b ? 440 : 0))
    }
    const unfocus = (dur = 800) => { if (view !== 'focus') return; setView('orbit', dur) }
    // a TV can belong to a workspace that is folded (or a folded sidebar): open the sidebar, unfold the
    // workspace, then press the real row once the host renders it
    let opening = 0
    const openSession = (key: string) => {
      if (key === selectedKey) { focusOn(key); return }
      const find = (k: string) => frame.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(k)}"]`)
      const ws = known.get(key)?.ws ?? ''
      const job = ++opening
      let unfolded = false, unhid = false, tries = 0
      const attempt = () => {
        if (job !== opening) return
        const row = find(key)
        if (row) { row.scrollIntoView({ block: 'nearest' }); row.click(); return }
        if (!unhid && frame.hasAttribute('data-sidebar-collapsed') && !frame.hasAttribute('data-sidebar-drawer')) { unhid = true; frame.querySelector<HTMLElement>('[data-sidebar-toggle]')?.click() }
        const wsRow = ws ? find(ws) : null
        if (wsRow && !unfolded && wsRow.getAttribute('aria-expanded') !== 'true') { unfolded = true; wsRow.click() }
        if (++tries < 30) win.setTimeout(attempt, 60)
        else showTip(words.closed)
      }
      attempt()
    }

    // ---------- crossing between the worlds ----------
    const sloganSub = slogan.querySelector<HTMLElement>('.k')!
    let sloganT = 0
    const playSlogan = (ch: number) => {
      sloganSub.innerHTML = `CH ${pad(ch)} <em>／</em> ${words.entering} <em>／</em> NOW ENTERING <em>／</em> MIDNIGHT CHANNEL`
      slogan.classList.remove('go'); void slogan.offsetWidth; slogan.classList.add('go')
      win.clearTimeout(sloganT); sloganT = win.setTimeout(() => slogan.classList.remove('go'), 1300)
    }
    const rectOf = (f: Frame | null) => {
      const fr = frame.getBoundingClientRect()
      if (!f) return { cx: fr.width / 2, cy: fr.height / 2, w: 320, h: 240 }
      const cr = canvas.getBoundingClientRect()
      const a = proj(add(add(f.c, f.right, -f.w / 2), { x: 0, y: 1, z: 0 }, f.h / 2), cr), b = proj(add(add(f.c, f.right, f.w / 2), { x: 0, y: 1, z: 0 }, -f.h / 2), cr)
      return { cx: (a.x + b.x) / 2 - fr.left, cy: (a.y + b.y) / 2 - fr.top, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
    }
    const setWorld = (w: 'room' | 'tower') => { world = w; html.setAttribute('data-p4-world', w); lastCss = '' }
    const toTower = (fromEntry = false) => {
      if (warp.busy() || !loadTower) return
      ensureTower(); syncSessions()
      const key = selectedKey
      playSlogan(key && tower ? tower.chOf(key) || 1 : 1)
      if (!fromEntry) { html.setAttribute('data-p4-dive', ''); tween = { from: { pos: { ...cam.pos }, tgt: { ...cam.tgt }, fov: cam.fov }, to: () => closePose(roomFrame()), start: performance.now(), dur: 900 }; wake() }
      win.setTimeout(() => warp.run(rectOf(world === 'room' ? roomFrame() : null), () => {
        html.removeAttribute('data-p4-dive')
        setWorld('tower')
        const f = key && tower ? tower.frameOf(key) : null
        ORB.yaw = f ? yawOfFrame(f) + .9 : 0; ORB.pitch = .55; ORB.r = ORB.rt = Math.max(3.5, Math.min(4.1, 3.2 + (tower?.height() ?? 3) * .18))
        const far = orbitPose(4.25); Object.assign(cam, { pos: far.pos, tgt: far.tgt, fov: far.fov }); tween = null; view = 'orbit'
        if (f && key) { focusKey = key; ORB.yaw -= .9; ORB.pitch = .14; setView('focus', 1700, { from: far, done: () => flag('data-tune', 1000) }) }
        else { ORB.yaw -= .9; ORB.pitch = .14; setView('orbit', 1700, { from: far }) }
      }, () => { wake() }), fromEntry ? 0 : 420)
    }
    const toRoom = () => {
      if (warp.busy()) return
      playSlogan(1)
      warp.run(rectOf(currentFrame()), () => {
        setWorld('room'); focusKey = ''
        const close = closePose(roomFrame()); Object.assign(cam, close); tween = null
        setView('desk', 1300, { from: close, done: () => flag('data-tune', 1000) })
      }, () => wake())
    }
    const setMode = (m: P4Mode) => {
      if (m === mode && ((m === 'tower') === (world === 'tower'))) return
      mode = m; try { win.localStorage.setItem(MODE_KEY, m) } catch { /* this window only */ }
      if (entering) finishEntry(false)
      syncHud()
      if (m === 'tower' && world === 'room') toTower()
      else if (m === 'room' && world === 'tower') toRoom()
    }

    // ---------- interaction ----------
    hud.addEventListener('click', e => {
      const m = (e.target as Element).closest<HTMLButtonElement>('[data-m]'); if (m) { setMode(m.dataset.m as P4Mode); return }
      if (!(e.target as Element).closest('.step') || warp.busy()) return
      if (entering) { finishEntry(); return }
      if (view === 'desk') setView('room'); else if (view === 'room') setView('desk')
      else if (view === 'focus') unfocus(); else if (selectedKey) focusOn(selectedKey)
    })
    glass.addEventListener('click', () => {
      if (entering) { finishEntry(); return }
      if (view === 'room') setView('desk'); else if (view === 'orbit' && focusKey) focusOn(focusKey)
    })
    const onFocus = (e: FocusEvent) => {
      if (!(e.target as Element)?.closest?.('textarea, input, [contenteditable="true"]') || !screen?.contains(e.target as Node)) return
      if (entering) finishEntry(); else if (view === 'room') setView('desk'); else if (view === 'orbit' && focusKey) focusOn(focusKey)
    }
    frame.addEventListener('focusin', onFocus, true)
    // tower: drag to look around, wheel to zoom, click a TV to watch it
    const ndc = (e: PointerEvent | MouseEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 } }
    const pickAt = (e: PointerEvent | MouseEvent) => tower && R.pickRay ? tower.pick(R.pickRay(room.camera, ndc(e))) : null
    const drag = { on: false, moved: false, x: 0, y: 0, lx: 0, ly: 0 }
    const onDown = (e: PointerEvent) => { if (entering) { finishEntry(); return } if (warp.busy()) return; Object.assign(drag, { on: true, moved: false, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY }); input.setPointerCapture?.(e.pointerId) }
    const onMove = (e: PointerEvent) => {
      mouse = ndc(e)
      if (!drag.on) { if (world === 'room') roomHover(e); else hover(e); wake(); return }
      if (world === 'room') return
      const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) { drag.moved = true; hideTip(); html.setAttribute('data-p4-dragging', ''); if (view === 'focus') unfocus(500) }
      if (drag.moved && view === 'orbit' && !tween) { ORB.vy = -dx * .0042; ORB.vp = dy * .003; ORB.yaw += ORB.vy; ORB.pitch = Math.max(PMIN, Math.min(PMAX, ORB.pitch + ORB.vp)); wake() }
    }
    const onUp = (e: PointerEvent) => {
      if (!drag.on) return
      drag.on = false; html.removeAttribute('data-p4-dragging')
      if (drag.moved) return
      if (world === 'room') { roomClick(e); return }
      const k = pickAt(e); if (k) openSession(k)
    }
    // room: name plates, CHECK!! on the TV, a line of narration, click the TV to sit closer
    let mouse = { x: 0, y: 0 }, par = { x: 0, y: 0 }, hoverThing: Thing | null = null, msgT = 0
    const thingAt = (e: PointerEvent) => R.pickRay ? room.pickThing(R.pickRay(room.camera, ndc(e))) : null
    const say = (who: string, text: string) => {
      if (box) { const fr = frame.getBoundingClientRect(); msg.style.left = `${box.left - fr.left + box.width / 2}px` }
      msg.querySelector('.who')!.textContent = who; msg.querySelector('p')!.textContent = text
      msg.classList.remove('on'); void msg.offsetWidth; msg.classList.add('on')
      win.clearTimeout(msgT); msgT = win.setTimeout(() => msg.classList.remove('on'), 3200)
    }
    const hideRoomHover = () => { hoverThing = null; plate.classList.remove('on'); check.classList.remove('on'); input.style.cursor = '' }
    const roomHover = (e: PointerEvent) => {
      if (view !== 'room' || tween) { hideRoomHover(); return }
      const t = thingAt(e)
      if (t === hoverThing) return
      hoverThing = t
      if (!t) { hideRoomHover(); return }
      const w = roomWords(html.lang.toLowerCase(), room.papers())[t]
      const fr = frame.getBoundingClientRect(); plate.style.left = `${e.clientX - fr.left + 16}px`; plate.style.top = `${e.clientY - fr.top + 18}px`
      plate.textContent = w[0]; plate.classList.remove('on'); void plate.offsetWidth; plate.classList.add('on')
      check.classList.toggle('on', t === 'tv'); input.style.cursor = t === 'tv' ? 'zoom-in' : 'pointer'
    }
    const roomClick = (e: PointerEvent) => {
      if (view === 'desk') { setView('room'); return }
      if (view !== 'room') return
      const t = thingAt(e); if (!t) return
      if (t === 'tv') { hideRoomHover(); setView('desk'); return }
      const w = roomWords(html.lang.toLowerCase(), room.papers())[t]
      say(w[0], w[1])
    }
    const onWheel = (e: WheelEvent) => { if (world !== 'tower' || view !== 'orbit' || tween) return; e.preventDefault(); ORB.rt = Math.max(2.3, Math.min(4.15, ORB.rt + e.deltaY * .0025)); wake() }
    let tipT = 0
    const showTip = (text: string, x?: number, y?: number) => {
      tip.textContent = text; tip.classList.add('on')
      const fr = frame.getBoundingClientRect()
      tip.style.left = `${(x ?? fr.left + fr.width / 2) - fr.left}px`; tip.style.top = `${(y ?? fr.top + fr.height - 80) - fr.top}px`
      win.clearTimeout(tipT); tipT = win.setTimeout(hideTip, 2400)
    }
    const hideTip = () => { tip.classList.remove('on'); input.style.cursor = '' }
    let hoverQueued = false, lastHover: PointerEvent | null = null
    const hover = (e: PointerEvent) => {
      if (world !== 'tower' || view !== 'orbit') return
      lastHover = e; if (hoverQueued) return; hoverQueued = true
      win.requestAnimationFrame(() => {
        hoverQueued = false; if (!lastHover || !tower) return
        const k = pickAt(lastHover)
        input.style.cursor = k ? 'pointer' : ''
        if (k) showTip(`CH ${pad(tower.chOf(k))}・${tower.titleOf(k)}`, lastHover.clientX + 14, lastHover.clientY - 34); else tip.classList.remove('on')
      })
    }
    input.addEventListener('pointerdown', onDown); input.addEventListener('pointermove', onMove); input.addEventListener('pointerup', onUp)
    input.addEventListener('pointercancel', onUp); input.addEventListener('wheel', onWheel, { passive: false }); input.addEventListener('pointerleave', () => { if (!drag.on) { tip.classList.remove('on'); hideRoomHover(); mouse = { x: 0, y: 0 }; wake() } })

    // ---------- opening ----------
    let entering = false, clockLive = false
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => timers.push(win.setTimeout(fn, ms))
    const tick = () => { if (clockLive) { const n = new Date(); room.setVcr(`${pad(n.getHours())}:${pad(n.getMinutes())}`) } }
    const clock = win.setInterval(tick, 10000)
    const finishEntry = (pushIn = true) => {
      timers.forEach(t => win.clearTimeout(t)); timers.length = 0
      entering = false; room.setTV(true); room.setMidnight(false); glass.dataset.state = 'on'
      clockLive = true; tick()
      if (pushIn && world === 'room' && view !== 'desk') setView('desk', 900)
    }
    const skip = () => { if (entering) finishEntry() }
    doc.addEventListener('beforeinput', skip, true); doc.addEventListener('keydown', skip, true)
    const startEntry = () => {
      entering = true; clockLive = false; room.setTV(false); glass.dataset.state = 'off'; room.setVcr('23:59:57')
      const pre = { pos: { ...R.PRE_VIEW.pos }, tgt: { ...R.PRE_VIEW.tgt }, fov: ROOM_FOV }
      Object.assign(cam, pre); setView('room', 4200, { from: pre })
      later(() => room.setVcr('23:59:58'), 1000)
      later(() => room.setVcr('23:59:59'), 2000)
      later(() => { room.setVcr('00:00'); room.setTV(true); room.setMidnight(true); glass.dataset.state = 'midnight' }, 3000)
      later(() => { room.setMidnight(false); glass.dataset.state = 'on'; flag('data-tune', 1000) }, 4500)
      later(finishEntry, 5300)
    }

    // ---------- render loop (≈30 fps, every frame while moving; paused while hidden) ----------
    let raf = 0, last = performance.now(), acc = 0, lastCss = '', offscreen = false
    const proj = (p: V3, cr: DOMRect) => {
      const v = room.camera.position.clone().set(p.x, p.y, p.z).project(room.camera)
      return { x: cr.left + (v.x + 1) / 2 * cr.width, y: cr.top + (1 - v.y) / 2 * cr.height, behind: v.z > 1 }
    }
    const applyScreen = () => {
      if (!screen || !box) return
      const f = currentFrame()
      const hide = !f
      if (hide !== offscreen) { offscreen = hide; html.toggleAttribute('data-p4-offscreen', hide) }
      if (!f) return
      const up = { x: 0, y: 1, z: 0 }
      const corner = (sx: number, sy: number) => proj(add(add(f.c, f.right, sx * f.w / 2), up, sy * f.h / 2), cr)
      const pts = [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)]
      if (pts.some(p => p.behind)) { if (!offscreen) { offscreen = true; html.setAttribute('data-p4-offscreen', '') } return }
      const q = pts.map(p => ({ x: p.x - box!.left, y: p.y - box!.top })) as Quad
      let css = 'none'
      if (quadDeviation(box.width, box.height, q) > .75) { const m = quadMatrix(box.width, box.height, q); if (m) css = matrixCss(m) }
      if (css !== lastCss) { lastCss = css; screen.style.setProperty('transform', css, 'important'); glass.style.transform = css === 'none' ? '' : css }
    }
    const frameStep = (now: number) => {
      raf = 0
      const dt = Math.min(.1, (now - last) / 1000); last = now; acc += dt
      let moving = !!tween
      if (tween) {
        const p = Math.min(1, (now - tween.start) / tween.dur), e = ease(p), to = tween.to()
        for (const k of ['pos', 'tgt'] as const) for (const a of ['x', 'y', 'z'] as const) cam[k][a] = tween.from[k][a] + (to[k][a] - tween.from[k][a]) * e
        if (tween.via) { const u = 1 - e; for (const a of ['x', 'y', 'z'] as const) cam.pos[a] = u * u * tween.from.pos[a] + 2 * u * e * tween.via[a] + e * e * to.pos[a] }
        cam.fov = tween.from.fov + (to.fov - tween.from.fov) * e
        if (p >= 1) { const d = tween.done; tween = null; d?.() }
      } else if (view === 'orbit') {
        if (!drag.on) { ORB.yaw += ORB.vy; ORB.pitch = Math.max(PMIN, Math.min(PMAX, ORB.pitch + ORB.vp)); ORB.vy *= .93; ORB.vp *= .85 }
        ORB.r += (ORB.rt - ORB.r) * .15
        moving = moving || Math.abs(ORB.vy) > 1e-4 || Math.abs(ORB.vp) > 1e-4 || Math.abs(ORB.rt - ORB.r) > 1e-3 || drag.on
        Object.assign(cam, orbitPose())
      } else {
        const t = viewTarget(); cam.pos = t.pos; cam.tgt = t.tgt; cam.fov = t.fov
        // a little parallax while looking at the room (never when the picture must sit exactly on the column)
        const want = world === 'room' && view === 'room' ? mouse : { x: 0, y: 0 }
        par.x += (want.x - par.x) * .06; par.y += (want.y - par.y) * .06
        if (Math.abs(want.x - par.x) + Math.abs(want.y - par.y) > .002) moving = true
        cam.pos = { x: cam.pos.x + par.x * .22, y: cam.pos.y + par.y * .1, z: cam.pos.z - par.x * .08 }
      }
      if (check.classList.contains('on')) {
        const p = proj(room.tvTop(), cr), fr = frame.getBoundingClientRect()
        check.style.left = `${p.x - fr.left}px`; check.style.top = `${p.y - fr.top}px`
      }
      if (acc >= (view === 'desk' || view === 'focus' ? 1 / 21 : 1 / 31) || moving) {
        const desk = view === 'desk' ? 1 : 0
        room.setFov(cam.fov)
        room.camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z); room.camera.lookAt(cam.tgt.x, cam.tgt.y, cam.tgt.z)
        if (world === 'room') { room.update(acc, desk); room.render() }
        else if (tower) { tower.update(acc); room.renderScene(tower.scene) }
        acc = 0
        applyScreen()
      }
      schedule()
    }
    const schedule = () => { if (!raf && !doc.hidden) raf = win.requestAnimationFrame(frameStep) }
    const wake = () => schedule()
    const visibility = () => { if (doc.hidden) { if (raf) win.cancelAnimationFrame(raf); raf = 0 } else { last = performance.now(); schedule() } }
    doc.addEventListener('visibilitychange', visibility)

    const ro = new ResizeObserver(measure); ro.observe(frame); ro.observe(art)
    const onResize = () => measure(); win.addEventListener('resize', onResize)
    setWorld('room')
    measure(); sessionCheck(); stormCheck(); syncSessions(); syncHud()
    if (mode === 'tower' && loadTower) { room.setTV(true); glass.dataset.state = 'on'; clockLive = true; tick(); Object.assign(cam, roomPose()); toTower(true) }
    else startEntry()

    return {
      sync() { placeHud(); measure(); if (screen) ro.observe(screen); sessionCheck(); stormCheck(); watchScroll(); syncSessions() },
      dispose() {
        timers.forEach(t => win.clearTimeout(t)); win.clearTimeout(boltTimer); win.clearInterval(clock); win.clearTimeout(sloganT); win.clearTimeout(tipT)
        if (raf) win.cancelAnimationFrame(raf)
        ro.disconnect(); win.removeEventListener('resize', onResize)
        doc.removeEventListener('visibilitychange', visibility); doc.removeEventListener('beforeinput', skip, true); doc.removeEventListener('keydown', skip, true)
        frame.removeEventListener('input', onInput, true); frame.removeEventListener('focusin', onFocus, true)
        if (screen) release(screen)
        warp.dispose(); tower?.dispose(); room.dispose()
        canvas.remove(); flash.remove(); glass.remove(); hud.remove(); input.remove(); tip.remove(); plate.remove(); check.remove(); msg.remove(); win.clearTimeout(msgT); slogan.remove(); style.remove()
        frame.removeAttribute('data-p4-frame'); marked?.removeAttribute('data-p4-root')
        for (const a of ['data-p4-3d', 'data-p4-room-view', 'data-p4-world', 'data-p4-offscreen', 'data-p4-dive', 'data-p4-dragging']) html.removeAttribute(a)
      },
    }
  }

  const sync = () => {
    if (wanted()) {
      if (!mounted) {
        try { mounted = mount() }
        catch (error) { failed = true; console.warn('[dsh-calling-card-skin] P4 3D room unavailable, keeping the 2D P4', error) }
      } else mounted.sync()
    } else if (mounted) { mounted.dispose(); mounted = null }
  }
  const motion = () => sync()
  reduced?.addEventListener?.('change', motion)
  return {
    sync,
    dispose() { reduced?.removeEventListener?.('change', motion); mounted?.dispose(); mounted = null },
  }
}
