import * as THREE from 'three'
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * The P4 rainy-night room, built once per P4 session. Original geometry and
 * canvas-drawn textures only (no game assets, no characters). Everything is
 * disposed with `dispose()`.
 */

const LATIN = '"Anton", "Impact", "Arial Narrow", sans-serif'
const MONO = '"Consolas", "Courier New", monospace'
const WDE = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Screen opening the native column is laid onto (world units, faces +z). */
export const SCREEN = { x: -0.72, y: 0.755, z: -1.475, w: 0.44, h: 0.33 }
export const FOV = 40
export const ROOM_VIEW = { pos: new THREE.Vector3(1.45, 2.05, 2.25), tgt: new THREE.Vector3(-0.55, 0.62, -1.0) }
export const PRE_VIEW = { pos: new THREE.Vector3(2.7, 3.2, 4.0), tgt: new THREE.Vector3(-0.45, 0.55, -0.75) }

const AMB = ['#9fc3ff', '#ffd6a0', '#a8f0c4', '#ffb8cc', '#c9b5ff', '#9fe8ff']
export const AMBIENT_COUNT = AMB.length
export type RoomThing = 'tv' | 'window' | 'calendar' | 'poster' | 'wardrobe' | 'shelf' | 'rack' | 'cabinet' | 'table' | 'sofa'

const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2()
/** A ray through the canvas point (normalised device coordinates). */
export function pickRay(camera: THREE.Camera, p: { x: number; y: number }) { _ndc.set(p.x, p.y); _ray.setFromCamera(_ndc, camera); return _ray }

