/** Decorative P3 route choreography. No model/network calls, polling or chat observation. */
export function createP3Scene(doc: Document, win: Window, frame: HTMLElement) {
  let previous = '', turn = false
  const decorated = new Set<HTMLElement>()
  const clear = () => {
    for (const node of decorated) { node.querySelector(':scope > .dsh-p3-record-page')?.remove(); node.removeAttribute('data-p3-secondary') }
    decorated.clear()
  }
  const visibility = () => doc.documentElement.toggleAttribute('data-p3-suspended', doc.hidden)
  const quiet = (event: Event) => {
    if (doc.documentElement.dataset.dshPersona === 'p3' && (event.target as Element)?.closest('input,textarea,[contenteditable="true"]')) frame.setAttribute('data-p3-quiet', '')
  }
  const sync = () => {
    if (doc.documentElement.dataset.dshPersona !== 'p3') {
      clear(); previous = ''; frame.removeAttribute('data-p3-route-motion'); frame.removeAttribute('data-p3-quiet'); return
    }
    for (const node of decorated) if (!node.isConnected) { node.removeAttribute('data-p3-secondary'); node.querySelector(':scope > .dsh-p3-record-page')?.remove(); decorated.delete(node) }
    const selected = frame.querySelector('[data-cc-leaf][aria-current="page"]')
    const route = selected?.getAttribute('data-cc-i') ?? '0'
    if (route !== previous) {
      previous = route; turn = !turn
      frame.setAttribute('data-p3-route-motion', turn ? 'a' : 'b')
      frame.removeAttribute('data-p3-quiet')
    }
    if (route === '0') { clear(); return }
    const main = Array.from(frame.children).find(node =>
      !node.matches('[data-shell-overlay],.dsh-persona-art') && !node.querySelector('[data-sidebar-toggle]') &&
      (node.matches('main,[role="main"]') || node.querySelector('[data-plugin-package],main,[role="main"],h1,h2'))) as HTMLElement | undefined
    if (!main) return
    main.setAttribute('data-p3-secondary', '')
    let record = main.querySelector<HTMLElement>(':scope > .dsh-p3-record-page')
    if (!record) {
      record = doc.createElement('div'); record.className = 'dsh-p3-record-page'; record.setAttribute('aria-hidden', 'true')
      record.append(doc.createElement('span')); main.append(record); decorated.add(main)
    }
    const label = main.querySelector('h1,h2')?.textContent?.trim() || selected?.getAttribute('aria-label') || 'PANEL'
    const caption = 'SECTION / ' + label.toUpperCase()
    if (record.firstElementChild!.textContent !== caption) record.firstElementChild!.textContent = caption
  }
  doc.addEventListener('visibilitychange', visibility)
  frame.addEventListener('input', quiet, true)
  visibility()
  return { sync, dispose() { clear(); doc.removeEventListener('visibilitychange', visibility); frame.removeEventListener('input', quiet, true); frame.removeAttribute('data-p3-route-motion'); frame.removeAttribute('data-p3-quiet'); doc.documentElement.removeAttribute('data-p3-suspended') } }
}
