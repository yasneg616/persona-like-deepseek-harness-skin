import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The TV-world studio: a hand-stacked tower of old CRTs in yellow fog, trusses, spotlights.
 * Each untilted, unblocked, outward-facing TV can carry one conversation (title + time from
 * the sidebar row — never the chat). The tower grows upward when it runs out of free screens,
 * and once it is as tall as the rig the conversations are split into bands (one tower per band).
 * Original geometry and canvas drawing only.
 */

export type ScreenFrame = { c: THREE.Vector3; right: THREE.Vector3; normal: THREE.Vector3; w: number; h: number }
export type TowerSession = { key: string; title: string; time: string }

const LATIN = '"Anton", "Impact", "Arial Narrow", sans-serif'
const SANS = '"Microsoft JhengHei", "Microsoft YaHei", "PingFang TC", "Noto Sans TC", sans-serif'
const MAX_H = 4.4, BASE_LAYERS = 7

type Tv = { g: THREE.Group; body: THREE.Mesh; scr: THREE.Mesh; cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number; d: number; slotOK: boolean; exposed: boolean; key: string | null; ch: number }

export function createTowerScene(doc: Document) {
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x }
  const scene = new THREE.Scene()
  const FOG = new THREE.Color(0x4a3a10), FOGY = new THREE.Color(0xc9b46a)
  scene.background = FOG.clone(); scene.fog = new THREE.FogExp2(FOG.clone(), .09)
  const gm = track(new THREE.DataTexture(new Uint8Array([38, 118, 255]), 3, 1, THREE.RedFormat)); gm.minFilter = gm.magFilter = THREE.NearestFilter; gm.needsUpdate = true
  const toon = (c: number) => track(new THREE.MeshToonMaterial({ color: c, gradientMap: gm }))
  const noLine = <M extends THREE.Material>(m: M) => { m.userData.outlineParameters = { visible: false }; return track(m) }
  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
    const c = doc.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!)
    const t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t
  }
  const rng = (seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 })(20241118)
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y + h / 2, z); parent.add(m); return m
  }

  // ---------- floor, trusses, spots, cameras ----------
  const floorTex = canvasTex(1024, 1024, g => {
    g.fillStyle = '#160c12'; g.fillRect(0, 0, 1024, 1024)
    const cols = ['#ffd400', '#140a0f', '#6e1c3a', '#140a0f', '#d9a400', '#140a0f']
    for (let r = 470, i = 0; r > 10; r -= 34, i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(512, 512, r, r, 0, 0, 7); g.fill() }
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 6; for (let a = 0; a < 24; a++) { g.beginPath(); g.moveTo(512, 512); g.lineTo(512 + Math.cos(a / 24 * 6.283) * 520, 512 + Math.sin(a / 24 * 6.283) * 520); g.stroke() }
    g.strokeStyle = '#050304'; g.lineCap = 'round'
    for (let k = 0; k < 14; k++) { g.lineWidth = 5 + rng() * 7; g.beginPath(); g.moveTo(rng() * 1024, rng() * 1024); g.bezierCurveTo(rng() * 1024, rng() * 1024, rng() * 1024, rng() * 1024, rng() * 1024, rng() * 1024); g.stroke() }
  })
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(12, 12)), noLine(new THREE.MeshToonMaterial({ map: floorTex, gradientMap: gm }))); floor.rotation.x = -Math.PI / 2; scene.add(floor)
  const trussMat = toon(0xc9a32a)
  const trussGeo = (len: number) => {
    const parts: THREE.BufferGeometry[] = [], M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), e = new THREE.Euler()
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); e.set(0, 0, rz); q.setFromEuler(e); M.compose(new THREE.Vector3(x, y, z), q, sc); g.applyMatrix4(M); parts.push(g) }
    ;[[-.14, -.14], [.14, -.14], [-.14, .14], [.14, .14]].forEach(([x, z]) => add(.035, len, .035, x, len / 2, z))
    for (let y = 0, i = 0; y < len - .1; y += .3, i++) {
      add(.28, .025, .025, 0, y, -.14); add(.28, .025, .025, 0, y, .14); add(.025, .025, .28, -.14, y, 0); add(.025, .025, .28, .14, y, 0)
      const a = i % 2 ? .76 : -.76; add(.022, .4, .022, 0, y + .15, -.14, a); add(.022, .4, .022, 0, y + .15, .14, -a)
    }
    const merged = track(mergeGeometries(parts)); parts.forEach(p => p.dispose()); return merged
  }
  const TR = 4.9, towers: THREE.Vector3[] = []
  for (let k = 0; k < 6; k++) { const a = (k + .5) / 6 * Math.PI * 2, x = Math.sin(a) * TR, z = Math.cos(a) * TR
    const m = new THREE.Mesh(trussGeo(3.5), trussMat); m.position.set(x, 0, z); m.rotation.y = a; scene.add(m); towers.push(new THREE.Vector3(x, 3.35, z)) }
  towers.forEach((A, k) => { const B = towers[(k + 1) % 6], g = trussGeo(A.distanceTo(B)); g.rotateZ(-Math.PI / 2)
    const m = new THREE.Mesh(g, trussMat); m.position.copy(A); m.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x); scene.add(m) })
  const target = new THREE.Object3D(); target.position.set(0, 1.3, 0); scene.add(target)
  const beams: THREE.Mesh[] = []
  towers.forEach((A, i) => { if (i % 2) return
    const x = A.x * .82, y = 3.1, z = A.z * .82
    const sl = new THREE.SpotLight(0xfff0c0, 7, 9, .5, .7, 1.2); sl.position.set(x, y, z); sl.target = target; scene.add(sl)
    const can = new THREE.Mesh(track(new THREE.CylinderGeometry(.09, .11, .24, 16)), toon(0x1a1816)); can.position.set(x, y, z); scene.add(can); can.lookAt(target.position); can.rotateX(Math.PI / 2)
    const L = Math.hypot(x, y - 1.3, z) + .4, cg = track(new THREE.ConeGeometry(L * .3, L, 28, 1, true)); cg.translate(0, -L / 2, 0); cg.rotateX(-Math.PI / 2)
    const beam = new THREE.Mesh(cg, noLine(new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: .09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })))
    beam.position.set(x, y, z); scene.add(beam); beam.lookAt(target.position); beams.push(beam) })
  const dark = toon(0x2a2826)
  ;[.2, 3.3].forEach(a => { const g = new THREE.Group(); g.position.set(Math.sin(a) * 4.5, 0, Math.cos(a) * 4.5); g.rotation.y = a + Math.PI; scene.add(g)
    ;[0, 2.1, 4.2].forEach(b => { const leg = new THREE.Mesh(track(new THREE.CylinderGeometry(.012, .016, 1.15, 8)), dark); leg.position.set(Math.cos(b) * .22, .55, Math.sin(b) * .22); leg.rotation.set(Math.sin(b) * .19, 0, -Math.cos(b) * .19); g.add(leg) })
    box(.26, .22, .5, toon(0x3d3a36), 0, 1.08, 0, g); const ln = new THREE.Mesh(track(new THREE.CylinderGeometry(.07, .08, .2, 16)), dark); ln.rotation.x = Math.PI / 2; ln.position.set(0, 1.19, .34); g.add(ln) })
  const hemi = new THREE.HemisphereLight(0xffe08a, 0x2a1d08, 1.1); scene.add(hemi)

  // ---------- old TVs ----------
  const tvs: Tv[] = [], bodies: THREE.Mesh[] = []
  const tvCols = [0x6e6a62, 0x3a3835, 0xbcb39b, 0x7a5432, 0x8a8d92, 0x2b2a28, 0xa8432f, 0x5d6b4a]
  const knobMat = toon(0x1e1d1b), bezelMat = toon(0x141312)
  const mkTV = (w: number, x: number, y: number, z: number, ry = 0, rz = 0, col = tvCols[(rng() * tvCols.length) | 0]) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, ry, rz); scene.add(g)
    const h = w * .76, d = w * .78
    const body = new THREE.Mesh(track(new RoundedBoxGeometry(w, h, d, 3, w * .05)), toon(col)); body.position.y = h / 2; g.add(body)
    const bz = new THREE.Mesh(track(new RoundedBoxGeometry(w * .72, h * .8, .03, 2, w * .05)), bezelMat); bz.position.set(-w * .1, h * .5, d / 2); g.add(bz)
    const cv = doc.createElement('canvas'); cv.width = 256; cv.height = 192
    const tex = track(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace
    // a 4:3 picture, so the conversation column lands on it without distortion
    const scr = new THREE.Mesh(track(new THREE.PlaneGeometry(w * .62, w * .465)), noLine(new THREE.MeshBasicMaterial({ map: tex, fog: false }))); scr.position.set(-w * .1, h * .5, d / 2 + .017); g.add(scr)
    ;[.66, .44].forEach(f => { const k = new THREE.Mesh(track(new THREE.CylinderGeometry(w * .045, w * .05, .025, 14)), knobMat); k.rotation.x = Math.PI / 2; k.position.set(w * .36, h * f, d / 2 + .01); g.add(k) })
    const tv: Tv = { g, body, scr, cv, tex, w, h, d, slotOK: false, exposed: false, key: null, ch: 0 }
    tvs.push(tv); bodies.push(body); g.traverse(m => { m.userData.tv = tv })
    return tv
  }

  // ---------- screens ----------
  const noise = doc.createElement('canvas'); noise.width = noise.height = 128
  { const cx = noise.getContext('2d')!, img = cx.createImageData(128, 128); for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255 | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255 } cx.putImageData(img, 0, 0) }
  const sessions = new Map<string, TowerSession>()
  let currentKey = '', staticAll = false
  const wrap = (g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, lines: number) => {
    let line = '', n = 0
    for (const ch of text) { if (g.measureText(line + ch).width > maxW) { g.fillText(line, x, y + n * lh); line = ch; if (++n >= lines) return } else line += ch }
    if (line && n < lines) g.fillText(line, x, y + n * lh)
  }
  function drawTV(tv: Tv) {
    const g = tv.cv.getContext('2d')!, s = tv.key && !staticAll ? sessions.get(tv.key) : undefined
    if (!s) {
      g.drawImage(noise, Math.random() * -60, Math.random() * -40, 380, 280)
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(255,212,0,.55)'; g.fillRect(0, 0, 256, 192); g.globalCompositeOperation = 'source-over'
    } else {
      const on = tv.key === currentKey, gr = g.createRadialGradient(128, 96, 10, 128, 96, 175)
      gr.addColorStop(0, on ? '#fff6b8' : '#ffd400'); gr.addColorStop(1, on ? '#e0a800' : '#7a5c00'); g.fillStyle = gr; g.fillRect(0, 0, 256, 192)
      g.fillStyle = '#111'; g.font = `40px ${LATIN}`; g.fillText('CH ' + String(tv.ch).padStart(2, '0'), 14, 44)
      if (on) { g.fillStyle = '#e2241b'; g.fillRect(166, 16, 78, 26); g.fillStyle = '#fff'; g.font = `18px ${LATIN}`; g.fillText('ON AIR', 178, 36) }
      g.fillStyle = '#111'; g.font = `900 28px ${SANS}`; wrap(g, s.title, 14, 96, 228, 36, 2)
      g.font = `600 17px ${SANS}`; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(s.time, 14, 176)
    }
    g.fillStyle = 'rgba(0,0,0,.14)'; for (let y = 0; y < 192; y += 4) g.fillRect(0, y, 256, 2)
    tv.tex.needsUpdate = true
  }
  // height field: every TV rests on whatever is below its footprint
  const HF_N = 128, HF_S = 2.6, hf = new Float32Array(HF_N * HF_N)
  const hfIdx = (x: number, z: number) => { const i = Math.floor((x / HF_S + 1) / 2 * HF_N), j = Math.floor((z / HF_S + 1) / 2 * HF_N); return (i < 0 || j < 0 || i >= HF_N || j >= HF_N) ? -1 : j * HF_N + i }
  const restOn = (x: number, z: number, ry: number, w: number, d: number) => { let y = 0; const c = Math.cos(ry), sn = Math.sin(ry)
    for (let u = -1; u <= 1; u += .5) for (let v = -1; v <= 1; v += .5) { const lx = u * w * .42, lz = v * d * .42, k = hfIdx(x + lx * c + lz * sn, z - lx * sn + lz * c); if (k >= 0) y = Math.max(y, hf[k]) }
    return y }
  const stamp = (x: number, z: number, ry: number, w: number, d: number, top: number) => { const c = Math.cos(ry), sn = Math.sin(ry), R = Math.hypot(w, d) / 2, step = HF_S / HF_N * 1.4
    for (let gx = x - R; gx <= x + R; gx += step) for (let gz = z - R; gz <= z + R; gz += step) {
      const dx = gx - x, dz = gz - z, lx = dx * c - dz * sn, lz = dx * sn + dz * c
      if (Math.abs(lx) < w * .47 && Math.abs(lz) < d * .47) { const k = hfIdx(gx, gz); if (k >= 0) hf[k] = Math.max(hf[k], top) } } }
  const tower = { layers: 0, h: 0, lx: 0, lz: 0 }
  const drops: { tv: Tv; y1: number; v: number; t: number }[] = []
  const addLayer = () => {
    const i = tower.layers++, base = i < BASE_LAYERS
    const R = base ? 1.14 - i * .115 + (rng() - .5) * .1 : .36 + (rng() - .5) * .08
    tower.lx += (rng() - .5) * .05 + (base ? 0 : .01); tower.lz += (rng() - .5) * .05
    const sc = base ? 1 - i * .055 : .62 + rng() * .08, made: Tv[] = [], stamps: number[][] = []
    let a = rng() * Math.PI * 2; const end = a + Math.PI * 2 - .05
    for (;;) {
      const w = (.4 + rng() * .28) * sc, d = w * .78, span = w * 1.04 / R
      if (a + span > end) break
      const ang = a + span / 2, rr = R + (rng() - .5) * .14, x = tower.lx + Math.sin(ang) * rr, z = tower.lz + Math.cos(ang) * rr
      const yj = (rng() - .5) * .62, tilt = rng() < .2 ? (rng() - .5) * .34 : 0, ry = ang + yj
      const y = restOn(x, z, ry, w, d), tv = mkTV(w, x, y, z, ry, tilt)
      tv.slotOK = Math.abs(yj) < .2 && tilt === 0
      const top = y + tv.h + Math.abs(Math.sin(tilt)) * w * .5; stamps.push([x, z, ry, w, d, top]); tower.h = Math.max(tower.h, top); made.push(tv)
      a += span + (rng() < .14 ? .2 + rng() * .3 : rng() * .05)
    }
    if (!base) { const w = .3 + rng() * .06, x = tower.lx, z = tower.lz, ry = rng() * 6.28, y = restOn(x, z, ry, w, w * .78), tv = mkTV(w, x, y, z, ry)
      const top = y + tv.h; stamps.push([x, z, ry, w, w * .78, top]); tower.h = Math.max(tower.h, top); made.push(tv) }
    stamps.forEach(([x, z, ry, w, d, top]) => stamp(x, z, ry, w, d, top))
    return made
  }
  const rc = new THREE.Raycaster(); rc.far = .9
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), N = new THREE.Vector3(), RT = new THREE.Vector3(), UP = new THREE.Vector3(), O = new THREE.Vector3()
  const updateExposure = () => {
    scene.updateMatrixWorld(true)
    for (const tv of tvs) {
      if (!tv.slotOK) { tv.exposed = false; continue }
      tv.scr.getWorldPosition(P); tv.g.getWorldQuaternion(Q); N.set(0, 0, 1).applyQuaternion(Q); RT.set(1, 0, 0).applyQuaternion(Q); UP.set(0, 1, 0).applyQuaternion(Q)
      const sw = tv.w * .62, sh = tv.w * .465
      tv.exposed = [[0, 0], [-.45, -.45], [.45, -.45], [-.45, .45], [.45, .45]].every(([u, v]) => {
        O.copy(P).addScaledVector(RT, u * sw).addScaledVector(UP, v * sh).addScaledVector(N, .02); rc.set(O, N)
        return !rc.intersectObjects(bodies, false).some(hit => hit.object.userData.tv !== tv) })
    }
  }
  // antenna on whichever TV is highest
  const antenna = new THREE.Group()
  ;[-.5, .55].forEach(r => { const rod = new THREE.Mesh(track(new THREE.CylinderGeometry(.006, .009, .62, 6)), knobMat); rod.position.set(Math.sin(r) * .3, .3, 0); rod.rotation.z = -r; antenna.add(rod) })
  antenna.add(new THREE.Mesh(track(new THREE.SphereGeometry(.035, 12, 8)), knobMat))
  const center = new THREE.Vector3(0, 1.5, 0), centerGoal = center.clone()
  const grow = (drop: boolean) => {
    const made = addLayer(); updateExposure()
    const top = tvs.reduce((m, t) => t.g.position.y + t.h > m.g.position.y + m.h ? t : m, tvs[0]); antenna.position.set(0, top.h, 0); top.g.add(antenna)
    centerGoal.y = Math.max(1.3, Math.min(2.2, tower.h * .45))
    if (drop) made.forEach((tv, k) => { const y1 = tv.g.position.y; tv.g.position.y += 2.4 + k * .1; drops.push({ tv, y1, v: 0, t: k * .06 }) })
    for (const tv of made) drawTV(tv)
  }
  for (let i = 0; i < BASE_LAYERS + 1; i++) grow(false)
  center.y = centerGoal.y
  for (let k = 0; k < 6; k++) {
    const ang = k / 6 * Math.PI * 2 + rng() * .6, rr = 1.62 + rng() * .3, w = .42 + rng() * .2, tv = mkTV(w, Math.sin(ang) * rr, 0, Math.cos(ang) * rr)
    tv.g.rotation.order = 'YXZ'; tv.g.rotation.y = ang + (rng() - .5) * 1.2
    if (k % 3 === 1) { tv.g.rotation.z = Math.PI / 2; tv.g.position.y = w / 2 } else { tv.g.rotation.x = -Math.PI / 2; tv.g.position.y = tv.d / 2 }
  }
  updateExposure()

  tvs.forEach(drawTV)

  // ---------- conversations ↔ TVs: stable; grow, then bands ----------
  const assign = new Map<string, { tv: Tv; band: number }>()
  let band = 0, chSeq = 0
  const angOf = (v: THREE.Vector3) => Math.atan2(v.x, v.z)
  const pickSlot = (b: number) => {
    const taken = new Set<Tv>(); assign.forEach(a => { if (a.band === b) taken.add(a.tv) })
    let best: Tv | null = null, bs = 1e9
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3()
    for (const tv of tvs) {
      if (!tv.exposed || taken.has(tv)) continue
      tv.scr.getWorldPosition(v1); let score = Math.abs(v1.y - 1.05) * 1.2; const a1 = angOf(v1)
      taken.forEach(t => { t.scr.getWorldPosition(v2); const da = Math.abs(Math.atan2(Math.sin(angOf(v2) - a1), Math.cos(angOf(v2) - a1))); if (da < .6 && Math.abs(v2.y - v1.y) < .5) score += .8 })
      if (score < bs) { bs = score; best = tv }
    }
    return best
  }
  let grewAt = 0
  const ensure = (order: string[], drop: boolean) => {
    for (const k of order) {
      if (assign.has(k)) continue
      for (let b = 0; b < 99; b++) {
        let tv = pickSlot(b)
        while (!tv && b === 0 && tower.h < MAX_H) { grow(drop); grewAt = performance.now(); tv = pickSlot(0) }
        if (tv) { assign.set(k, { tv, band: b }); break }
      }
    }
  }
  const bandsUsed = () => { let m = 0; assign.forEach(a => { m = Math.max(m, a.band) }); return m + 1 }
  const refresh = () => {
    for (const tv of tvs) tv.key = null
    assign.forEach((a, k) => { if (a.band === band) { a.tv.key = k } })
    let i = 0; for (const k of sessions.keys()) { i++; const a = assign.get(k); if (a) a.tv.ch = i }
    tvs.forEach(drawTV)
  }

  // ---------- state ----------
  let thinking = 0, thinkGoal = 0, staticT = 0
  const fogCol = new THREE.Color()

  return {
    scene, center,
    height: () => tower.h,
    /** Conversations in sidebar order; the first time a key is seen it gets a free screen. */
    setSessions(list: TowerSession[], current: string, animate: boolean) {
      let changed = list.length !== sessions.size || current !== currentKey
      for (const s of list) { const old = sessions.get(s.key); if (!old || old.title !== s.title || old.time !== s.time) changed = true; sessions.set(s.key, s) }
      if (!changed) return
      currentKey = current
      ensure(list.map(s => s.key), animate)
      const cur = assign.get(current); if (cur && cur.band !== band) band = cur.band
      refresh()
    },
    bands: () => bandsUsed(), band: () => band,
    setBand(b: number) { if (b === band) return; band = b; staticAll = true; tvs.forEach(drawTV); setTimeout(() => { staticAll = false; refresh() }, 420) },
    bandOf: (key: string) => assign.get(key)?.band ?? 0,
    droppingUntil: () => grewAt ? grewAt + 1600 : 0,
    /** World-space picture of a conversation's TV (right-handed: right × up = normal). */
    frameOf(key: string): ScreenFrame | null {
      const a = assign.get(key); if (!a || a.band !== band) return null
      const tv = a.tv; scene.updateMatrixWorld()
      const c = new THREE.Vector3(), q = new THREE.Quaternion(); tv.scr.getWorldPosition(c); tv.g.getWorldQuaternion(q)
      // while it is still falling, use where it will land
      const dr = drops.find(d => d.tv === tv); if (dr) c.y += dr.y1 - tv.g.position.y
      return { c, right: new THREE.Vector3(1, 0, 0).applyQuaternion(q), normal: new THREE.Vector3(0, 0, 1).applyQuaternion(q), w: tv.w * .62, h: tv.w * .465 }
    },
    pick(ray: THREE.Raycaster): string | null {
      const hit = ray.intersectObjects(bodies.concat(tvs.map(t => t.scr)), false)[0]
      const tv = hit?.object.userData.tv as Tv | undefined
      return tv?.key ?? null
    },
    titleOf: (key: string) => sessions.get(key)?.title ?? '',
    chOf: (key: string) => assign.get(key)?.tv.ch ?? 0,
    setThinking(on: boolean) { thinkGoal = on ? 1 : 0 },
    update(dt: number) {
      center.lerp(centerGoal, Math.min(1, dt * 3))
      thinking += (thinkGoal - thinking) * Math.min(1, dt * 1.5)
      fogCol.copy(FOG).lerp(FOGY, thinking * .6); (scene.fog as THREE.FogExp2).color.copy(fogCol); (scene.background as THREE.Color).copy(fogCol)
      ;(scene.fog as THREE.FogExp2).density = .09 + thinking * .12
      const t = performance.now() / 1000
      beams.forEach((b, i) => { (b.material as THREE.MeshBasicMaterial).opacity = .07 + Math.sin(t * 1.3 + i) * .02 + thinking * .08 })
      staticT += dt
      if (staticT > .1) { staticT = 0; for (let k = 0; k < 16; k++) { const tv = tvs[(Math.random() * tvs.length) | 0]; if (!tv.key || staticAll) drawTV(tv) } }
      for (let k = drops.length - 1; k >= 0; k--) { const d = drops[k]; if ((d.t -= dt) > 0) continue; d.v += 9.8 * dt; d.tv.g.position.y -= d.v * dt; if (d.tv.g.position.y <= d.y1) { d.tv.g.position.y = d.y1; drops.splice(k, 1) } }
    },
    dispose() {
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose() })
      for (const d of disposables) d.dispose()
    },
  }
}

export type TowerScene = ReturnType<typeof createTowerScene>
