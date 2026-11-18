import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { personaBanner, personaClock, personaDays } from '../src/client/persona-clock.ts'

const css = readFileSync(new URL('../src/client/persona.css', import.meta.url), 'utf8')

test('persona clock: Dark Hour, periods, weekday tabs and weather moods follow local time', () => {
  const dark = personaClock(new Date(2026, 10, 14, 0, 12))
  assert.deepEqual([dark.time, dark.period, dark.darkHour, dark.weather], ['0:12', 'DARK HOUR', true, 'fog'])
  assert.deepEqual([dark.date, dark.day, dark.weekend], ['11/14', 'SAT', 'sat'])
  const noon = personaClock(new Date(2026, 10, 13, 13, 5))
  assert.deepEqual([noon.time, noon.period, noon.darkHour, noon.weather, noon.day, noon.weekend], ['13:05', 'LUNCHTIME', false, 'sun', 'FRI', ''])
  assert.equal(personaClock(new Date(2026, 10, 15, 17, 30)).weather, 'cloud')
  assert.equal(personaClock(new Date(2026, 10, 15, 21, 0)).weather, 'rain')
  assert.equal(personaClock(new Date(2026, 10, 15, 21, 0)).weekend, 'sun')
})

test('persona clock: the moon shadow covers at new moon and clears at full moon', () => {
  const newMoon = Date.UTC(2026, 10, 9, 7, 2)
  assert.ok(Math.abs(personaClock(new Date(newMoon)).moonShift) <= .05)
  const full = personaClock(new Date(newMoon + 14.77 * 86400000)).moonShift
  assert.ok(Math.abs(full) >= .95, `full moon shift ${full}`)
  assert.ok(personaClock(new Date(newMoon + 5 * 86400000)).moonShift < 0, 'waxing slides the shadow left')
  assert.ok(personaClock(new Date(newMoon + 22 * 86400000)).moonShift > 0, 'waning brings it back from the right')
})

test('persona.css only reaches P3/P4 and its own overlay, so P5 stays as it was', () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const flat = body.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/@font-face\s*\{[^}]*\}/g, '')
  const selectors: string[] = []
  const walk = (text: string) => {
    for (const match of text.matchAll(/([^{}]+)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) {
      const head = match[1].trim()
      if (head.startsWith('@media')) walk(match[2])
      else selectors.push(...head.split(/,(?![^(]*\))/).map((part) => part.trim()))
    }
  }
  walk(flat)
  assert.ok(selectors.length > 150)
  const loose = selectors.filter((selector) => !/data-dsh-persona|\.dsh-persona-/.test(selector))
  assert.deepEqual(loose, [])
})

