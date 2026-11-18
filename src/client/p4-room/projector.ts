/** Pure math for laying the native conversation column onto the 3D TV screen. No DOM, no three.js. */

export type Pt = { x: number; y: number }
export type Quad = [Pt, Pt, Pt, Pt] // top-left, top-right, bottom-right, bottom-left
export type Box = { left: number; top: number; width: number; height: number }

/**
 * CSS matrix3d (column-major, transform-origin 0 0) that maps the element's own
 * rect [0,w]×[0,h] onto `quad`, given in the same coordinates as the element's
 * untransformed top-left (i.e. quad points minus the element's layout origin).
 * Returns null when the quad is degenerate.
 */
export function quadMatrix(w: number, h: number, q: Quad): number[] | null {
  if (!(w > 0 && h > 0)) return null
  const [p0, p1, p2, p3] = q
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y
  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, k: number
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = p1.x - p0.x; b = p3.x - p0.x; c = p0.x
    d = p1.y - p0.y; e = p3.y - p0.y; f = p0.y
    g = 0; k = 0
    if (Math.abs(a * e - b * d) < 1e-9) return null
  } else {
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y
    const det = dx1 * dy2 - dx2 * dy1
    if (Math.abs(det) < 1e-9) return null
    g = (sx * dy2 - dx2 * sy) / det
    k = (dx1 * sy - sx * dy1) / det
    a = p1.x - p0.x + g * p1.x; b = p3.x - p0.x + k * p3.x; c = p0.x
    d = p1.y - p0.y + g * p1.y; e = p3.y - p0.y + k * p3.y; f = p0.y
  }
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1]
  return m.every(Number.isFinite) ? m : null
}

export function matrixCss(m: number[]): string {
  return `matrix3d(${m.map(v => +v.toFixed(6)).join(',')})`
}

/** Largest deviation (px) of a quad from the untransformed rect; used to drop to `transform: none` at rest. */
export function quadDeviation(w: number, h: number, q: Quad): number {
  const rest: Quad = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]
  return Math.max(...q.map((p, i) => Math.hypot(p.x - rest[i].x, p.y - rest[i].y)))
}

/**
 * The 4:3 box the conversation column occupies inside its grid cell, as margins.
 * It leaves a band of the room (TV bezel, blurred wall) visible around it.
 */
export function screenMargins(cellW: number, cellH: number, aspect = 4 / 3): { mx: number; my: number; w: number; h: number } {
  const h = Math.max(200, Math.min(cellH * 0.9, (cellW * 0.94) / aspect))
  const w = h * aspect
  return { mx: Math.max(0, Math.round((cellW - w) / 2)), my: Math.max(0, Math.round((cellH - h) / 2)), w: Math.round(w), h: Math.round(h) }
}

/**
 * Straight-on camera that makes a fronto-parallel screen of physical height `screenH`
 * centred at (sx, sy, sz) land exactly on `box` in a canvas of size cw×ch.
 */
export function deskCamera(box: Box, cw: number, ch: number, fovDeg: number, screenH: number, s: { x: number; y: number; z: number }) {
  const t = Math.tan((fovDeg * Math.PI) / 360)
  const dist = (screenH / (2 * t)) * (ch / box.height)
  const k = (2 * dist * t) / ch
  const ox = box.left + box.width / 2 - cw / 2, oy = box.top + box.height / 2 - ch / 2
  const pos = { x: s.x - ox * k, y: s.y + oy * k, z: s.z + dist }
  return { pos, tgt: { x: pos.x, y: pos.y, z: pos.z - 1 } }
}

/** Stable pleasant hue index for a session id (no text is read; ids only). */
export function hashIndex(id: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % n + n) % n
}
