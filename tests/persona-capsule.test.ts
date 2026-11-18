import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
const css = readFileSync(new URL('../src/client/persona.css', import.meta.url), 'utf8')

test('1.5 adds only a P3-scoped block; the accepted 1.4 stylesheet is preserved', () => {
  const start = css.indexOf('/* 1.5.0 P3 ONLY')
  const end = css.lastIndexOf('/* Reduced motion: every P3/P4 layer')
  assert.ok(start > 0 && end > start)
  const original = (css.slice(0, start) + css.slice(end)).replace(/\r\n/g, '\n')
  assert.equal(createHash('sha256').update(original).digest('hex'), 'a3c9087c74588682a44d09d8ee8ab34bd927b3a6562b4ac93cf122dad59ee429')
  const added = css.slice(start, end)
  assert.equal(added.includes('data-dsh-persona="p4"'), false)
  assert.equal(added.includes('data-dsh-persona="p5"'), false)
})

test('capsule is original self-contained vector geometry with cylindrical collar, display and twin cord', () => {
  const art = readFileSync(new URL('../assets/p3-capsule.svg', import.meta.url), 'utf8')
  assert.match(art, /Original flat vector study/)
  assert.match(art, /twin cord/)
  assert.equal(/linearGradient|radialGradient|filter=|feDropShadow|feGaussianBlur/.test(art),false,'only solid editorial ink, no product-render effects')
  for(const ink of ['#030711','#06122e','#f8fbfa','#34e1ff','#1455f5']) assert.ok(art.includes(ink))
  assert.equal(/<image|href=|<script|SONY|WALKMAN|PERSONA|Full Moon Full Life/.test(art), false)
  assert.match(art, /height="294" rx="25"/, 'cylindrical main body')
})

