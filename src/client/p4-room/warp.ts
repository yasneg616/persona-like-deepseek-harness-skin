/**
 * The TV-world crossing: a black / white / yellow vortex of concentric TV shapes, speed spokes,
 * halftone and tearing scanlines. It grows out of the screen until it covers the window, the
 * world is swapped underneath, then a TV-shaped hole opens onto the new world.
 */

export type WarpRect = { cx: number; cy: number; w: number; h: number }

export function tvPath(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = h * .3, bx = w * .035
  g.beginPath()
  g.moveTo(-w / 2 + r, -h / 2); g.quadraticCurveTo(0, -h / 2 - bx, w / 2 - r, -h / 2); g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  g.quadraticCurveTo(w / 2 + bx, 0, w / 2, h / 2 - r); g.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  g.quadraticCurveTo(0, h / 2 + bx, -w / 2 + r, h / 2); g.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  g.quadraticCurveTo(-w / 2 - bx, 0, -w / 2, -h / 2 + r); g.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); g.closePath()
}

const smooth = (p: number) => p * p * (3 - 2 * p)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

export function createWarp(doc: Document, win: Window, host: HTMLElement) {
  const cv = doc.createElement('canvas'); cv.className = 'dsh-p4-warp'; cv.setAttribute('aria-hidden', 'true'); host.append(cv)
  const g = cv.getContext('2d')
  const dotC = doc.createElement('canvas'); dotC.width = dotC.height = 10
  { const d = dotC.getContext('2d'); if (d) { d.fillStyle = '#000'; d.beginPath(); d.arc(5, 5, 2.3, 0, 7); d.fill() } }
  const dots = g?.createPattern(dotC, 'repeat') ?? null
  const spokes = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, w: .006 + Math.random() * .016, r: Math.random(), y: Math.random() < .18 }))
  let raf = 0, run: { t0: number; from: WarpRect; swapped: boolean; onSwap: () => void; done: () => void } | null = null

  const paint = (W: number, H: number, t: number, sc: number) => {
    if (!g) return
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1
    g.fillStyle = '#060606'; g.fillRect(0, 0, W, H)
    const grow = 1 - Math.pow(1 - Math.min(1, t / .4), 3), fall = t * 1.8
    g.save(); g.translate(W / 2, H / 2)
    for (let i = 21; i >= 0; i--) {
      const k = i + (fall % 1), idx = i - Math.floor(fall), s = 12 * sc * Math.pow(1.27, k) * (.25 + .75 * grow), m = ((idx % 8) + 8) % 8
      g.save(); g.rotate(k * .19 + t * 1.1); tvPath(g, s * 1.36, s)
      g.fillStyle = m === 0 ? '#ffd400' : (m % 2 ? '#0a0a0a' : '#f3efe4'); g.fill()
      g.lineWidth = Math.max(1.5, s * .014); g.strokeStyle = '#000'; g.stroke(); g.restore()
    }
    g.rotate(-t * .7)
    for (const l of spokes) {
      if (Math.random() < .2) continue
      const r0 = (70 + l.r * 200) * sc, r1 = r0 + (300 + l.r * 420) * sc
      g.beginPath(); g.moveTo(Math.cos(l.a - l.w) * r1, Math.sin(l.a - l.w) * r1); g.lineTo(Math.cos(l.a) * r0, Math.sin(l.a) * r0); g.lineTo(Math.cos(l.a + l.w) * r1, Math.sin(l.a + l.w) * r1); g.closePath()
      g.fillStyle = l.y ? 'rgba(255,212,0,.9)' : 'rgba(255,255,255,.5)'; g.fill()
    }
    g.restore()
    const cr = (44 + Math.sin(t * 10) * 7) * sc, rg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, cr * 2.3)
    rg.addColorStop(0, 'rgba(255,255,240,1)'); rg.addColorStop(.35, 'rgba(255,212,0,.85)'); rg.addColorStop(1, 'rgba(255,212,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H)
    if (dots) { g.globalAlpha = .2; g.fillStyle = dots; g.fillRect(0, 0, W, H); g.globalAlpha = 1 }
    for (let q = 0; q < 3; q++) if (Math.random() < .3) { const y = Math.random() * H, hh = 6 + Math.random() * 28; g.drawImage(cv, 0, y, W, hh, (Math.random() - .5) * 70, y, W, hh) }
  }

  const step = (now: number) => {
    raf = 0
    if (!run || !g) return
    const W = cv.width, H = cv.height, t = (now - run.t0) / 1000, COVER = .45, HOLD = .1, REVEAL = .7, f = run.from
    const sc = Math.max(W, H) / 1100
    paint(W, H, t + .6, 1.35 * sc)
    g.save()
    if (t < COVER) {
      const e = smooth(t / COVER), big = Math.max(W, H) * 2.1
      g.globalCompositeOperation = 'destination-in'; g.translate(lerp(f.cx, W / 2, e), lerp(f.cy, H / 2, e)); tvPath(g, lerp(f.w, big * 1.36, e), lerp(f.h, big, e)); g.fill()
    } else {
      if (!run.swapped) { run.swapped = true; run.onSwap() }
      const p = Math.min(1, Math.max(0, (t - COVER - HOLD) / REVEAL))
      if (p > 0) {
        const e = smooth(p), s = e * Math.max(W, H) * 1.25
        g.translate(W / 2, H / 2); g.rotate((1 - e) * .6)
        g.globalCompositeOperation = 'destination-out'; tvPath(g, s * 1.36, s); g.fill()
        g.globalCompositeOperation = 'source-over'; tvPath(g, s * 1.36, s); g.lineWidth = 40 * sc; g.strokeStyle = '#0a0a0a'; g.stroke(); g.lineWidth = 16 * sc; g.strokeStyle = '#ffd400'; g.stroke()
      }
      if (p >= 1) { g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); cv.style.display = 'none'; const d = run.done; run = null; d(); return }
    }
    g.restore()
    raf = win.requestAnimationFrame(step)
  }

  return {
    /** `from` is the screen rect in the host's own pixels. */
    run(from: WarpRect, onSwap: () => void, done: () => void) {
      if (!g) { onSwap(); done(); return }
      const r = host.getBoundingClientRect(), dpr = Math.min(win.devicePixelRatio || 1, 1.5)
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr))
      run = { t0: performance.now(), from: { cx: from.cx * dpr, cy: from.cy * dpr, w: from.w * dpr, h: from.h * dpr }, swapped: false, onSwap, done }
      cv.style.display = 'block'
      if (!raf) raf = win.requestAnimationFrame(step)
    },
    busy: () => !!run,
    dispose() { if (raf) win.cancelAnimationFrame(raf); run = null; cv.remove() },
  }
}
