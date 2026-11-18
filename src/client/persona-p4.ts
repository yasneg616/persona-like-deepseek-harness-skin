import { mountChrome, type Chrome } from './chrome.ts'
import { clearNavLeaves, sidebarColumn } from './leaves.ts'

/** P4 mode entry belongs to the whole app: Midnight Channel CRT warm-up and
 * SMPTE color-bar sweep outside AppFrame's animated containing block.
 * Never intercepts pointer events; typing or reduced motion settles it immediately. */
export function createP4Immersion(documentRef: Document, windowRef: Window) {
  const html = documentRef.documentElement
  const media = windowRef.matchMedia('(prefers-reduced-motion: reduce)')
  const broadcast = documentRef.createElement('div')
  broadcast.className = 'dsh-persona-p4-immersion'
  broadcast.setAttribute('aria-hidden', 'true')
  broadcast.innerHTML = `<div class="dsh-p4-tv-mass"><div class="dsh-p4-color-bars"></div><div class="dsh-p4-portal-rings"></div><div class="dsh-p4-scan-beam"></div><i class="dsh-p4-entry-glint"></i><i class="dsh-p4-entry-glint"></i><i class="dsh-p4-entry-glint"></i></div>`
  let last = ''
  let timer: number | undefined
  const settle = () => {
    if (timer !== undefined) windowRef.clearTimeout(timer)
    timer = undefined
    if (html.dataset.dshPersona === 'p4') html.setAttribute('data-p4-immersion', 'settled')
    broadcast.remove()
  }
  const sync = () => {
    const mode = html.dataset.dshPersona ?? ''
    if (mode === last) return
    last = mode
    settle()
    html.removeAttribute('data-p4-immersion')
    if (mode !== 'p4') return
    if (media.matches) { html.setAttribute('data-p4-immersion', 'settled'); return }
    documentRef.body.append(broadcast)
    html.setAttribute('data-p4-immersion', 'enter')
    timer = windowRef.setTimeout(settle, 3800)
  }
  const motion = () => { if (media.matches) settle() }
  const observer = new (documentRef.defaultView!.MutationObserver)(sync)
  observer.observe(html, { attributes: true, attributeFilter: ['data-dsh-persona'] })
  media.addEventListener('change', motion)
  documentRef.addEventListener('beforeinput', settle, true)
  sync()
  return () => {
    if (timer !== undefined) windowRef.clearTimeout(timer)
    observer.disconnect()
    media.removeEventListener('change', motion)
    documentRef.removeEventListener('beforeinput', settle, true)
    html.removeAttribute('data-p4-immersion')
    broadcast.remove()
  }
}

/** Decorative P4 broadcast choreography and rc3 native sidebar layout compatibility.
 * No model/network calls, polling or chat observation. */