test('persona motion: own transitions per mode, no repeated opacity or stepped keyframes, reduced motion last', () => {
  for (const name of ['p3-wave-a', 'p3-wave-b', 'p3-rise', 'p3-drift', 'p3-ribbon', 'p4-tv-a', 'p4-tv-b', 'p4-burst-a', 'p4-burst-b', 'p4-bounce', 'p4-fog']) {
    assert.match(css, new RegExp(`@keyframes ${name} \\{`), name)
  }
  for (const frames of css.matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) {
    if(frames[1]==='p3-world-caustic') { assert.match(frames[2], /100% \{ opacity:0;/, 'one-time caustic settles by fading out, never blinks') }
    else if(['p3-popup-ink','p3-command-plane-a','p3-command-plane-b','p3-panel-plane'].includes(frames[1])) {
      assert.match(frames[2],/from \{ opacity:(?:0|\.2|\.25);/);assert.match(frames[2],/to \{ opacity:1;/,'one-time assembly settles completely opaque')
      const uses=[...css.matchAll(new RegExp('animation:'+frames[1]+'([^;]*);','g'))];assert.ok(uses.length);assert.ok(uses.every(use=>!use[1].includes('infinite')),'assembly never blinks or repeats')
    }
    else if(['p3-drop-impact','p3-impact-crest','p3-impact-rings','p3-impact-world'].includes(frames[1])) {
      assert.match(frames[2],/100% \{ opacity:0;/,'single physical event settles transparent')
      const uses=[...css.matchAll(new RegExp('animation:'+frames[1]+'([^;]*);','g'))];assert.ok(uses.length);assert.ok(uses.every(use=>!use[1].includes('infinite')),'impact is finite, never a blinking loop')
    }
    else assert.equal(/opacity|visibility/.test(frames[2]), false, `${frames[1]} must not blink`)
  }
  assert.equal(css.includes('steps('), false)
  const reduced = css.lastIndexOf('@media (prefers-reduced-motion: reduce)')
  assert.ok(reduced > 0)
  assert.equal(css.slice(reduced).match(/@media/g)?.length, 1, 'reduced-motion block is the last at-rule')
  assert.match(css.slice(reduced), /animation: none !important/)
})

test('persona taglines and selection colours are per mode', () => {
  const tsx = readFileSync(new URL('../src/client/persona.tsx', import.meta.url), 'utf8')
  assert.match(tsx, /data-for="p3">MEMENTO MORI</)
  assert.match(tsx, /data-for="p4">SEEK YOUR TRUTH</)
  assert.equal(tsx.includes('TAKE YOUR TIME'), false)
  assert.match(css, /html\[data-dsh-persona="p3"\] \{[^}]*--persona-selected: #0b84f0;[^}]*--persona-selected-ink: #ffffff;/)
  assert.match(css, /html\[data-dsh-persona="p4"\] \{[^}]*--persona-selected: #ffe600;[^}]*--persona-selected-ink: #111111;/)
})

test('1.2.0 layout: P3 banner and P4 calendar strip come from the real date, never a forecast', () => {
  assert.equal(personaBanner(new Date(2026, 10, 13, 0, 30)), 'DARK HOUR')
  assert.equal(personaBanner(new Date(2026, 10, 13, 19, 0)), 'WEEKDAY')
  assert.equal(personaBanner(new Date(2026, 10, 14, 19, 0)), 'WEEKEND')
  const days = personaDays(new Date(2026, 10, 30, 12, 0))
  assert.deepEqual(days.map((day) => day.date), ['11/27', '11/28', '11/29', '11/30', '12/1', '12/2', '12/3'])
  assert.deepEqual(days.filter((day) => day.today).map((day) => day.day), ['MON'])
  assert.deepEqual(days.map((day) => day.weekend), ['', 'sat', 'sun', '', '', '', ''])
  assert.equal(Object.keys(days[0]).includes('weather'), false)
})

test('1.2.0 layout: each mode has its own composition pieces and page transitions', () => {
  const tsx = readFileSync(new URL('../src/client/persona.tsx', import.meta.url), 'utf8')
  for (const piece of ['dsh-persona-shaft', 'dsh-persona-card', 'dsh-persona-stage', 'dsh-persona-tv', 'dsh-persona-days', 'data-persona-banner']) {
    assert.ok(tsx.includes(piece), piece)
  }
  assert.match(tsx, /aria-current="page"/, 'page changes are part of the scene key')
  for (const name of ['p3-echo-a', 'p3-card-a', 'p3-shaft', 'p3-leaf-water', 'p4-days-a', 'p4-title-a', 'p4-disc', 'p4-flower-spin', 'p4-band-flow']) {
    assert.match(css, new RegExp(`@keyframes ${name} \\{`), name)
  }
  assert.match(css, /\.dsh-persona-session \{[^}]*writing-mode: vertical-rl/, 'P3 echo stands vertical')
  for (const asset of ['p3-arcana.svg', 'p4-flower.svg', 'p4-onair.svg']) {
    const svg = readFileSync(new URL(`../assets/${asset}`, import.meta.url), 'utf8')
    assert.match(svg, /Original art/, asset)
    assert.equal(/<image|href="http/.test(svg), false, `${asset} embeds nothing external`)
  }
})


test('1.3 reference spatial art is original, no silhouettes, and P3/P4 keep different type grammar', () => {
  for (const file of ['p3-depth.svg','p4-perspective.svg']) {
    const art=readFileSync(new URL(`../assets/${file}`,import.meta.url),'utf8')
    assert.match(art, /Original/)
    assert.equal(/<image|href=|<text|<script/.test(art), false)
  }
  const layout=css.slice(css.indexOf('/* 1.3.0'))
  assert.match(layout,/white-red-pink wedge/)
  assert.match(layout,/p4-serif: Georgia/)
  assert.match(layout,/p3-sweep-a/)
  assert.match(layout,/p4-stripe/)
  assert.match(layout,/\.dsh-persona-illustration[^}]*display: none/)
})
