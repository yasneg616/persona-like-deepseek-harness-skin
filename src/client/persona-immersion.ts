/** P3 mode entry belongs to the whole app, never to an individual message pane.
 * This layer is outside AppFrame's animated containing block, covers caption +
 * navigation + workspaces + reading + input, and never intercepts a pointer.
 * No section/content mutation restarts it. Typing settles it immediately. */
export function createP3Immersion(documentRef: Document, windowRef: Window) {
  const html = documentRef.documentElement
  const media = windowRef.matchMedia('(prefers-reduced-motion: reduce)')
  const water = documentRef.createElement('div')
  water.className = 'dsh-persona-immersion'
  water.setAttribute('aria-hidden', 'true')
  water.innerHTML = `<div class="dsh-p3-entry-wash"></div><div class="dsh-p3-entry-shards"><i class="dsh-p3-entry-shard dsh-p3-entry-shard--navy"></i><i class="dsh-p3-entry-shard dsh-p3-entry-shard--cyan"></i><i class="dsh-p3-entry-shard dsh-p3-entry-shard--white"></i><i class="dsh-p3-entry-shard dsh-p3-entry-shard--crimson"></i></div><svg class="dsh-p3-entry-surface" viewBox="0 0 1440 120" preserveAspectRatio="none"><path class="surface-glow" d="M-40 62Q260 28 560 64T1140 56T1480 44"/><path class="surface-edge" d="M-40 58Q260 24 560 60T1140 52T1480 40"/></svg><i class="dsh-p3-entry-sonar"></i><i class="dsh-p3-entry-sonar dsh-p3-entry-sonar--outer"></i>`
  let last = ''
  let timer: number | undefined
  const settle = () => {
    if (timer !== undefined) windowRef.clearTimeout(timer)
    timer = undefined
    if (html.dataset.dshPersona === 'p3') html.setAttribute('data-p3-immersion', 'settled')
    water.remove()
  }
  const sync = () => {
    const mode = html.dataset.dshPersona ?? ''
    if (mode === last) return
    last = mode
    settle()
    html.removeAttribute('data-p3-immersion')
    if (mode !== 'p3') return
    if (media.matches) { html.setAttribute('data-p3-immersion', 'settled'); return }
    documentRef.body.append(water)
    html.setAttribute('data-p3-immersion', 'enter')
    timer = windowRef.setTimeout(settle, 860)
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
    html.removeAttribute('data-p3-immersion')
    water.remove()
  }
}