export function createP4Scene(doc: Document, win: Window, frame: HTMLElement) {
  let previous = '', turn = false
  let chrome: Chrome | null = null
  let chromeRoot: HTMLElement | null = null
  const decorated = new Set<HTMLElement>()
  const clear = () => {
    for (const node of decorated) { node.querySelector(':scope > .dsh-p4-broadcast-page')?.remove(); node.removeAttribute('data-p4-secondary') }
    decorated.clear()
  }
  const teardownChrome = () => {
    chrome?.dispose()
    chrome = null
    chromeRoot?.remove()
    chromeRoot = null
  }
  const ensureChrome = () => {
    const overlay = frame.querySelector<HTMLElement>(':scope > [data-shell-overlay]')
    if (!overlay) return
    if (!chromeRoot || !chromeRoot.isConnected) {
      chromeRoot = doc.createElement('div')
      chromeRoot.className = 'dsh-persona-p4-chrome'
      chromeRoot.innerHTML =
        `<div class="dsh-persona-p4-drag" aria-hidden="true"></div>` +
        `<div class="dsh-cc-menus" role="menubar" aria-label="菜单栏">` +
          `<button type="button" class="dsh-cc-menu" data-menu="application" aria-haspopup="menu" aria-expanded="false"><span class="dsh-cc-menu-label">应用</span><small class="dsh-p4-menu-tag">CH·01</small></button>` +
          `<button type="button" class="dsh-cc-menu" data-menu="edit" aria-haspopup="menu" aria-expanded="false"><span class="dsh-cc-menu-label">编辑</span><small class="dsh-p4-menu-tag">CH·02</small></button>` +
        `</div>` +
        `<div class="dsh-cc-wins" role="group" aria-label="窗口控制">` +
          `<button type="button" class="dsh-cc-win dsh-cc-win-min" data-win="minimize" aria-label="最小化"><i class="dsh-p4-win-glyph" aria-hidden="true"></i></button>` +
          `<button type="button" class="dsh-cc-win dsh-cc-win-max" data-win="maximize" aria-label="最大化"><i class="dsh-p4-win-glyph" aria-hidden="true"></i></button>` +
          `<button type="button" class="dsh-cc-win dsh-cc-win-close" data-win="close" aria-label="关闭"><i class="dsh-p4-win-glyph" aria-hidden="true"></i></button>` +
        `</div>`
      overlay.append(chromeRoot)
      chrome = mountChrome(doc, win, chromeRoot)
    } else {
      chrome?.sync()
    }
  }
  const syncCollapsedRail = () => {
    const side = sidebarColumn(doc)
    if (!side || !frame.hasAttribute('data-sidebar-collapsed') || frame.hasAttribute('data-sidebar-drawer')) return
    const railButtons = Array.from(side.querySelectorAll<HTMLButtonElement>('button.wtg9ga_newSession, button.wtg9ga_panelRow, .GAkraW_rail button, .wtg9ga_footArea button'))
    railButtons.forEach((btn, idx) => {
      const ch = String(idx + 1).padStart(2, '0')
      if (btn.getAttribute('data-p4-ch') !== ch) btn.setAttribute('data-p4-ch', ch)
    })
  }
  const syncNativeLayout = () => {
    const side = sidebarColumn(doc)
    const native = side?.querySelector('.wtg9ga_scrollRegion')
    if (doc.documentElement.dataset.dshPersona !== 'p4' || !side || !native) {
      frame.removeAttribute('data-p4-native-layout')
      return
    }
    frame.setAttribute('data-p4-native-layout', 'rc3')
    if (frame.hasAttribute('data-sidebar-collapsed') && !frame.hasAttribute('data-sidebar-drawer')) {
      clearNavLeaves(doc)
      return
    }
    clearNavLeaves(doc)
    const buttons = Array.from(side.querySelectorAll<HTMLButtonElement>('button.wtg9ga_newSession, button.wtg9ga_panelRow'))
    buttons.forEach((button, index) => {
      const label = (button.querySelector('.wtg9ga_newSessionLabel, .wtg9ga_panelTitle')?.textContent || button.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()
      button.setAttribute('data-cc-leaf', '')
      button.setAttribute('data-cc-label', label)
      button.setAttribute('data-cc-i', String(index))
      button.setAttribute('data-cc-num', String(index + 1).padStart(2, '0'))
      button.style.setProperty('--cc-i', String(index))
    })
  }
  const visibility = () => doc.documentElement.toggleAttribute('data-p4-suspended', doc.hidden)
  const quiet = (event: Event) => {
    if (doc.documentElement.dataset.dshPersona === 'p4' && (event.target as Element)?.closest('input,textarea,[contenteditable="true"]')) frame.setAttribute('data-p4-quiet', '')
  }
  const sync = () => {
    if (doc.documentElement.dataset.dshPersona !== 'p4') {
      teardownChrome()
      clear(); previous = ''; frame.removeAttribute('data-p4-native-layout'); frame.removeAttribute('data-p4-route-motion'); frame.removeAttribute('data-p4-quiet'); return
    }
    ensureChrome()
    syncNativeLayout()
    syncCollapsedRail()
    for (const node of decorated) if (!node.isConnected) { node.removeAttribute('data-p4-secondary'); node.querySelector(':scope > .dsh-p4-broadcast-page')?.remove(); decorated.delete(node) }
    const selected = frame.querySelector('[data-cc-leaf][aria-current="page"]')
    const route = selected?.getAttribute('data-cc-i') ?? '0'
    if (route !== previous) {
      previous = route; turn = !turn
      frame.setAttribute('data-p4-route-motion', turn ? 'a' : 'b')
      frame.removeAttribute('data-p4-quiet')
    }
    if (route === '0') { clear(); return }
    const main = Array.from(frame.children).find(node =>
      !node.matches('[data-shell-overlay],.dsh-persona-art') && !node.querySelector('[data-sidebar-toggle]') &&
      (node.matches('main,[role="main"]') || node.querySelector('[data-plugin-package],main,[role="main"],h1,h2'))) as HTMLElement | undefined
    if (!main) return
    main.setAttribute('data-p4-secondary', '')
    let broadcast = main.querySelector<HTMLElement>(':scope > .dsh-p4-broadcast-page')
    if (!broadcast) {
      broadcast = doc.createElement('div'); broadcast.className = 'dsh-p4-broadcast-page'; broadcast.setAttribute('aria-hidden', 'true')
      broadcast.append(doc.createElement('span')); main.append(broadcast); decorated.add(main)
    }
    const label = main.querySelector('h1,h2')?.textContent?.trim() || selected?.getAttribute('aria-label') || 'CHANNEL'
    const caption = 'CHANNEL / ' + label.toUpperCase()
    if (broadcast.firstElementChild!.textContent !== caption) broadcast.firstElementChild!.textContent = caption
  }
  doc.addEventListener('visibilitychange', visibility)
  frame.addEventListener('input', quiet, true)
  visibility()
  return {
    sync,
    dispose() {
      teardownChrome()
      clear()
      doc.removeEventListener('visibilitychange', visibility)
      frame.removeEventListener('input', quiet, true)
      frame.removeAttribute('data-p4-native-layout')
      frame.removeAttribute('data-p4-route-motion')
      frame.removeAttribute('data-p4-quiet')
      doc.documentElement.removeAttribute('data-p4-suspended')
    },
  }
}

/** Confirmed native binding transitions for P4 channel switches only.
 * Never reads conversation text or intercepts navigation. */
type Binding = { page: string; session: string }
export function createP4RouteSplash(doc: Document, win: Window, frame: HTMLElement) {
  const root = doc.documentElement
  const layer = doc.createElement('div')
  layer.className = 'dsh-persona-route-splash dsh-p4-route-splash'; layer.setAttribute('aria-hidden', 'true'); layer.hidden = true
  for (const name of ['wake', 'glasses', 'dial', 'burst', 'rings']) {
    const part = doc.createElement('i'); part.className = 'dsh-p4-route-' + name; layer.append(part)
  }
  doc.body.append(layer)
  let last: Binding | null = null, candidate: Binding | null = null
  let pending = 0, ending = 0, active = false, disposed = false, serial = 0
  let inputAt = -Infinity, intentAt = -Infinity, composing = false
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)')
  const same = (a: Binding | null, b: Binding | null) => a?.page === b?.page && a?.session === b?.session
  const read = (): Binding | null => {
    const page = frame.querySelector('[data-cc-leaf][aria-current="page"]')?.getAttribute('data-cc-i') ?? '0'
    if (page !== '0') return { page, session: '' }
    // Actual host ConversationRoot exposes its committed Session binding here.
    // A workspace folder's aria-expanded is intentionally NOT an identity.
    const content = frame.querySelector('[data-conversation-content]')
    return content ? { page, session: content.getAttribute('data-conversation-session') ?? '' } : null
  }
  const cancel = () => {
    win.clearTimeout(pending); win.clearTimeout(ending); pending = ending = 0; candidate = null; active = false; layer.hidden = true; root.removeAttribute('data-p4-route-active')
  }
  const blocked = () => root.dataset.dshPersona !== 'p4' || root.dataset.p4Immersion === 'enter' || doc.hidden || reduced?.matches || composing || win.performance.now() - inputAt < 900
  const flush = () => {
    pending = 0; candidate = null
    const next = read(); if (!next || same(last, next)) return
    const previous = last; last = next
    if (!previous || blocked() || active) return
    if (previous.page === '0' && !previous.session && next.page === '0' && win.performance.now() - intentAt > 750) return
    active = true; root.setAttribute('data-p4-route-active', ''); layer.dataset.kind = next.page === '0' ? 'workspace' : 'page'
    layer.dataset.sequence = String(++serial); layer.hidden = false
    ending = win.setTimeout(() => { active = false; layer.hidden = true; root.removeAttribute('data-p4-route-active'); ending = 0 }, 980)
  }
  const sync = () => {
    if (disposed) return
    if (root.dataset.dshPersona !== 'p4') { cancel(); last = null; return }
    const next = read(); if (!next) return
    if (!last) { last = next; return }
    if (same(last, next) || same(candidate, next)) return
    win.clearTimeout(pending); candidate = next; pending = win.setTimeout(flush, 32)
  }
  const input = () => { inputAt = win.performance.now(); cancel(); last = read() ?? last }
  const composeStart = () => { composing = true; input() }
  const composeEnd = () => { composing = false; input() }
  const intent = (event: Event) => {
    if (event.type === 'keydown' && !['Enter', ' '].includes((event as KeyboardEvent).key)) return
    if ((event.target as Element)?.closest?.('[data-cc-leaf],[data-row-key^="session:"]')) intentAt = win.performance.now()
  }
  const visibility = () => { cancel(); last = read() ?? last }
  const motion = () => { if (reduced?.matches) cancel() }
  doc.addEventListener('beforeinput', input, true); doc.addEventListener('input', input, true)
  doc.addEventListener('compositionstart', composeStart, true); doc.addEventListener('compositionend', composeEnd, true)
  doc.addEventListener('pointerdown', intent, true); doc.addEventListener('keydown', intent, true)
  doc.addEventListener('visibilitychange', visibility); reduced?.addEventListener?.('change', motion)
  return {
    sync,
    dispose() {
      disposed = true; cancel(); layer.remove()
      doc.removeEventListener('beforeinput', input, true); doc.removeEventListener('input', input, true)
      doc.removeEventListener('compositionstart', composeStart, true); doc.removeEventListener('compositionend', composeEnd, true)
      doc.removeEventListener('pointerdown', intent, true); doc.removeEventListener('keydown', intent, true)
      doc.removeEventListener('visibilitychange', visibility); reduced?.removeEventListener?.('change', motion)
    },
  }
}
