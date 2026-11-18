import { createP3ChromeMotion } from './p3-chrome-motion.ts'
/** Styles existing rc3 controls; never invokes bridges or creates/replaces buttons. */
import { P3_DOCUMENT_CSS, P3_SHADOW_CSS } from './p3-chrome-style.ts'
const HOSTS = '[data-windows-menu], [data-industrial-caption-fallback]'
const STYLE = 'data-dsh-p3-chrome-style'
type Entry = { host: HTMLElement, root: ShadowRoot | null, style: HTMLStyleElement | null, observer: MutationObserver | null, oldHost: string | null, buttons: Map<HTMLButtonElement, string | null> }
export function nativeCaptionAction(button: HTMLButtonElement): string | null {
  const label = ['data-action', 'aria-label', 'title'].map(a => button.getAttribute(a) || '').join(' ').toLowerCase()
  if (/(?:\bclose\b|关闭|關閉)/.test(label)) return 'close'
  if (/(?:\bminimi[sz]e\b|最小化)/.test(label)) return 'minimize'
  if (/(?:\bmaximi[sz]e\b|\brestore\b|最大化|还原|還原|窗口化|視窗化)/.test(label)) return 'maximize'
  return null // Unknown native glyphs remain neutral; never infer "last button = close".
}
export function mountP3Chrome(documentRef: Document): () => void {
  const win = documentRef.defaultView
  if (!win) return () => {}
  const root = documentRef.documentElement
  const motion = createP3ChromeMotion(documentRef)
  const entries = new Map<HTMLElement, Entry>()
  let style: HTMLStyleElement | null = null, bed: HTMLDivElement | null = null, disposed = false, queued = false
  const restore = (node: Element, key: string, value: string | null) => value === null ? node.removeAttribute(key) : node.setAttribute(key, value)
  const decorate = (entry: Entry) => {
    if (!entry.root) return
    for (const [b, old] of entry.buttons) if (!entry.root.contains(b)) { restore(b, 'data-dsh-p3-action', old); entry.buttons.delete(b) }
    for (const b of Array.from(entry.root.querySelectorAll<HTMLButtonElement>('button'))) {
      const action = nativeCaptionAction(b)
      if (action && !entry.buttons.has(b)) entry.buttons.set(b, b.getAttribute('data-dsh-p3-action'))
      if (action) { if (b.getAttribute('data-dsh-p3-action') !== action) b.setAttribute('data-dsh-p3-action', action) }
      else if (entry.buttons.has(b)) { restore(b, 'data-dsh-p3-action', entry.buttons.get(b)!); entry.buttons.delete(b) }
    }
  }
  const removeEntry = (entry: Entry) => {
    entry.observer?.disconnect(); entry.style?.remove()
    restore(entry.host, 'data-dsh-p3-native', entry.oldHost)
    for (const [b, old] of entry.buttons) restore(b, 'data-dsh-p3-action', old)
    entries.delete(entry.host)
  }
  const clear = () => { for (const e of [...entries.values()]) removeEntry(e); style?.remove(); bed?.remove(); style = null; bed = null }
  const sync = () => {
    queued = false
    if (disposed) return
    if (root.getAttribute('data-dsh-persona') !== 'p3') { clear(); motion.sync(); return }
    if (!style) { style = documentRef.createElement('style'); style.setAttribute(STYLE, 'document'); style.textContent = P3_DOCUMENT_CSS; documentRef.head.append(style) }
    if (!root.hasAttribute('data-windows-titlebar') && bed) { bed.remove(); bed = null }
    if (root.hasAttribute('data-windows-titlebar') && !bed && documentRef.body) { bed = documentRef.createElement('div'); bed.setAttribute('data-dsh-p3-caption-bed', ''); bed.setAttribute('aria-hidden', 'true'); documentRef.body.prepend(bed) }
    for (const entry of [...entries.values()]) if (!entry.host.isConnected) removeEntry(entry)
    for (const host of Array.from(documentRef.querySelectorAll<HTMLElement>(HOSTS))) {
      if (entries.has(host)) continue
      const shadow = host.shadowRoot, entry: Entry = {host, root: shadow, style: null, observer: null, oldHost: host.getAttribute('data-dsh-p3-native'), buttons: new Map()}
      entries.set(host, entry); host.setAttribute('data-dsh-p3-native', host.hasAttribute('data-windows-menu') ? 'menu' : 'caption')
      if (shadow) {
        const s = documentRef.createElement('style'); s.setAttribute(STYLE, 'shadow'); s.textContent = P3_SHADOW_CSS; shadow.append(s); entry.style = s
        entry.observer = new win.MutationObserver(() => decorate(entry)); entry.observer.observe(shadow, {subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label', 'title', 'data-action']}); decorate(entry)
      }
      // Closed/unavailable roots retain all original internals and behavior.
    }
    motion.sync()
  }
  const schedule = () => { if (!queued && !disposed) { queued = true; queueMicrotask(sync) } }
  const observer = new win.MutationObserver(records => {
    if (records.some(r => r.type === 'attributes' || [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)].some(n => n instanceof win.Element && (n.matches(HOSTS) || !!n.querySelector(HOSTS))))) schedule()
  })
  observer.observe(root, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-dsh-persona', 'data-windows-titlebar', 'data-p3-native-layout']})
  sync()
  return () => { disposed = true; observer.disconnect(); motion.dispose(); clear() }
}