test('capsule entry sinks once; the buoyancy loop closes continuously and native sidebar coordinates remain untouched', () => {
  assert.match(css, /@keyframes p3-seam-arrive \{ from \{ transform:translate\(22px,-95px\)/)
  assert.match(css, /@keyframes p3-capsule-buoyancy \{ 0%,100% \{ transform:translate\(0,0\) rotate\(0deg\)/)
  assert.match(css, /p3-capsule-buoyancy 11s ease-in-out 3.8s infinite/)
  const overlay = readFileSync(new URL('../src/client/persona.tsx', import.meta.url), 'utf8')
  assert.equal(overlay.includes('mirrorPersonaResize'), false)
  assert.match(overlay, /className="dsh-p3-submerge" data-for="p3"/)
})

test('1.5.2 uses crisp P3R shard entry under 1s and original P3R crystalline margin/shard art',()=>{
 const entry=readFileSync(new URL('../src/client/persona-immersion.ts',import.meta.url),'utf8')
 assert.match(entry,/dsh-p3-entry-wash/);assert.match(entry,/dsh-p3-entry-shards/);assert.match(entry,/dsh-p3-entry-sonar/)
 assert.match(entry,/setTimeout\(settle,\s*860\)/);assert.match(entry,/prefers-reduced-motion:\s*reduce/)
 for(const name of ['p3-margin','p3-shard-wipe']){
  const art=readFileSync(new URL('../assets/'+name+'.svg',import.meta.url),'utf8')
  assert.match(art,/Original/);assert.equal(/<image|href=|<script|filter=/.test(art),false);assert.match(art,/#39e5ff/)
 }
})


test('1.5.3 frame grammar is P3-scoped, keeps native data/actions straight and leaves immersion untouched',()=>{
 const frames=css.slice(css.indexOf('/* 1.5.3'),css.indexOf('/* 1.5.4'))
 for(const hook of ['GAkraW_sectionLabel','[data-row-key]','[role^="menuitem"]','[data-shortcut-modal="settings"]','[data-presented-file]','.LOmM4q_turnErrorRow','[data-composer-seat]']) assert.ok(frames.includes(hook),hook)
 assert.match(frames,/content:"NETWORK"/);assert.match(frames,/grid-template-columns:minmax\(0,1fr\)/)
 assert.match(frames,/\[class\*="_title"\].*transform:none/)
 assert.match(frames,/prefers-reduced-motion:reduce/)
 assert.equal(/data-dsh-persona="p[45]"|filter:blur|animation:.*infinite/.test(frames),false)
 assert.match(frames,/\[data-presented-file\]::before.*pointer-events:none/)
})

test('frame audit reuses real host widget selectors, delivered-file preview/open actions and semantic error status',()=>{
 const fixture=readFileSync(new URL('../preview/persona.html',import.meta.url),'utf8')
 for(const marker of ['data-frame-audit','data-presented-file','data-open-path-open','data-open-path-more','LOmM4q_turnErrorRow','hSzSIW_header','data-terminal']) assert.ok(fixture.includes(marker),marker)
 assert.match(fixture,/frames.*===.?1/)
 assert.match(fixture,/insertAdjacentElement\("afterend",sample\)/)
})


test('1.5.4 panel primitives are real irregular polygon art, not transformed rectangles or content clips',()=>{
 for(const name of ['wide','index','selected']) {
  const svg=readFileSync(new URL('../assets/p3-panel-'+name+'.svg',import.meta.url),'utf8')
  assert.match(svg,/Original/);assert.match(svg,/preserveAspectRatio="none"/)
  assert.equal(/<rect|<image|<script|filter=|transform=|linearGradient/.test(svg),false)
  assert.ok((svg.match(/<path /g)||[]).length>=3)
 }
 const wide=readFileSync(new URL('../assets/p3-panel-wide.svg',import.meta.url),'utf8')
 assert.match(wide,/M0 10 944 46 978 340 28 386 27 368 42 364 25 350Z/,'independent top/bottom/side slopes and one deliberate notch')
 const top=[944,36],bottom=[950,-46];assert.notEqual(top[0]*bottom[1]-top[1]*bottom[0],0,'opposite panel edges must not be parallel')
 const added=css.slice(css.indexOf('/* 1.5.4'),css.indexOf('/* 1.5.5'))
 assert.match(added,/--p3-panel-wide/);assert.match(added,/pointer-events:none/);assert.match(added,/overflow:visible/)
 assert.equal(/data-dsh-persona="p[45]"|skew\(/.test(added),false)
})


test('1.5.5+ P3 environment and P3R overhaul remain P3-scoped and keep P3R shard transitions clean',()=>{
 const p3Block=css.slice(css.indexOf('/* 1.5.0 P3 ONLY'),css.indexOf('/* 1.6.0 P4 ONLY'))
 assert.equal(/data-dsh-persona="p[45]"|setInterval|backdrop-filter/.test(css.slice(css.indexOf('/* 1.5.5 P3 ONLY'),css.lastIndexOf('/* Reduced motion: every P3/P4 layer'))),false)
 assert.match(p3Block,/p3-world-descent \.78s/);assert.match(p3Block,/dsh-p3-entry-shard--cyan/)
 assert.match(css,/left:var\(--p3-strip\)/);assert.match(css,/pointer-events:none/)
 assert.match(p3Block,/prefers-reduced-motion:reduce/);assert.match(p3Block,/animation:none!important/)
})
test('1.5.5 scenery is self-contained original vector environment, never licensed screenshot wallpaper',()=>{
 for(const name of ['carriage','outside','water-glint','disc']) {
  const svg=readFileSync(new URL('../assets/p3-'+name+'.svg',import.meta.url),'utf8')
  assert.match(svg,/Original/);assert.equal(/<image|href=|<script|feGaussianBlur|feTurbulence/.test(svg),false)
 }
 const tsx=readFileSync(new URL('../src/client/persona.tsx',import.meta.url),'utf8')
 assert.match(tsx,/dsh-p3-environment" data-for="p3"/)
 assert.match(tsx,/className="dsh-persona-art"[^>]*aria-hidden="true"/)
})
