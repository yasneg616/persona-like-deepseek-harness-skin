/**
 * P3R — the Reload-menu redesign of P3 mode.
 *
 * Layers (back to front):
 *  - `.p3r-back`, prepended to the app frame behind every column: the night-train
 *    background, the water tint, ambient bubbles and the moving white/blue seam.
 *  - the host's own sidebar and conversation, restyled by p3r.css (the workspace
 *    tree becomes a station line; nothing is reparented or re-rendered).
 *  - `.p3r-ui` in `shell.overlay`: title bar, the big DSH word, the four menu
 *    buttons on the seam (each forwards its click to the real host button) with
 *    the morphing red/white cursor, the capsule player + headphones, the clock,
 *    the collapsed station strip and the dive-in opening.
 *
 * Everything is decorative or forwards to a host control; no host node is
 * created, moved or removed, and every attribute we add is removed on dispose.
 */
import { mountTrain } from './train.ts'
import { CAPSULE_SVG, HEADPHONES_SVG } from './art.ts'
import { P4G_FLOWER_SVG, P4G_SPARK_SVG, P4G_WEATHER_SVG } from '../p4g/art.ts'
import { chromeLabels, mountChrome } from '../chrome.ts'
import { personaClock } from '../persona-clock.ts'

type Item = { key: string, en: string, zh: string, find: (d: Document) => HTMLButtonElement | null }

const textOf = (b: Element | null) => (b?.getAttribute('aria-label') || b?.textContent || '').replace(/\s+/g, ' ').trim()
const panel = (re: RegExp) => (d: Document) => Array.from(d.querySelectorAll<HTMLButtonElement>('button[class*="_panelRow"]'))
  .find(b => !b.closest('[class*="_moreAnchor"]') && re.test(textOf(b))) ?? null

/** The host's four page controls, in menu order. More stays a host button (its popover anchors to it). */
export const P3R_ITEMS: Item[] = [
  { key: 'new', en: 'New Session', zh: '新会话', find: d => d.querySelector<HTMLButtonElement>('button[class*="_newSession"]') },
  { key: 'plugins', en: 'Plugins', zh: '插件', find: panel(/plugin|插件|外掛/i) },
  { key: 'automation', en: 'Automation', zh: '自动化任务', find: panel(/automation|自动化|自動化/i) },
  // the panel overflow ("浏览更多插件 / 创建你的插件"); the settings/account "更多" stays a host button at the bottom of the white
  { key: 'more', en: 'More', zh: '更多', find: d => d.querySelector<HTMLButtonElement>('[class*="_moreAnchor"] > button, [class*="_moreAnchor"] button') },
]

const isCurrent = (b: HTMLButtonElement | null) => !!b && (b.getAttribute('aria-current') === 'page' || !!b.closest('[class*="_panelEntryActive"]'))

export interface Workspace { key: string, name: string, current: boolean }

/** Workspaces as listed by the host tree; the current one owns the selected session. */
export function readWorkspaces(d: Document): Workspace[] {
  const rows = Array.from(d.querySelectorAll<HTMLElement>('[data-row-key^="workspace:"], [data-row-key^="session:"]'))
  const out: Workspace[] = []
  let owner: Workspace | null = null
  for (const row of rows) {
    const key = row.getAttribute('data-row-key') || ''
    if (key.startsWith('workspace:')) {
      const name = (row.querySelector('[class*="_title"]')?.textContent || row.textContent || key.slice(10)).replace(/\s+/g, ' ').trim() || key.slice(10)
      owner = { key, name, current: false }
      out.push(owner)
    } else if (owner && (row.getAttribute('aria-selected') === 'true' || /_selected\b/.test(row.className))) owner.current = true
  }
  return out
}

const STRIP = 150
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

/** `p4g` reuses this composition for P4 Golden: no train/water/dive, a straight yellow paper edge, flowers instead of the capsule. */
export type P3RVariant = 'p3' | 'p4g'

