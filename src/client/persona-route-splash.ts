/** Confirmed native binding transitions only. Never reads conversation text or intercepts navigation. */
type Binding = { page: string; session: string }
export function createP3RouteSplash(doc: Document, win: Window, frame: HTMLElement) {
  const root = doc.documentElement
  const layer = doc.createElement('div')
  layer.className = 'dsh-persona-route-splash dsh-p3-route-splash'; layer.setAttribute('aria-hidden', 'true'); layer.hidden = true
  for (const name of ['wake','shard-navy','shard-cyan','shard-white','crest','rings']) {
    const part = doc.createElement('i'); part.className = 'dsh-p3-route-' + name; layer.append(part)
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
    win.clearTimeout(pending); win.clearTimeout(ending); pending = ending = 0; candidate = null; active = false; layer.hidden = true; root.removeAttribute('data-p3-route-active')
  }
  const blocked = () => root.dataset.dshPersona !== 'p3' || root.dataset.p3Immersion === 'enter' || doc.hidden || reduced?.matches || composing || win.performance.now() - inputAt < 900
  const flush = () => {
    pending = 0; candidate = null
    const next = read(); if (!next || same(last, next)) return
    const previous = last; last = next
    if (!previous || blocked() || active) return
    // Binding the very first message to an empty landing is not navigation.
    if (previous.page === '0' && !previous.session && next.page === '0' && win.performance.now() - intentAt > 750) return
    active = true; root.setAttribute('data-p3-route-active', ''); layer.dataset.kind = next.page === '0' ? 'workspace' : 'page'
    layer.dataset.sequence = String(++serial); layer.hidden = false
    ending = win.setTimeout(() => { active = false; layer.hidden = true; root.removeAttribute('data-p3-route-active'); ending = 0 }, 560)
  }
  const sync = () => {
    if (disposed) return
    if (root.dataset.dshPersona !== 'p3') { cancel(); last = null; return }
    const next = read(); if (!next) return
    if (!last) { last = next; return }
    if (same(last, next) || same(candidate, next)) return
    win.clearTimeout(pending); candidate = next; pending = win.setTimeout(flush, 32)
  }
  const input = () => { inputAt = win.performance.now(); cancel(); last = read() ?? last }
  const composeStart = () => { composing = true; input() }
  const composeEnd = () => { composing = false; input() }
  const intent = (event: Event) => {
    if (event.type === 'keydown' && !['Enter',' '].includes((event as KeyboardEvent).key)) return
    if ((event.target as Element)?.closest?.('[data-cc-leaf],[data-row-key^="session:"]')) intentAt = win.performance.now()
  }
  const visibility = () => { cancel(); last = read() ?? last }
  const motion = () => { if (reduced?.matches) cancel() }
  doc.addEventListener('beforeinput', input, true); doc.addEventListener('input', input, true)
  doc.addEventListener('compositionstart', composeStart, true); doc.addEventListener('compositionend', composeEnd, true)
  doc.addEventListener('pointerdown', intent, true); doc.addEventListener('keydown', intent, true)
  doc.addEventListener('visibilitychange', visibility); reduced?.addEventListener?.('change', motion)
  return { sync, dispose() {
    disposed = true; cancel(); layer.remove()
    doc.removeEventListener('beforeinput', input, true); doc.removeEventListener('input', input, true)
    doc.removeEventListener('compositionstart', composeStart, true); doc.removeEventListener('compositionend', composeEnd, true)
    doc.removeEventListener('pointerdown', intent, true); doc.removeEventListener('keydown', intent, true)
    doc.removeEventListener('visibilitychange', visibility); reduced?.removeEventListener?.('change', motion)
  } }
}
