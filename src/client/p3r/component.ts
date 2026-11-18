import { createElement, useEffect, useRef } from 'react'
import { mountP3R } from './overlay.ts'

/** shell.overlay contribution for P3 mode: mounts the P3R layers into the app frame. */
export function P3ROverlay() {
  const ref = useRef<HTMLDivElement>(null)
  // a passive effect, like the P5/P4 overlays: React runs every unmount cleanup of the outgoing
  // overlay before this setup, so their caption cleanup can never undo ours on a runtime skin switch
  useEffect(() => {
    const ui = ref.current
    const frame = ui?.closest('[data-shell-overlay]')?.parentElement
    if (!ui || !frame) return
    return mountP3R(ui.ownerDocument, ui.ownerDocument.defaultView ?? window, ui, frame as HTMLElement)
  }, [])
  return createElement('div', { className: 'p3r-ui', ref })
}