export function mountP3R(d: Document, win: Window & typeof globalThis, ui: HTMLElement, frame: HTMLElement, variant: P3RVariant = 'p3'): () => void {
  const html = d.documentElement
  const gold = variant === 'p4g'
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches
  const labels = chromeLabels(html.lang || 'zh')

  /* ------------------------------------------------------------ back layer */
  const back = d.createElement('div')
  back.className = 'p3r-back'
  back.setAttribute('aria-hidden', 'true')
  back.innerHTML = gold
    ? `<div class="p4g-room"></div>
    <svg class="p3r-seam" preserveAspectRatio="none"><defs><linearGradient id="p4g-paper-grad" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#ffe600"/><stop offset=".62" stop-color="#ffc800"/><stop offset="1" stop-color="#ff9d00"/></linearGradient>
      <clipPath id="p4g-paper-clip"><path class="clip"/></clipPath></defs>
      <path class="paper"/><g class="p4g-art" clip-path="url(#p4g-paper-clip)"><path class="sky"/><g class="clouds"></g><path class="slab"/></g><path class="rim1"/><path class="rim2"/></svg>`
    : `<div class="p3r-train-host"></div><div class="p3r-water"></div><div class="p3r-rays"></div><div class="p3r-surface"></div><div class="p3r-amb"></div>
    <svg class="p3r-seam" preserveAspectRatio="none"><path class="paper"/><path class="rim1"/><path class="rim2"/></svg>`
  frame.prepend(back)
  frame.setAttribute('data-p3r', '')
  const train = gold
    ? { setWorkspace() {}, setDark() {}, pointer() {}, dispose() {} }
    : mountTrain(back.querySelector('.p3r-train-host') as HTMLElement, win)
  const amb = back.querySelector('.p3r-amb') as HTMLElement | null
  for (let i = 0; amb && i < 16; i++) {
    const b = d.createElement('i'); const s = 8 + Math.random() * 22
    b.style.cssText = `left:${20 + Math.random() * 80}%;width:${s}px;height:${s}px;--wob:${(Math.random() - .5) * 60}px;animation-duration:${10 + Math.random() * 10}s;animation-delay:${-Math.random() * 20}s`
    amb!.appendChild(b)
  }

  /* ------------------------------------------------------------ overlay ui */
  ui.innerHTML = `
    <header class="p3r-tbar">
      <div class="p3r-tl">
        <button type="button" class="p3r-side" aria-label="收起侧栏"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/><path class="arrow" d="M15 9l-3 3 3 3"/></svg></button>
        <div class="dsh-cc-menus" role="menubar">
          <button type="button" class="dsh-cc-menu" data-menu="application"><span class="dsh-cc-menu-label">${labels.application}</span><small>APP</small></button>
          <button type="button" class="dsh-cc-menu" data-menu="edit"><span class="dsh-cc-menu-label">${labels.edit}</span><small>EDIT</small></button>
        </div>
      </div>
      <div class="dsh-cc-wins">
        <button type="button" class="dsh-cc-win" data-win="minimize" aria-label="${labels.minimize}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 11h14"/></svg></button>
        <button type="button" class="dsh-cc-win" data-win="maximize" aria-label="${labels.maximize}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.6"><rect class="one" x="3.5" y="3.5" width="13" height="13"/><g class="two"><rect x="3.5" y="6.5" width="10" height="10"/><path d="M6.5 6.5V3.5h10v10h-3"/></g></svg></button>
        <button type="button" class="dsh-cc-win" data-win="close" aria-label="${labels.close}"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 4l12 12M16 4L4 16"/></svg></button>
      </div>
    </header>
    <div class="p3r-fade top" aria-hidden="true"></div>
    <div class="p3r-vword" aria-hidden="true">DSH</div>
    <nav class="p3r-menu" aria-label="页面">${P3R_ITEMS.map(i => `<button type="button" data-key="${i.key}"><span class="lbl">${i.en}</span><small>${i.zh}</small></button>`).join('')}</nav>
    <div class="p3r-gear" aria-hidden="true"><div class="bob">${gold
      ? `<div class="flower big">${P4G_FLOWER_SVG}</div><div class="flower mid">${P4G_FLOWER_SVG}</div><div class="spark">${P4G_SPARK_SVG}</div>`
      : `<div class="phones">${HEADPHONES_SVG}</div><div class="capsule">${CAPSULE_SVG}</div>`}</div></div>
    <div class="p3r-clock" aria-hidden="true"><b data-k="date"></b><div class="meta"><span data-k="day"></span><em data-k="period"></em></div>${gold ? P4G_WEATHER_SVG : '<span class="moonph"></span>'}</div>
    <nav class="p3r-strip" aria-label="工作区"></nav>
    <div class="p3r-tip" aria-hidden="true"></div>
    <div class="p3r-dive" aria-hidden="true"><div class="veil"></div></div>${gold ? '<svg class="p4g-strings" aria-hidden="true"></svg>' : ''}`
  const $ = <T extends Element = HTMLElement>(s: string) => ui.querySelector(s) as T
  const menu = $('.p3r-menu'), gear = $('.p3r-gear'), strip = $('.p3r-strip'), tip = $('.p3r-tip'), dive = $('.p3r-dive')
  const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
  const chrome = mountChrome(d, win, $<HTMLElement>('.p3r-tbar'))
  // while our caption is on, the native one must stay hidden even if another overlay's cleanup drops the flag
  const captionMo = new win.MutationObserver(() => { if (chrome.on && !html.hasAttribute('data-cc-caption')) html.setAttribute('data-cc-caption', '') })
  if (chrome.on) captionMo.observe(html, { attributes: true, attributeFilter: ['data-cc-caption'] })

  // write a custom property only when it really changes: every write on the frame restyles the whole app
  const setVar = (el: HTMLElement, name: string, value: string) => { if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value) }
  /* ------------------------------------------------------------ menu: forward + cursor */
  const hostFor = (b: HTMLButtonElement) => P3R_ITEMS.find(i => i.key === b.dataset.key)!.find(d)
  let hovered: HTMLButtonElement | null = null
  const setCursor = (b: HTMLButtonElement | null) => {
    for (const x of items) {
      const on = x === b
      if (x.classList.contains('on') === on && (!on || x.querySelector('.cur'))) continue
      x.classList.toggle('on', on)
      x.querySelector('.cur')?.remove()
      if (on) {
        const t = x.querySelector('.lbl')!.textContent
        x.insertAdjacentHTML('beforeend', `<span class="cur" aria-hidden="true">${gold ? '<i class="tc m-w"></i><i class="tm m-w"></i>' : ''}<i class="tw m-w"></i><i class="tr m-r"></i><span class="cw m-w">${t}</span><span class="cr m-r">${t}</span></span>`)
      }
    }
  }
  const syncMenu = () => {
    let current: HTMLButtonElement | null = null
    for (const b of items) {
      const host = hostFor(b)
      b.hidden = !host
      const cur = isCurrent(host)
      b.toggleAttribute('aria-current', cur)
      if (cur) current = b
    }
    setCursor(hovered ?? current ?? items.find(b => !b.hidden) ?? null)
  }
  const onMenuOver = (e: Event) => { const b = (e.target as Element).closest<HTMLButtonElement>('.p3r-menu button'); if (b) { hovered = b; setCursor(b) } }
  const onMenuLeave = () => { hovered = null; syncMenu() }
  const onMenuClick = (e: Event) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.p3r-menu button'); if (!b) return
    const host = hostFor(b); if (!host) return
    if (b.dataset.key === 'more') {
      // park the (invisible) host button under our item first, so the popover it opens anchors here
      const r = b.getBoundingClientRect(), f = frame.getBoundingClientRect()
      setVar(frame, '--p3r-more-x', `${Math.round(r.left - f.left)}px`); setVar(frame, '--p3r-more-y', `${Math.round(r.top - f.top)}px`)
      setVar(frame, '--p3r-more-w', `${Math.round(r.width)}px`); setVar(frame, '--p3r-more-h', `${Math.round(r.height)}px`)
      host.getBoundingClientRect()
    }
    host.click()
  }
  menu.addEventListener('pointerover', onMenuOver)
  menu.addEventListener('focusin', onMenuOver)
  menu.addEventListener('pointerleave', onMenuLeave)
  menu.addEventListener('focusout', onMenuLeave)
  menu.addEventListener('click', onMenuClick)
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    const live = items.filter(b => !b.hidden), i = live.indexOf(e.target as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault(); live[(i + (e.key === 'ArrowDown' ? 1 : live.length - 1)) % live.length].focus()
  }
  menu.addEventListener('keydown', onMenuKey)

  /* ------------------------------------------------------------ sidebar toggle (forwards to the host's) */
  const sideBtn = $<HTMLButtonElement>('.p3r-side')
  const onSide = () => d.querySelector<HTMLButtonElement>('[data-sidebar-toggle]')?.click()
  sideBtn.addEventListener('click', onSide)

  /* ------------------------------------------------------------ seam geometry */
  const sideCol = () => frame.querySelector<HTMLElement>('[class*="_sidebarCol"]') ?? frame.firstElementChild?.nextElementSibling as HTMLElement | null
  const collapsed = () => frame.hasAttribute('data-sidebar-collapsed') && !frame.hasAttribute('data-sidebar-drawer')
  let base = 0, target = 0, dived = 0, amp = 9, W = 1, H = 1
  const measure = () => {
    const fr = frame.getBoundingClientRect(); W = Math.max(1, fr.width); H = Math.max(1, fr.height)
    // the host's own (user-dragged) sidebar width, and the right bar, feed the grid track in p3r.css
    const handle = frame.querySelector<HTMLElement>(':scope > [data-side="sidebar"]'), raw = handle ? Number.parseFloat(handle.style.left) : Number.NaN
    if (Number.isFinite(raw) && raw > 0) setVar(frame, '--p3r-host-side', `${Math.round(raw)}px`)
    const rightCol = frame.querySelector<HTMLElement>('[data-rightbar-col]')
    setVar(frame, '--p3r-right', `${rightCol && !frame.hasAttribute('data-rightbar-collapsed') ? Math.round(rightCol.scrollWidth) : 0}px`)
    const col = sideCol(), right = col ? col.getBoundingClientRect().right - fr.left : 0
    target = collapsed() || right < 60 ? STRIP : Math.max(STRIP, right)
    if (!base) base = target
    frame.classList.toggle('p3r-collapsed', target === STRIP)
    // the chat starts past the menu that straddles the seam
    const center = gold ? null : frame.querySelector<HTMLElement>('[class*="_centerCol"], #center')
    const colLeft = center ? center.getBoundingClientRect().left - fr.left : 0
    if (!gold) {
      setVar(frame, '--p3r-chat-left', `${Math.round(target + Math.min(440, Math.max(180, W * .23)))}px`)
      setVar(frame, '--p3r-col-left', `${Math.round(colLeft)}px`)
    }
  }
  const seamSvg = back.querySelector('.p3r-seam') as SVGSVGElement
  const paper = seamSvg.querySelector('.paper') as SVGPathElement, rim1 = seamSvg.querySelector('.rim1') as SVGPathElement, rim2 = seamSvg.querySelector('.rim2') as SVGPathElement
  // P4G paper art, clipped by the paper: a sky band rising to the right with clouds, and the black slab the menu rides on
  let goldSig = ''
  const drawGold = (paperD: string) => {
    seamSvg.querySelector('.clip')!.setAttribute('d', paperD)
    const S = base + 120, sig = `${Math.round(S)}x${Math.round(H)}`
    if (sig === goldSig) return
    goldSig = sig
    seamSvg.querySelector('.sky')!.setAttribute('d', `M-10 ${H * .5} L${S} ${H * .16} L${S} ${H * .33} L-10 ${H * .69} Z`)
    seamSvg.querySelector('.slab')!.setAttribute('d', `M-10 ${58} L${S} ${58 + S * .1} L${S} ${Math.max(300, H * .36)} L-10 ${Math.max(270, H * .31)} Z`)
    const clouds = seamSvg.querySelector('.clouds')!
    clouds.innerHTML = [[.12, .58, 1], [.42, .42, .8], [.7, .3, 1.15], [.9, .2, .7]].map(([x, y, s]) =>
      `<g transform="translate(${(S * x).toFixed(0)} ${(H * y).toFixed(0)}) scale(${s})"><ellipse cx="0" cy="0" rx="46" ry="20"/><ellipse cx="-30" cy="6" rx="30" ry="15"/><ellipse cx="34" cy="4" rx="34" ry="16"/><ellipse cx="6" cy="-14" rx="28" ry="18"/></g>`).join('')
  }
  const edge = (y: number, t: number, off: number) => {
    const k = y / H
    if (gold) return base + dived + 40 + (-30 - 40) * k + off
    const top = base + dived + 46, bottom = base + dived - 38
    return top + (bottom - top) * k + off + 34 * Math.sin(k * 2.4 + .6) + amp * Math.sin(y / 160 + t * 1.05) + amp * .5 * Math.sin(y / 57 - t * 1.8) + 4 * Math.sin(t * .33 + k * 3)
  }
  let seamSig = ''
  const drawSeam = (now: number) => {
    if (gold) { const sig = `${Math.round(base)}|${Math.round(dived)}|${Math.round(W)}|${Math.round(H)}`; if (sig === seamSig) return; seamSig = sig }
    const t = now / 1000, step = Math.max(16, H / 60)
    let p = `M-10 -10 L${edge(-10, t, 0).toFixed(1)} -10`, a = '', b = ''
    for (let y = -10; y <= H + 10; y += step) {
      p += ` L${edge(y, t, 0).toFixed(1)} ${y.toFixed(0)}`
      a += `${a ? ' L' : 'M'}${edge(y, t, 14).toFixed(1)} ${y.toFixed(0)}`
      b += `${b ? ' L' : 'M'}${edge(y, t * 1.06, 30).toFixed(1)} ${y.toFixed(0)}`
    }
    seamSvg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    paper.setAttribute('d', `${p} L-10 ${H + 10} Z`); rim1.setAttribute('d', a); rim2.setAttribute('d', b)
    if (gold) drawGold(`${p} L-10 ${H + 10} Z`)
    setVar(ui, '--p3r-seam', `${Math.round(base)}px`) // only the overlay reads it; the UI rides the resting seam, not the opening sweep
  }

  /* ------------------------------------------------------------ workspaces: scenery, LED, collapsed strip */
  let spaces: Workspace[] = []
  let currentWs = ''
  const syncSpaces = () => {
    const live = readWorkspaces(d)
    if (live.length) spaces = live
    const cur = spaces.find(s => s.current) ?? spaces.find(s => d.querySelector(`[data-row-key="${CSS.escape(s.key)}"][aria-expanded="true"]`)) ?? spaces[0]
    const name = cur?.name || 'DSH'
    d.querySelectorAll('[data-p3r-now]').forEach(n => { if (!cur || n.getAttribute('data-row-key') !== cur.key) n.removeAttribute('data-p3r-now') })
    if (cur) d.querySelector(`[data-row-key="${CSS.escape(cur.key)}"]`)?.setAttribute('data-p3r-now', '')
    if (name !== currentWs) { currentWs = name; train.setWorkspace(name) }
    const sig = spaces.map(s => s.key + (s === cur ? '*' : '')).join('|')
    if (strip.dataset.sig !== sig) {
      strip.dataset.sig = sig
      strip.innerHTML = spaces.map(s => `<button type="button" data-key="${s.key.replace(/"/g, '&quot;')}" aria-label="${s.name.replace(/"/g, '&quot;')}"${s === cur ? ' aria-current="true"' : ''}><i></i></button>`).join('')
    }
  }
  const onStripClick = (e: Event) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b) return
    const key = b.dataset.key!
    onSide() // expand, then open the real row once the host renders it again
    let tries = 0
    const open = () => {
      const row = d.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(key)}"]`)
      if (row) { row.scrollIntoView({ block: 'nearest' }); if (row.getAttribute('aria-expanded') !== 'true') row.click(); return }
      if (++tries < 20) win.setTimeout(open, 50)
    }
    win.setTimeout(open, 60)
  }
  const onStripOver = (e: Event) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b) return
    const r = b.getBoundingClientRect(), u = ui.getBoundingClientRect()
    tip.textContent = b.getAttribute('aria-label') || ''
    tip.style.left = `${r.right - u.left + 14}px`; tip.style.top = `${r.top - u.top + r.height / 2 - 16}px`; tip.classList.add('show')
  }
  const onStripOut = () => tip.classList.remove('show')
  strip.addEventListener('click', onStripClick)
  strip.addEventListener('pointerover', onStripOver)
  strip.addEventListener('focusin', onStripOver)
  strip.addEventListener('pointerout', onStripOut)
  strip.addEventListener('focusout', onStripOut)

  /* ------------------------------------------------------------ P4G: red string from each case folder's pin to its notes */
  const strings = ui.querySelector<SVGSVGElement>('.p4g-strings')
  let stringSig = ''
  const drawStrings = () => {
    if (!strings) return
    const area = frame.querySelector<HTMLElement>('[class*="_sidebarCol"] [class*="_scrollArea"], [class*="_sidebarCol"] [class*="_regionArea"]')
    if (!area || collapsed()) { if (stringSig) { strings.innerHTML = ''; stringSig = '' } return }
    const u = ui.getBoundingClientRect(), a = area.getBoundingClientRect()
    const top = a.top - u.top, bottom = a.bottom - u.top
    let pin: { x: number, y: number } | null = null, open = false, out = ''
    for (const row of Array.from(area.querySelectorAll<HTMLElement>('[data-row-key^="workspace:"], [data-row-key^="session:"]'))) {
      const r = row.getBoundingClientRect()
      if (row.getAttribute('data-row-key')!.startsWith('workspace:')) {
        pin = { x: r.right - u.left - 30, y: r.top - u.top + 1 }; open = row.getAttribute('aria-expanded') === 'true'; continue
      }
      if (!pin || !open || !r.height) continue
      const x = r.left - u.left + r.width / 2, y = r.top - u.top - 4
      if (y < top - 40 || y > bottom + 40) continue
      const sel = row.getAttribute('aria-selected') === 'true' || /_selected\b/.test(row.className)
      const sag = Math.min(70, 18 + Math.abs(x - pin.x) * .18 + Math.abs(y - pin.y) * .08)
      out += `<path${sel ? ' class="sel"' : ''} d="M${pin.x.toFixed(1)} ${pin.y.toFixed(1)} Q${((pin.x + x) / 2).toFixed(1)} ${(Math.max(pin.y, y) + sag).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}"/>` + (sel ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/>` : '')
    }
    const sig = `${top}|${bottom}|${out}`
    if (sig === stringSig) return
    stringSig = sig
    strings.style.clipPath = `inset(${Math.max(0, top).toFixed(0)}px 0 ${Math.max(0, u.height - bottom).toFixed(0)}px 0)`
    strings.innerHTML = out
  }
  let stringQueued = false
  const queueStrings = () => { if (!strings || stringQueued) return; stringQueued = true; win.requestAnimationFrame(() => { stringQueued = false; drawStrings() }) }
  if (strings) frame.addEventListener('scroll', queueStrings, true)

  /* ------------------------------------------------------------ clock + Dark Hour */
  const tick = () => {
    const now = new Date(), c = personaClock(now)
    ;($('[data-k="date"]')).textContent = c.date
    ;($('[data-k="day"]')).textContent = c.darkHour ? (gold ? 'MIDNIGHT' : 'DARK HOUR') : c.day
    ;($('[data-k="period"]')).textContent = `${c.period} · ${c.time}`
    if (gold) ui.querySelector('svg[data-persona-weather]')?.setAttribute('data-persona-weather', c.weather)
    else $('.moonph').style.setProperty('--ms', `${c.moonShift * 100}%`)
    frame.toggleAttribute('data-p3r-dark', c.darkHour)
    train.setDark(c.darkHour)
  }
  tick()
  const clock = win.setInterval(tick, 20000)

  /* ------------------------------------------------------------ pointer parallax for the carriage */
  const onPointer = (e: PointerEvent) => train.pointer(e.clientX / win.innerWidth - .5, e.clientY / win.innerHeight - .5)
  win.addEventListener('pointermove', onPointer, { passive: true })

  /* ------------------------------------------------------------ opening: plunge, impact bubbles, white blooms, menu surfaces */
  let anims: Animation[] = [], timers: number[] = [], diving = false
  const bubble = (x: number, y: number, s: number, kf: Keyframe[], opts: KeyframeAnimationOptions) => {
    const b = d.createElement('i'); b.className = 'bub'; b.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px`; dive.appendChild(b)
    const a = b.animate(kf, opts); a.onfinish = () => b.remove(); anims.push(a)
  }
  const endDive = () => {
    if (!diving) return
    diving = false
    anims.forEach(a => a.cancel()); anims = []; timers.forEach(win.clearTimeout); timers = []
    dive.querySelectorAll('.bub, .foam').forEach(n => n.remove())
    dived = 0; amp = 9
    frame.removeAttribute('data-p3r-dive')
  }
  const startDive = () => {
    if (reduce || diving || gold) return
    const active = d.activeElement
    if (active && active.matches('input, textarea, [contenteditable="true"], [contenteditable=""]')) return
    diving = true
    frame.setAttribute('data-p3r-dive', 'plunge')
    dived = -(base + 400); amp = 0
    const fr = frame.getBoundingClientRect(), g = gear.getBoundingClientRect()
    const P1: [number, number] = [g.left - fr.left + g.width / 2, g.top - fr.top + g.height / 2]
    const P0: [number, number] = [P1[0] + 180, -30]
    const at = (k: number) => [P0[0] + (P1[0] - P0[0]) * k, P0[1] + (P1[1] - P0[1]) * k]
    anims.push(gear.animate([
      { transform: `translate(${P0[0] - P1[0] + 80}px, ${P0[1] - P1[1] - 900}px) rotate(18deg)`, offset: 0 },
      { transform: `translate(${P0[0] - P1[0]}px, ${P0[1] - P1[1]}px) rotate(14deg)`, offset: .12 },
      { transform: `translate(${(P0[0] - P1[0]) * .25}px, ${(P0[1] - P1[1]) * .2}px) rotate(4deg)`, offset: .42 },
      { transform: 'none', offset: 1 }], { duration: 2600, easing: 'cubic-bezier(.12,.75,.2,1)', fill: 'backwards' }))
    timers.push(win.setTimeout(() => {
      // white churn where it broke the surface
      const f = d.createElement('i'); f.className = 'foam'; f.style.cssText = `left:${P0[0] + 40}px;top:-60px`; dive.appendChild(f)
      const fa = f.animate([{ transform: 'translate(-50%,0) scale(.4)', opacity: 1 }, { transform: 'translate(-50%,0) scale(1.4, 1)', opacity: 0 }], { duration: 1300, easing: 'cubic-bezier(.1,.7,.3,1)' }); fa.onfinish = () => f.remove(); anims.push(fa)
      for (let i = 0; i < 30; i++) bubble(P0[0] + (Math.random() - .5) * 360, 10 + Math.random() * 140, 4 + Math.random() * 16,
        [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.random() - .5) * 200}px), calc(-50% - ${40 + Math.random() * 120}px)) scale(1)`, opacity: 0 }], { duration: 700 + Math.random() * 700, easing: 'ease-out' })
      // the burst that wraps the gear as it goes under
      for (let i = 0; i < 54; i++) { const [x, y] = at(Math.random() * .35), s = 10 + Math.pow(Math.random(), 1.6) * 64, a = Math.random() * 6.283, r = 60 + Math.random() * 240
        bubble(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * .9 + 160, s,
          [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 }, { transform: `translate(calc(-50% + ${Math.cos(a) * 40}px), calc(-50% + ${Math.sin(a) * 30}px)) scale(1)`, opacity: 1, offset: .08 },
           { transform: `translate(calc(-50% + ${Math.cos(a) * 70}px), calc(-50% - ${300 + Math.random() * 500}px)) scale(1.15)`, opacity: 0 }],
          { duration: 1800 + Math.random() * 1800, delay: 60 + Math.random() * 260, easing: 'cubic-bezier(.25,.2,.4,1)', fill: 'backwards' }) }
      // the column of impact bubbles left behind along the plunge
      const when = (k: number) => k < .75 ? 62 + k / .75 * 780 : 842 + (k - .75) / .25 * 1500
      for (let i = 0; i < 110; i++) { const k = Math.pow(Math.random(), .8) * .92, [x, y] = at(k), s = 8 + Math.pow(Math.random(), 2) * 60
        const ox = (Math.random() - .5) * (140 + s * 3), oy = (Math.random() - .5) * 80, up = 260 + Math.random() * 700 + (1 - k) * 200, wob = (Math.random() - .5) * 120
        bubble(x + ox, Math.max(-20, y + oy), s,
          [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .06 },
           { transform: `translate(calc(-50% + ${wob * .2}px), calc(-50% + 26px)) scale(1)`, opacity: 1, offset: .14 },
           { transform: `translate(calc(-50% + ${wob}px), calc(-50% - ${up * .45}px)) scale(1.05)`, opacity: .95, offset: .55 },
           { transform: `translate(calc(-50% - ${wob * .4}px), calc(-50% - ${up}px)) scale(1.15)`, opacity: 0 }],
          { duration: 2200 + Math.random() * 2600, delay: when(k) + Math.random() * 120, easing: 'cubic-bezier(.3,.1,.5,1)', fill: 'backwards' }) }
    }, 250))
    // the white blooms in around the gear, then the interface surfaces and the deep veil lifts
    timers.push(win.setTimeout(() => {
      const s0 = win.performance.now(), from = dived
      const bloom = (now: number) => { if (!diving) return; const k = Math.min(1, (now - s0) / 1500); dived = from * (1 - ease(k)); amp = 9 + 70 * (1 - k); if (k < 1) win.requestAnimationFrame(bloom); else { dived = 0; amp = 9 } }
      win.requestAnimationFrame(bloom)
    }, 900))
    timers.push(win.setTimeout(() => frame.setAttribute('data-p3r-dive', 'surface'), 2000))
    timers.push(win.setTimeout(endDive, 4300))
  }
  const skip = () => { if (diving) endDive() }
  win.addEventListener('pointerdown', skip, true)
  win.addEventListener('keydown', skip, true)

  /* ------------------------------------------------------------ loop + observers */
  let raf = 0, last = 0, disposed = false
  const loop = (now: number) => {
    if (disposed) return
    if (now - last > 32) {
      last = now
      if (Math.abs(target - base) > .5) base += (target - base) * (reduce ? 1 : .2); else base = target
      drawSeam(now)
    }
    raf = win.requestAnimationFrame(loop)
  }
  const sync = () => { measure(); syncMenu(); syncSpaces(); chrome.sync(); queueStrings(); sideBtn.setAttribute('aria-label', collapsed() ? '展开侧栏' : '收起侧栏'); sideBtn.classList.toggle('is-collapsed', collapsed()) }
  let queued = false
  const schedule = () => { if (queued || disposed) return; queued = true; win.requestAnimationFrame(() => { queued = false; if (!disposed) sync() }) }
  // host changes only: our own writes (frame vars, seam paths, overlay) never feed back into a sync
  const relevant = (r: MutationRecord) => {
    const t = r.target as Element
    if (t === frame) return r.attributeName === 'data-sidebar-collapsed' || r.attributeName === 'data-sidebar-drawer' || r.attributeName === 'data-rightbar-collapsed' || r.type === 'childList'
    return !t.closest?.('[data-conversation-scroll], [data-conversation-content], .p3r-back, .p3r-ui')
  }
  const mo = new win.MutationObserver(records => { if (records.some(relevant)) schedule() })
  mo.observe(frame, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current', 'aria-expanded', 'aria-selected', 'class', 'data-sidebar-collapsed', 'data-sidebar-drawer', 'data-rightbar-collapsed'] })
  // the drag handle's inline left is the user's sidebar width
  const handleMo = new win.MutationObserver(schedule)
  const handleEl = frame.querySelector(':scope > [data-side="sidebar"]')
  if (handleEl) handleMo.observe(handleEl, { attributes: true, attributeFilter: ['style'] })
  const ro = new win.ResizeObserver(schedule); ro.observe(frame)
  sync(); base = target; drawSeam(win.performance.now())
  if (!reduce) raf = win.requestAnimationFrame(loop)
  startDive()

  return () => {
    disposed = true
    endDive()
    win.cancelAnimationFrame(raf); win.clearInterval(clock)
    mo.disconnect(); handleMo.disconnect(); ro.disconnect()
    win.removeEventListener('pointermove', onPointer)
    win.removeEventListener('pointerdown', skip, true); win.removeEventListener('keydown', skip, true)
    frame.removeEventListener('scroll', queueStrings, true)
    captionMo.disconnect()
    chrome.dispose()
    train.dispose()
    back.remove()
    ui.innerHTML = ''
    frame.removeAttribute('data-p3r'); frame.removeAttribute('data-p3r-dark'); frame.removeAttribute('data-p3r-dive')
    frame.classList.remove('p3r-collapsed'); frame.style.removeProperty('--p3r-seam')
    frame.style.removeProperty('--p3r-chat-left'); frame.style.removeProperty('--p3r-col-left')
    frame.style.removeProperty('--p3r-host-side'); frame.style.removeProperty('--p3r-right')
    d.querySelectorAll('[data-p3r-now]').forEach(n => n.removeAttribute('data-p3r-now'))
  }
}
