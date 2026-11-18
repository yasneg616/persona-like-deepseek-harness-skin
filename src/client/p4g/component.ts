import { createElement, useEffect, useRef } from 'react'
import { mountP3R } from '../p3r/overlay.ts'
import { createP4Room } from '../p4-room/controller.ts'
import * as roomScene from '../p4-room/scene.ts'
import * as towerScene from '../p4-room/tower.ts'

/**
 * shell.overlay contribution for P4 mode (P4 Golden): the P3R composition in the P4G palette,
 * with the rainy-night 3D room behind it (the 2D yellow/midnight backdrop when WebGL or motion is off).
 */
export function P4GOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ui = ref.current
    const frame = ui?.closest('[data-shell-overlay]')?.parentElement as HTMLElement | null | undefined
    if (!ui || !frame) return
    const doc = ui.ownerDocument, win = doc.defaultView ?? window
    const stopUi = mountP3R(doc, win, ui, frame, 'p4g')
    const host = frame.querySelector<HTMLElement>(':scope > .p3r-back .p4g-room')
    if (!host) return stopUi
    const room = createP4Room(doc, win, frame, host, () => roomScene, () => towerScene)
    let queued = false
    const sync = () => { if (queued) return; queued = true; win.requestAnimationFrame(() => { queued = false; room.sync() }) }
    const mo = new win.MutationObserver(records => { if (records.some(r => !(r.target as Element).closest?.('[data-conversation-scroll]'))) sync() })
    mo.observe(frame, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected', 'data-content-phase', 'data-conversation-session', 'data-sidebar-collapsed', 'data-sidebar-drawer'] })
    const modes = new win.MutationObserver(() => room.sync())
    modes.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-dsh-persona'] })
    room.sync()
    return () => { mo.disconnect(); modes.disconnect(); room.dispose(); stopUi() }
  }, [])
  return createElement('div', { className: 'p3r-ui', ref })
}
