import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { personaEssentials, rescopeP3R } from '../src/client/p4g/rescope.ts'
import { P4G_FLOWER_SVG, P4G_SPARK_SVG, P4G_WEATHER_SVG } from '../src/client/p4g/art.ts'
import { personaTokens } from '../src/client/tokens.ts'

/** Split a selector list on top-level commas only (commas inside :is()/:not() stay). */
const splitSelectors = (list: string) => { const out: string[] = []; let depth = 0, cur = ''
  for (const ch of list) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur); cur = '' } else cur += ch }
  return [...out, cur] }

const css = readFileSync(new URL('../src/client/p4g.css', import.meta.url), 'utf8')

test('P4G: the P3R stylesheet is re-scoped to p4g, quoted or minified, and nothing else moves', () => {
  const src = 'html[data-dsh-persona="p3r"] a{}html[data-dsh-persona=p3r] .b{}html[data-dsh-persona="p3"] c{}'
  assert.equal(rescopeP3R(src, 'p4g'), 'html[data-dsh-persona="p4g"] a{}html[data-dsh-persona="p4g"] .b{}html[data-dsh-persona="p3"] c{}')
  const p3r = readFileSync(new URL('../src/client/p3r.css', import.meta.url), 'utf8')
  assert.equal(/data-dsh-persona=("?)p3r\1\]/.test(rescopeP3R(p3r, 'p4g')), false)
})

test('P4G: every rule is scoped to html[data-dsh-persona="p4g"] and reduced motion stops its animation', () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*{[^}]*}/g, '').replace(/@keyframes[^{]+{(?:[^{}]*{[^}]*})*[^}]*}/g, '')
  const media = body.match(/@media \(prefers-reduced-motion: reduce\)\s*{([\s\S]*)}\s*$/)
  assert.ok(media, 'reduced-motion block is last')
  for (const rule of body.slice(0, media!.index).split('}').map(r => r.trim()).filter(Boolean)) {
    for (const sel of splitSelectors(rule.split('{')[0])) assert.match(sel.trim(), /^html\[data-dsh-persona="p4g"\]/, sel)
  }
  assert.match(media![1], /animation: none !important/)
  assert.doesNotMatch(css, /data-dsh-persona="?p[345]"?\]/)
})

test('P4G: palette is Golden (yellow, orange, sky, black) with chromatic cyan/magenta on the chosen command', () => {
  for (const ink of ['#ffe600', '#ff9d00', '#38b6ff', '#12110d', '#26d4ff', '#ff2f8e']) assert.ok(css.includes(ink), ink)
  assert.match(css, /\.p3r-menu button\.on \{[^}]*text-shadow: -4px 2px 0 var\(--p4g-cyan\), 4px -2px 0 var\(--p4g-magenta\)/)
  assert.match(css, /AbrilFatface-Regular\.ttf/)
})

test('P4G: art is original flat vector, no characters, images or scripts', () => {
  for (const svg of [P4G_FLOWER_SVG, P4G_SPARK_SVG, P4G_WEATHER_SVG]) {
    assert.equal(/<image|<script|href=|filter=|ATLUS|<text/i.test(svg), false)
  }
  assert.equal((P4G_FLOWER_SVG.match(/<path /g) || []).length, 6)
})

test('P4G: tokens are a warm dark single palette so the CRT picture stays readable', () => {
  const t = personaTokens('p4')
  assert.equal(t['--dsw-alias-bg-base'].dark, '#14110a')
  assert.equal(t['--dsw-alias-label-primary'].light, t['--dsw-alias-label-primary'].dark)
  assert.equal(t['--dsw-alias-brand-primary'].dark, '#ffd400')
})

test('P4G: only font faces and the settings row survive from persona.css', () => {
  const src = '/* x { } */@font-face{font-family:A;src:url(a)}html[data-dsh-persona="p4"] .a{color:red}.dsh-persona-settings{display:grid}' +
    '@media (x){.dsh-persona-settings{color:red}}html[data-dsh-persona="p3"] .dsh-persona-settings{color:blue}'
  assert.equal(personaEssentials(src), '@font-face{font-family:A;src:url(a)}\n.dsh-persona-settings{display:grid}')
  const real = personaEssentials(readFileSync(new URL('../src/client/persona.css', import.meta.url), 'utf8'))
  assert.equal((real.match(/@font-face/g) || []).length, 4)
  assert.doesNotMatch(real, /data-dsh-persona/)
})
