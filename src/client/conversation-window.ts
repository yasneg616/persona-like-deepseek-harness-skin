import { prefersReducedMotion } from './transition.ts'

const COLUMN = '[data-phase="active"]:has([data-conversation-scroll])'
const ERROR = '[class*="_turnErrorRow"]:has(> [data-state="error"])'
const LAYOUT = 'data-cc-window-layout'
const WINDOW = 'data-cc-attention-window'
const ENTER = 'data-cc-window-enter'
const EXIT = 'data-cc-window-exit'
const SEW_MS = 460

export function createConversationWindow(doc: Document, win: Window) {
  const errorWindow = doc.createElement('aside')
  const toolbar = doc.createElement('div')
  toolbar.className = 'dsh-cc-window-bar'
  const title = doc.createElement('strong')
  const action = doc.createElement('button')
  action.type = 'button'
  toolbar.append(title, action)
  const details = doc.createElement('div')
  details.className = 'dsh-cc-window-details'
  errorWindow.append(details)
  const chip = doc.createElement('button')
  chip.type = 'button'
  chip.className = 'dsh-cc-window-chip'
  const seam = doc.createElement('div')
  seam.className = 'dsh-cc-window-seam'
  seam.setAttribute('popover', 'manual')
  seam.setAttribute('aria-hidden', 'true')
  const seen = new Set<string | Element>()
  let column: HTMLElement | null = null
  let surface: HTMLElement | null = null
  let retracting: HTMLElement | null = null
  let sewTimer = 0
  let questionKey: string | null = null
  let failure: Element | null = null
  let minimized = false
  let previousRole: string | null = null
  let previousLabel: string | null = null

  function layout() {
    const panel = surface ?? retracting
    if (!column || !panel || minimized) return
    const rect = column.getBoundingClientRect()
    const left = Math.max(0, rect.left)
    const right = Math.min(win.innerWidth, rect.right)
    const top = Math.max(0, rect.top)
    const bottom = Math.min(win.innerHeight, rect.bottom)
    const side = right - left >= 840
    const width = side ? Math.min(400, Math.floor((right - left) * 0.36)) : Math.max(0, Math.min(540, right - left - 24))
    const height = Math.max(0, Math.min(520, side ? bottom - top - 24 : Math.floor((bottom - top) * 0.60)))
    column.style.setProperty('--cc-window-w', `${width}px`)
    column.style.setProperty('--cc-window-h', `${height}px`)
    column.style.setProperty('--cc-window-x', `${Math.round(right - width - 12)}px`)
    column.style.setProperty('--cc-window-y', `${Math.round(top + 12)}px`)
    column.style.setProperty('--cc-window-bottom', `${Math.round(win.innerHeight - bottom + 12)}px`)
    column.setAttribute(LAYOUT, side ? 'side' : 'bottom')
    const panelHeight = Math.min(height, panel.offsetHeight)
    const reserve = side ? width + 24 : panelHeight + 16
    column.style.setProperty('--cc-window-reserve', `${reserve}px`)
    column.style.setProperty('--cc-window-seam-y', `${Math.round((side ? top + 12 : bottom - panelHeight - 12) - 11)}px`)
  }

  const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null
  const copy = (zh: string, en: string) => doc.documentElement.lang.startsWith('zh') ? zh : en

  function hideSeam() {
    if (seam.matches(':popover-open')) seam.hidePopover()
    seam.remove()
  }

  function showSeam(phase: 'tear' | 'rest' | 'sew') {
    if (!column) return
    hideSeam()
    seam.setAttribute('data-cc-seam-phase', phase)
    column.append(seam)
    seam.showPopover()
  }

  function clearRetraction() {
    if (!retracting) return
    win.clearTimeout(sewTimer)
    retracting.remove()
    retracting = null
    hideSeam()
    column?.removeAttribute(LAYOUT)
  }

  function detach(keepDock = false) {
    chip.remove()
    if (!surface) return
    sizes?.unobserve(surface)
    if (surface.matches(':popover-open')) surface.hidePopover()
    surface.removeAttribute('popover')
    surface.removeAttribute(WINDOW)
    surface.removeAttribute(ENTER)
    if (previousRole === null) surface.removeAttribute('role')
    else surface.setAttribute('role', previousRole)
    if (previousLabel === null) surface.removeAttribute('aria-label')
    else surface.setAttribute('aria-label', previousLabel)
    toolbar.remove()
    if (surface === errorWindow) errorWindow.remove()
    surface = null
    if (!keepDock) {
      hideSeam()
      column?.removeAttribute(LAYOUT)
    }
  }

  function retire() {
    if (!surface || !column || minimized || prefersReducedMotion(win)) {
      detach()
      return
    }
    // A submitted question is removed by the host. Keep a purely visual sheet for its exit.
    const sheet = surface.cloneNode(true) as HTMLElement
    for (const attr of ['data-question-key', 'id', 'role', 'aria-label', ENTER]) sheet.removeAttribute(attr)
    for (const node of Array.from(sheet.querySelectorAll('[id], [autofocus]'))) {
      node.removeAttribute('id')
      node.removeAttribute('autofocus')
    }
    sheet.setAttribute(EXIT, '')
    sheet.setAttribute('aria-hidden', 'true')
    sheet.inert = true
    detach(true)
    retracting = sheet
    column.append(sheet)
    sheet.showPopover()
    layout()
    showSeam('sew')
    sewTimer = win.setTimeout(clearRetraction, SEW_MS)
  }

  function show(animate: boolean) {
    if (!surface || !column) return
    if (minimized) {
      column.setAttribute(LAYOUT, 'chip')
      column.append(chip)
      return
    }
    const play = animate && !prefersReducedMotion(win)
    surface.toggleAttribute(ENTER, play)
    layout()
    surface.showPopover()
    layout()
    showSeam(play ? 'tear' : 'rest')
  }

  function attach(target: HTMLElement, animate: boolean) {
    if (!column) return
    surface = target
    const question = target !== errorWindow
    const label = question ? copy('待回答', 'Question pending') : copy('本轮报错', 'Turn failed')
    title.textContent = label
    action.textContent = question ? copy('查看上下文', 'Read context') : copy('确认', 'Acknowledge')
    chip.textContent = question ? copy('待回答 ↗', 'Question pending ↗') : label
    previousRole = target.getAttribute('role')
    previousLabel = target.getAttribute('aria-label')
    target.setAttribute('role', 'dialog')
    target.setAttribute('aria-label', label)
    target.setAttribute('popover', 'manual')
    target.setAttribute(WINDOW, question ? 'question' : 'error')
    target.prepend(toolbar)
    if (!question) column.append(target)
    sizes?.observe(target)
    show(animate)
  }

  action.addEventListener('click', () => {
    if (surface === errorWindow) {
      failure = null
      retire()
    } else if (surface && column) {
      minimized = true
      surface.hidePopover()
      hideSeam()
      surface.removeAttribute(ENTER)
      show(false)
      chip.focus({ preventScroll: true })
    }
  })
  chip.addEventListener('click', () => {
    minimized = false
    chip.remove()
    show(false)
    action.focus({ preventScroll: true })
  })
  win.addEventListener('resize', layout)

  function reset() {
    clearRetraction()
    detach()
    sizes?.disconnect()
    for (const property of ['w', 'h', 'x', 'y', 'bottom', 'reserve', 'seam-y']) {
      column?.style.removeProperty(`--cc-window-${property}`)
    }
    seen.clear()
    questionKey = null
    failure = null
    minimized = false
  }

  return {
    sync(live: boolean) {
      if (typeof errorWindow.showPopover !== 'function') return
      const next = doc.querySelector<HTMLElement>(COLUMN)
      if (!live || next !== column) {
        reset()
        column = next
        if (column) sizes?.observe(column, { box: 'border-box' })
        live = false
      }
      if (!column) return
      const tail = column.querySelector('[data-chat-flow] > :nth-last-child(1 of [data-chat-turn])')
      let newFailure = false
      for (const card of Array.from(column.querySelectorAll(ERROR))) {
        const flow = card.closest('[data-chat-flow-key]')
        const id = flow?.getAttribute('data-chat-flow-key') || card
        // Loading earlier messages can add errors above the current turn.
        const atTail = !tail || (flow && flow.getAttribute('data-chat-turn') === tail.getAttribute('data-chat-turn'))
        if (live && !seen.has(id) && atTail) {
          failure = card
          newFailure = true
        }
        seen.add(id)
      }
      if (newFailure && failure) {
        details.replaceChildren()
        for (const [selector, tag] of [['[class*="_turnErrorTitle"]', 'h2'], ['[class*="_turnErrorMessage"]', 'p'], ['[class*="_turnErrorCode"]', 'code']]) {
          const text = failure.querySelector(selector)?.textContent?.trim()
          if (!text) continue
          const node = doc.createElement(tag)
          node.textContent = text
          details.append(node)
        }
      }
      const question = column.querySelector<HTMLElement>('[data-question-key]')
      const key = question?.getAttribute('data-question-key') ?? null
      const newQuestion = key !== questionKey
      questionKey = key
      const target = question ?? (failure ? errorWindow : null)
      if (!target) {
        if (surface) retire()
        minimized = false
        return
      }
      if (newQuestion) minimized = false
      if (target !== surface || (question && newQuestion)) {
        clearRetraction()
        detach()
        attach(target, live && (question ? newQuestion : true))
      } else if (newFailure && target === errorWindow) {
        layout()
      }
    },
    dispose() {
      reset()
      win.removeEventListener('resize', layout)
    },
  }
}