export function createRoomScene(canvas: HTMLCanvasElement, doc: Document) {
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' })
  const dpr = doc.defaultView?.devicePixelRatio ?? 1
  renderer.setPixelRatio(Math.min(dpr, 1.25))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const effect = new OutlineEffect(renderer, { defaultThickness: 0.0048, defaultColor: [0, 0, 0], defaultAlpha: 1 })

  const scene = new THREE.Scene()
  const NIGHT = new THREE.Color(0x04050b)
  scene.background = NIGHT.clone()
  scene.fog = new THREE.FogExp2(NIGHT.clone(), 0.045)
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 10, 0.05, 60)

  const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = doc.createElement('canvas'); c.width = w; c.height = h
    draw(c.getContext('2d')!, w, h)
    const t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
    return Object.assign(t, { redraw: () => { draw(c.getContext('2d')!, w, h); t.needsUpdate = true } })
  }
  const gm = track(new THREE.DataTexture(new Uint8Array([38, 118, 255]), 3, 1, THREE.RedFormat))
  gm.minFilter = gm.magFilter = THREE.NearestFilter; gm.needsUpdate = true
  const toon = (c: number, o: THREE.MeshToonMaterialParameters = {}) => track(new THREE.MeshToonMaterial({ color: c, gradientMap: gm, ...o }))
  const noLine = <M extends THREE.Material>(m: M) => { m.userData.outlineParameters = { visible: false }; return track(m) }
  const room = new THREE.Group(); scene.add(room)
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = room) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y + h / 2, z); parent.add(m); return m
  }
  const plane = (w: number, h: number, mat: THREE.Material, parent: THREE.Object3D = room) => {
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat); parent.add(m); return m
  }
  const additive = (map: THREE.Texture, extra: THREE.MeshBasicMaterialParameters = {}) =>
    noLine(new THREE.MeshBasicMaterial({ map, color: 0xbfd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, ...extra }))

  // ---------- floor, walls ----------
  const floorTex = canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#3c3f46' : '#5d6169'; g.fillRect(i * 128, j * 128, 128, 128) }
    for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) }
  })
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4.5, 4)
  const floor = plane(4.5, 4, noLine(toon(0xffffff, { map: floorTex }))); floor.rotation.x = -Math.PI / 2
  const tatami = box(0.7, 0.012, 4, noLine(toon(0xb9b07a)), -1.9, 0, 0)
  const wallMat = toon(0xa39a84), woodDark = toon(0x5a3e26), wood = toon(0x7a5432), woodLight = toon(0x9a6d40)
  const back = plane(4.5, 2.4, noLine(wallMat)); back.position.set(0, 1.2, -2)
  const left = plane(4, 2.4, noLine(wallMat.clone())); left.rotation.y = Math.PI / 2; left.position.set(-2.25, 1.2, 0)
  box(4.5, 0.9, 0.03, noLine(toon(0xb59c78)), 0, 0, -1.985)
  box(0.03, 0.9, 4, noLine(toon(0xb59c78)), -2.235, 0, 0)
  box(4.5, 0.08, 0.04, woodDark, 0, 0, -1.97); box(0.04, 0.08, 4, woodDark, -2.22, 0, 0)
  box(4.5, 0.04, 0.05, woodDark, 0, 0.9, -1.97)

  // ---------- window, rain ----------
  const outsideTex = canvasTex(512, 440, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0d1530'); gr.addColorStop(.7, '#1d2a4a'); gr.addColorStop(1, '#2a3552'); g.fillStyle = gr; g.fillRect(0, 0, w, h)
    g.fillStyle = '#0a0e1a';
    ([[0, 300, 140, 140], [120, 260, 120, 180], [230, 320, 110, 120], [330, 240, 90, 200], [410, 290, 110, 150]] as const).forEach(([x, y, a, b]) => g.fillRect(x, y, a, b))
    g.beginPath(); g.moveTo(110, 300); g.lineTo(180, 230); g.lineTo(250, 260); g.fill();
    ([[150, 290], [175, 290], [355, 270], [375, 300], [440, 320], [40, 330], [260, 350]] as const).forEach(([x, y]) => { g.fillStyle = Math.random() < .5 ? '#ffd98a' : '#ffe9b8'; g.fillRect(x, y, 12, 10) })
    const lg = g.createRadialGradient(470, 250, 2, 470, 250, 80); lg.addColorStop(0, 'rgba(255,220,150,.6)'); lg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = lg; g.fillRect(380, 160, 180, 180)
  })
  const rainTexture = (n: number, minL: number, spanL: number, slant: number, alpha: number) => {
    const t = canvasTex(128, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h)
      for (let i = 0; i < n; i++) { const x = Math.random() * w, y = Math.random() * h, l = minL + Math.random() * spanL; g.strokeStyle = `rgba(200,218,255,${alpha + Math.random() * .4})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - slant, y + l); g.stroke() }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t
  }
  const rainTex = rainTexture(70, 14, 26, 3, .25), rain2Tex = rainTexture(150, 30, 50, 7, .3)
  const win = new THREE.Group(); win.position.set(1.15, 1.5, -1.99); room.add(win)
  const outsideMat = noLine(new THREE.MeshBasicMaterial({ map: outsideTex, fog: false }))
  plane(1.0, 0.86, outsideMat, win).position.z = 0.002
  plane(1.0, 0.86, noLine(new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, fog: false })), win).position.z = 0.006
  const rain2Mat = noLine(new THREE.MeshBasicMaterial({ map: rain2Tex, transparent: true, opacity: 0, fog: false, depthWrite: false }))
  plane(1.0, 0.86, rain2Mat, win).position.z = 0.008
  const frameMat = toon(0xe9e3d3)
  box(1.1, 0.06, 0.06, frameMat, 0, 0.43, 0.03, win); box(1.1, 0.06, 0.06, frameMat, 0, -0.49, 0.03, win)
  box(0.06, 0.92, 0.06, frameMat, -0.52, -0.46, 0.03, win); box(0.06, 0.92, 0.06, frameMat, 0.52, -0.46, 0.03, win); box(0.035, 0.86, 0.04, frameMat, 0, -0.43, 0.03, win)
  box(1.2, 0.04, 0.14, frameMat, 0, -0.53, 0.07, win)
  const curtainMat = toon(0x3f5584)
  box(0.32, 1.25, 0.05, curtainMat, -0.68, -0.72, 0.09, win); box(0.32, 1.25, 0.05, curtainMat, 0.68, -0.72, 0.09, win)
  box(1.6, 0.05, 0.05, woodDark, 0, 0.56, 0.11, win)

  // ---------- calendar (real date), original poster ----------
  const calTex = canvasTex(256, 336, (g, w) => {
    const now = new Date()
    g.fillStyle = '#f6f1e2'; g.fillRect(0, 0, w, 336); g.fillStyle = '#e2241b'; g.fillRect(0, 0, w, 54)
    g.fillStyle = '#fff'; g.font = `30px ${LATIN}`; g.textAlign = 'center'; g.fillText(`${now.getFullYear()} · ${String(now.getMonth() + 1).padStart(2, '0')}`, w / 2, 40)
    g.fillStyle = '#1b1a17'; g.font = `160px ${LATIN}`; g.fillText(String(now.getDate()), w / 2, 220)
    g.font = `40px ${LATIN}`; g.fillText(WDE[now.getDay()], w / 2, 292)
  })
  const cal = plane(0.3, 0.4, noLine(toon(0xffffff, { map: calTex }))); cal.position.set(-1.65, 1.58, -1.975)
  const posterTex = canvasTex(300, 420, (g, w, h) => {
    g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, h)
    for (let i = 7; i >= 0; i--) { g.fillStyle = i % 2 ? '#111' : '#ffd400'; const s = 30 + i * 30; g.beginPath(); g.roundRect(w / 2 - s * .62, 170 - s / 2, s * 1.24, s, s * .3); g.fill() }
    g.fillStyle = '#111'; g.textAlign = 'center'; g.font = `italic 64px ${LATIN}`; g.fillText('DSH-TV', w / 2, 360)
    g.font = `22px ${LATIN}`; g.fillText('MIDNIGHT · 00:00', w / 2, 394)
  })
  const poster = plane(0.5, 0.7, noLine(toon(0xffffff, { map: posterTex }))); poster.rotation.y = Math.PI / 2; poster.position.set(-2.22, 1.55, -0.9)

  // ---------- wardrobe, shelf, rack ----------
  const wardrobe = new THREE.Group(); room.add(wardrobe)
  box(0.55, 1.85, 0.95, wood, -1.95, 0, 1.05, wardrobe); box(0.02, 1.7, 0.012, woodDark, -1.67, 0.08, 1.05, wardrobe)
  box(0.04, 0.12, 0.03, toon(0xc9b37a), -1.66, 0.9, 0.98, wardrobe); box(0.04, 0.12, 0.03, toon(0xc9b37a), -1.66, 0.9, 1.12, wardrobe)
  const shelf = new THREE.Group(); room.add(shelf)
  box(0.38, 1.0, 0.8, woodLight, -2.04, 0, -0.1, shelf);
  [0xb03a2e, 0x2e5fb0, 0xe0b040, 0x3a8a4a, 0x7a3ab0, 0xd06a2a, 0x2a2a2a].forEach((c, i) => box(0.24, 0.24 + (i % 3) * .03, 0.07, toon(c), -1.98, 0.62, -0.42 + i * 0.09, shelf));
  [0x8a8a8a, 0xc9a24a, 0x444444].forEach((c, i) => box(0.22, 0.18, 0.18, toon(c), -1.98, 0.08, -0.32 + i * 0.22, shelf))
  const rack = new THREE.Group(); rack.position.set(0.25, 0, -1.78); room.add(rack)
  const metal = toon(0xa8adb3);
  [[-0.3, -0.15], [0.3, -0.15], [-0.3, 0.15], [0.3, 0.15]].forEach(([x, z]) => box(0.025, 1.05, 0.025, metal, x, 0, z, rack));
  [0.1, 0.48, 0.86].forEach(y => box(0.64, 0.02, 0.34, metal, 0, y, 0, rack))
  box(0.22, 0.16, 0.2, toon(0xd06a2a), -0.15, 0.5, 0, rack); box(0.18, 0.1, 0.24, toon(0x2e5fb0), 0.15, 0.5, 0, rack); box(0.3, 0.22, 0.22, toon(0x6b6f74), 0, 0.12, 0, rack)
  box(0.1, 0.28, 0.1, toon(0x3a8a4a), 0.2, 0.88, 0, rack)

  // ---------- TV cabinet + VCR clock ----------
  const cabinet = new THREE.Group(); cabinet.position.set(-0.65, 0, -1.74); room.add(cabinet)
  box(1.04, 0.45, 0.46, wood, 0, 0, 0, cabinet); box(1.06, 0.03, 0.48, woodDark, 0, 0.45, 0, cabinet)
  box(0.42, 0.33, 0.012, woodDark, 0.25, 0.06, 0.232, cabinet); box(0.44, 0.085, 0.3, toon(0x1e1d1a), -0.24, 0.24, 0.09, cabinet)
  let vcrText = '23:59'
  const vcrTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#050c05'; g.fillRect(0, 0, w, h); g.fillStyle = '#7dff7a'; g.shadowColor = 'rgba(120,255,110,.8)'; g.shadowBlur = 10; g.font = `bold 48px ${MONO}`; g.textAlign = 'center'; g.fillText(vcrText, w / 2, 48) })
  plane(0.12, 0.03, noLine(new THREE.MeshBasicMaterial({ map: vcrTex, fog: false })), cabinet).position.set(-0.13, 0.283, 0.241)
  box(0.16, 0.012, 0.01, toon(0x050505), -0.33, 0.276, 0.242, cabinet)

  // ---------- detailed CRT ----------
  const tv = new THREE.Group(); tv.position.set(-0.65, 0.465, -1.72); room.add(tv)
  const tvBody = toon(0x5c5953), tvTrim = toon(0x23211f), tvDark = toon(0x121110), tvSlat = toon(0x77736b)
  const chrome = track(new THREE.MeshPhongMaterial({ color: 0xb9bdc2, specular: 0xffffff, shininess: 100 }))
  const rr = <S extends THREE.Path>(s: S, w: number, h: number, r: number) => { s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s }
  const cab = new THREE.Mesh(track(new RoundedBoxGeometry(0.68, 0.53, 0.42, 5, 0.04)), tvBody); cab.position.set(0, 0.285, 0.02); tv.add(cab)
  const hg = track(new THREE.CylinderGeometry(0.2, 0.31, 0.3, 4, 1)); hg.rotateY(Math.PI / 4); hg.rotateX(-Math.PI / 2); hg.scale(1.22, 1, 1)
  const housing = new THREE.Mesh(hg, tvBody); housing.position.set(0, 0.3, -0.33); tv.add(housing)
  const backPlate = new THREE.Mesh(track(new RoundedBoxGeometry(0.3, 0.24, 0.03, 3, 0.012)), tvTrim); backPlate.position.set(0, 0.3, -0.49); tv.add(backPlate)
  for (let i = 0; i < 7; i++) box(0.34, 0.004, 0.012, tvDark, -0.05, 0.548, -0.13 + i * 0.035, tv)
  const bz = rr(new THREE.Shape(), 0.53, 0.43, 0.05); bz.holes.push(rr(new THREE.Path(), 0.452, 0.343, 0.075))
  const bezel = new THREE.Mesh(track(new THREE.ExtrudeGeometry(bz, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 12 })), tvTrim)
  bezel.position.set(-0.07, 0.29, 0.222); tv.add(bezel)
  const gg = track(new THREE.PlaneGeometry(0.47, 0.36, 28, 20))
  { const gp = gg.attributes.position; for (let i = 0; i < gp.count; i++) { const x = gp.getX(i) / 0.235, y = gp.getY(i) / 0.18; gp.setZ(i, 0.02 * (1 - x * x * .7) * (1 - y * y * .7)) } gg.computeVertexNormals() }
  const glass = new THREE.Mesh(gg, noLine(new THREE.MeshPhongMaterial({ color: 0x060807, specular: 0x667766, shininess: 90 }))); glass.position.set(-0.07, 0.29, 0.212); tv.add(glass)
  box(0.52, 0.006, 0.006, chrome, -0.07, 0.052, 0.232, tv)
  const badgeTex = canvasTex(256, 56, (g, w, h) => { g.fillStyle = '#121110'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9d4c6'; g.font = `italic 40px ${LATIN}`; g.textAlign = 'center'; g.fillText('DSH-TV', w / 2, 44) })
  plane(0.1, 0.022, noLine(toon(0xffffff, { map: badgeTex })), tv).position.set(-0.07, 0.032, 0.2315)
  box(0.12, 0.44, 0.006, tvDark, 0.265, 0.07, 0.229, tv)
  const knobGeo = (() => {
    const pts = [[0, 0], [0.037, 0], [0.039, 0.005], [0.036, 0.01], [0.032, 0.028], [0.028, 0.034], [0.012, 0.037], [0, 0.037]].map(([x, y]) => new THREE.Vector2(x, y))
    const g = track(new THREE.LatheGeometry(pts, 48)), p = g.attributes.position
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y > 0.011 && y < 0.03) { const a = Math.atan2(z, x), k = Math.cos(a * 22) > 0 ? 1.07 : 1; p.setX(i, x * k); p.setZ(i, z * k) } }
    g.computeVertexNormals(); g.rotateX(Math.PI / 2); return g
  })()
  const knobMat = toon(0x26241f), capGeo = track(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 24)), markGeo = track(new THREE.BoxGeometry(0.006, 0.026, 0.006)), markMat = toon(0xffd400)
  const mkKnob = (y: number, sc: number) => {
    const k = new THREE.Group(); k.position.set(0.265, y, 0.232); k.scale.setScalar(sc); tv.add(k)
    k.add(new THREE.Mesh(knobGeo, knobMat))
    const cap = new THREE.Mesh(capGeo, chrome); cap.rotation.x = Math.PI / 2; cap.position.z = 0.038; k.add(cap)
    const mark = new THREE.Mesh(markGeo, markMat); mark.position.set(0, 0.02, 0.036); k.add(mark)
    return k
  }
  const chKnob = mkKnob(0.43, 1); mkKnob(0.325, 0.78)
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, t = box(0.003, 0.008, 0.003, toon(0xd9d4c6), 0, 0, 0, tv); t.position.set(0.265 + Math.cos(a) * 0.05, 0.43 + Math.sin(a) * 0.05, 0.233); t.rotation.z = a + Math.PI / 2 }
  for (let i = 0; i < 9; i++) box(0.09, 0.006, 0.007, tvSlat, 0.265, 0.13 + i * 0.0135, 0.232, tv)
  const pwr = new THREE.Mesh(track(new RoundedBoxGeometry(0.04, 0.018, 0.014, 2, 0.004)), chrome); pwr.position.set(0.282, 0.098, 0.234); tv.add(pwr)
  const ledMat = noLine(new THREE.MeshBasicMaterial({ color: 0x3b100d }))
  const led = new THREE.Mesh(track(new THREE.SphereGeometry(0.006, 12, 8)), ledMat); led.position.set(0.24, 0.098, 0.233); tv.add(led);
  [[-0.28, -0.14], [0.28, -0.14], [-0.28, 0.17], [0.28, 0.17]].forEach(([x, z]) => { const f = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.022, 0.02, 12)), tvDark); f.position.set(x, 0.01, z); tv.add(f) })
  const antBase = new THREE.Mesh(track(new THREE.CylinderGeometry(0.062, 0.066, 0.02, 24)), tvTrim); antBase.position.set(0.02, 0.56, -0.1); tv.add(antBase)
  const antDome = new THREE.Mesh(track(new THREE.SphereGeometry(0.046, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), tvBody); antDome.position.set(0.02, 0.57, -0.1); tv.add(antDome);
  [[-0.52, -0.16], [0.44, -0.2]].forEach(([a, b]) => {
    const rg = new THREE.Group(); rg.position.set(0.02, 0.6, -0.1); rg.rotation.z = a; rg.rotation.x = b; tv.add(rg)
    rg.add(new THREE.Mesh(track(new THREE.SphereGeometry(0.013, 12, 8)), tvTrim))
    let acc = 0
    for (const [r, l] of [[0.0056, 0.17], [0.0044, 0.15], [0.0033, 0.13]]) {
      const c = new THREE.Mesh(track(new THREE.CylinderGeometry(r, r, l, 10)), chrome); c.position.y = acc + l / 2; rg.add(c)
      const col = new THREE.Mesh(track(new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.008, 10)), chrome); col.position.y = acc + l - 0.004; rg.add(col); acc += l
    }
    const tip = new THREE.Mesh(track(new THREE.SphereGeometry(0.009, 10, 8)), chrome); tip.position.y = acc; rg.add(tip)
  })

  // ---------- table, programme-guide sheets, mug ----------
  const table = new THREE.Group(); table.position.set(-0.35, 0, 0.05); room.add(table)
  box(1.0, 0.05, 0.62, woodLight, 0, 0.3, 0, table);
  [[-0.44, -0.26], [0.44, -0.26], [-0.44, 0.26], [0.44, 0.26]].forEach(([x, z]) => box(0.05, 0.3, 0.05, wood, x, 0, z, table))
  const paperTex = canvasTex(256, 340, (g, w, h) => {
    g.fillStyle = '#efe6cf'; g.fillRect(0, 0, w, h); g.fillStyle = '#141310'; g.font = `34px ${LATIN}`; g.fillText('TV GUIDE', 16, 46); g.fillRect(12, 60, w - 24, 4)
    for (let i = 0; i < 9; i++) { if (i === 0) { g.fillStyle = '#ffd400'; g.fillRect(12, 76, w - 24, 26) } g.fillStyle = '#141310'; g.fillRect(18, 86 + i * 28, 30, 6); g.fillRect(60, 86 + i * 28, 100 + (i * 37) % 70, 6) }
  })
  const paperMat = noLine(toon(0xffffff, { map: paperTex }))
  const paper = plane(0.3, 0.4, paperMat, table); paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.25; paper.position.set(-0.15, 0.352, 0.02)
  const SHEETS = 16, sheetGeo = track(new THREE.BoxGeometry(0.3, 0.003, 0.4))
  const sheets = Array.from({ length: SHEETS }, (_, k) => {
    const m = new THREE.Mesh(sheetGeo, paperMat); const r = Math.sin(k * 12.9898) * 43758.5453, f = r - Math.floor(r)
    const base = new THREE.Vector3(-0.15 + (f - .5) * .07, 0.354 + (k + 1) * .0034, 0.02 + Math.sin(k * 3.7) * .03)
    m.position.copy(base); m.rotation.y = -.25 + (f - .5) * .7; m.visible = false; table.add(m)
    return { m, base, drop: 0 }
  })
  let sheetsShown = 0
  const mug = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 16)), toon(0xe9e3d3)); mug.position.set(0.25, 0.395, -0.1); table.add(mug)

  // ---------- sofa ----------
  const sofa = new THREE.Group(); sofa.position.set(0.95, 0, 1.15); sofa.rotation.y = -0.38; room.add(sofa)
  const leather = toon(0x1f1d1e), leather2 = toon(0x2c292a), cushion = toon(0x3d5fb5)
  box(1.5, 0.36, 0.78, leather, 0, 0.04, 0, sofa); box(1.5, 0.48, 0.2, leather2, 0, 0.3, 0.3, sofa)
  box(0.18, 0.56, 0.8, leather2, -0.78, 0.04, 0, sofa); box(0.18, 0.56, 0.8, leather2, 0.78, 0.04, 0, sofa)
  box(0.66, 0.08, 0.56, leather2, -0.34, 0.4, -0.06, sofa); box(0.66, 0.08, 0.56, leather2, 0.34, 0.4, -0.06, sofa)
  const c1 = box(0.36, 0.34, 0.1, cushion, -0.38, 0.46, 0.16, sofa); c1.rotation.x = -0.35; c1.rotation.z = 0.12
  const c2 = box(0.36, 0.34, 0.1, cushion, 0.38, 0.46, 0.16, sofa); c2.rotation.x = -0.35; c2.rotation.z = -0.1

  // ---------- things you can look at (ids only; the words live in the controller, per language) ----------
  const pickables: THREE.Object3D[] = []
  const tag = (obj: THREE.Object3D, id: RoomThing) => obj.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.userData.thing = id; pickables.push(o) } })
  tag(tv, 'tv'); tag(win, 'window'); tag(cal, 'calendar'); tag(poster, 'poster'); tag(wardrobe, 'wardrobe'); tag(shelf, 'shelf')
  tag(rack, 'rack'); tag(cabinet, 'cabinet'); tag(table, 'table'); tag(sofa, 'sofa')

  // ---------- shadows (static: rendered once, refreshed when the sheets move) ----------
  room.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material & { isMeshToonMaterial?: boolean }).isMeshToonMaterial) { m.castShadow = true; m.receiveShadow = true } })
  for (const m of [floor, back, left, tatami, cal, poster]) m.castShadow = false

  // ---------- light ----------
  const winLightTex = canvasTex(256, 340, (g, w, h) => { g.clearRect(0, 0, w, h); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(150,175,255,.95)'); gr.addColorStop(1, 'rgba(150,175,255,0)'); g.fillStyle = gr; g.fillRect(14, 0, 108, h); g.fillRect(134, 0, 108, h); g.clearRect(0, 150, w, 12) })
  const winLight = plane(0.95, 1.35, additive(winLightTex, { color: 0xffffff, opacity: .55 })); winLight.rotation.x = -Math.PI / 2; winLight.rotation.z = 0.14; winLight.position.set(1.05, 0.004, -1.25)
  const hemi = new THREE.HemisphereLight(0x26315e, 0x080605, 0.4); scene.add(hemi)
  const moon = new THREE.DirectionalLight(0x6f8cff, 1.25); moon.position.set(2.4, 3.2, -3.4); scene.add(moon)
  const lamp = new THREE.PointLight(0xffb070, 0.5, 0, 2); lamp.position.set(-1.6, 1.9, 1.2); scene.add(lamp)
  const tvLight = new THREE.PointLight(0xcfe0ff, 0, 0, 1.5); tvLight.position.set(SCREEN.x, SCREEN.y, SCREEN.z + .3)
  tvLight.castShadow = true; tvLight.shadow.mapSize.set(1024, 1024); tvLight.shadow.camera.near = 0.05; tvLight.shadow.bias = -0.003; scene.add(tvLight)

  // screen light on the wall / floor, rain shadows crawling over the TV when pushed in
  const glowTex = canvasTex(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.45, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256) })
  const wallGlow = plane(2.7, 1.9, additive(glowTex)); wallGlow.position.set(-0.68, 0.98, -1.975)
  const floorGlow = plane(2.2, 1.7, additive(glowTex)); floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(-0.66, 0.008, -0.95)
  const sideGlow = plane(1.8, 1.6, additive(glowTex)); sideGlow.rotation.y = Math.PI / 2; sideGlow.position.set(-2.23, 0.9, -1.35)
  const dripTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = 'rgb(120,150,230)'; g.fillRect(0, 0, w, h); g.strokeStyle = g.fillStyle = 'rgb(10,14,30)'; g.lineCap = 'round'
    for (let i = 0; i < 26; i++) {
      const x0 = Math.random() * w; g.lineWidth = 1.5 + Math.random() * 3; g.beginPath(); g.moveTo(x0, 0); for (let y = 0; y <= h; y += 32) g.lineTo(x0 + Math.sin(y * .03 + i) * 4, y); g.stroke()
      for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x0 + Math.random() * 6 - 3, Math.random() * h, 3 + Math.random() * 3, 5 + Math.random() * 4, 0, 0, 7); g.fill() }
    }
  })
  dripTex.wrapS = dripTex.wrapT = THREE.RepeatWrapping
  const dripMask = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(.6, '#888'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128) })
  const rainShadow = plane(1.3, 1.25, additive(dripTex, { color: 0xffffff, alphaMap: dripMask }))
  rainShadow.position.set(-0.6, 0.78, -1.36); rainShadow.rotation.z = -0.06; rainShadow.scale.set(1.15, .9, 1)

  // ---------- state ----------
  const TVCOL = new THREE.Color(0xbfd8ff), TVMID = new THREE.Color(0xd8e07a)
  const ambCol = new THREE.Color(0xbfd8ff), ambGoal = new THREE.Color(0xbfd8ff), tmp = new THREE.Color()
  const st = { tvOn: false, power: 0, flicker: 0, pulse: 0, storm: 0, stormGoal: 0, bolt: 0, midnight: false, knob: 0, desk: 0 }
  let shadowsDirty = true

  return {
    renderer, camera,
    setSize(w: number, h: number) { renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix() },
    /** Sharp when the room is looked at, coarse when it sits blurred behind the conversation. */
    setDetail(level: 'full' | 'blurred') {
      const r = level === 'full' ? Math.min(dpr, 1.25) : Math.max(.5, Math.min(dpr, 1.25) * .5)
      if (Math.abs(renderer.getPixelRatio() - r) < .01) return
      const s = renderer.getSize(new THREE.Vector2()); renderer.setPixelRatio(r); renderer.setSize(s.x, s.y, false); shadowsDirty = true
    },
    setTV(on: boolean) { st.tvOn = on; ledMat.color.set(on ? 0xe2241b : 0x3b100d) },
    setVcr(text: string) { if (text !== vcrText) { vcrText = text; vcrTex.redraw() } },
    setMidnight(on: boolean) { st.midnight = on },
    setAmbient(index: number) { ambGoal.set(AMB[((index % AMB.length) + AMB.length) % AMB.length]); st.pulse = Math.max(st.pulse, .6) },
    setAmbientHex(hex: number) { ambGoal.set(hex); st.pulse = Math.max(st.pulse, .6) },
    pulse(v: number) { st.pulse = Math.max(st.pulse, v) },
    flick(v: number) { st.flicker = Math.max(st.flicker, v) },
    setStorm(on: boolean) { st.stormGoal = on ? 1 : 0 },
    lightning() { st.bolt = 1; st.flicker = .9 },
    boltLevel: () => st.bolt,
    setKnob(angle: number) { st.knob = angle },
    setPapers(n: number, animate: boolean) {
      n = Math.max(0, Math.min(SHEETS, n))
      sheets.forEach((s, k) => { const on = k < n; if (on && !s.m.visible) s.drop = animate ? 1 + Math.max(0, k - sheetsShown) * .35 : 0; s.m.visible = on })
      sheetsShown = n; shadowsDirty = true
    },
    papers: () => sheetsShown,
    /** Advance animation. `desk` is 0 (room) … 1 (pushed in to the screen). */
    update(dt: number, desk: number) {
      const t = performance.now() / 1000
      st.power += ((st.tvOn ? 1 : 0) - st.power) * Math.min(1, dt * 3)
      st.flicker *= Math.pow(.08, dt); st.pulse *= Math.pow(.2, dt)
      st.storm += (st.stormGoal - st.storm) * Math.min(1, dt * 1.4); st.bolt = Math.max(0, st.bolt - dt * 3.2)
      ambCol.lerp(ambGoal, Math.min(1, dt * 2.5))
      const col = st.midnight ? TVMID : tmp.copy(ambCol).lerp(TVCOL, .25)
      tvLight.color.copy(col)
      tvLight.intensity = st.power * (2.8 + st.pulse * 1.2 + Math.sin(t * 9) * .05 + st.flicker * (Math.random() - .3) + (st.midnight ? Math.random() * .6 : 0))
      const gl = st.power * (1 + st.pulse * .7 + Math.sin(t * 7.3) * .03 + st.flicker * (Math.random() - .3) * .5);
      ([[wallGlow, .55], [floorGlow, .4], [sideGlow, .14]] as const).forEach(([m, k]) => { const mm = m.material as THREE.MeshBasicMaterial; mm.color.copy(st.midnight ? TVMID : ambCol); mm.opacity = gl * k })
      ;(rainShadow.material as THREE.MeshBasicMaterial).opacity = desk * (.07 + st.storm * .16 + st.bolt * .5)
      dripTex.offset.y += dt * (.04 + st.storm * .22)
      rain2Mat.opacity = st.storm * .9; rain2Tex.offset.y += dt * 3.6; rain2Tex.offset.x += dt * .4
      rainTex.offset.y += dt * (1.8 + st.storm * 2.6); rainTex.offset.x += dt * (.15 + st.storm * .3)
      outsideMat.color.setScalar(1 + st.bolt * 2.6)
      hemi.intensity = .4 + st.bolt * 2.2
      chKnob.rotation.z += (-st.knob - chKnob.rotation.z) * Math.min(1, dt * 9)
      for (const s of sheets) if (s.drop > 0) {
        s.drop = Math.max(0, s.drop - dt * 2.6); const d = Math.min(1, s.drop)
        s.m.position.y = s.base.y + d * d * .3; s.m.rotation.z = d * .3
        if (s.drop === 0) shadowsDirty = true
      }
    },
    render() {
      if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false }
      effect.render(scene, camera)
    },
    /** Draw another world (the TV-tower studio) with the same renderer, outline pass and camera. */
    renderScene(other: THREE.Scene) { effect.render(other, camera) },
    /** What the ray hits first in the room (furniture id), or null. */
    pickThing(ray: THREE.Raycaster): RoomThing | null { return (ray.intersectObjects(pickables, false)[0]?.object.userData.thing as RoomThing | undefined) ?? null },
    /** Where the TV's top sits, for the CHECK!! bubble. */
    tvTop: () => new THREE.Vector3(-0.65, 1.02, -1.72),
    setFov(f: number) { if (Math.abs(camera.fov - f) > .01) { camera.fov = f; camera.updateProjectionMatrix() } },
    /** The room TV's picture as a world frame (faces +z). */
    roomFrame() { return { c: new THREE.Vector3(SCREEN.x, SCREEN.y, SCREEN.z), right: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(0, 0, 1), w: SCREEN.w, h: SCREEN.h } },
    dispose() {
      scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose() } })
      for (const d of disposables) d.dispose()
      tvLight.shadow.map?.dispose()
      renderer.dispose()
    },
  }
}

export type RoomScene = ReturnType<typeof createRoomScene>
