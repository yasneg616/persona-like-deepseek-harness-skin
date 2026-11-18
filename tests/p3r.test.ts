import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { P3R_ITEMS, readWorkspaces } from '../src/client/p3r/overlay.ts'

const css = readFileSync(new URL('../src/client/p3r.css', import.meta.url), 'utf8')
const train = readFileSync(new URL('../src/client/p3r/train.css', import.meta.url), 'utf8')

/** Top-level selectors of a stylesheet (keyframe steps and @-rules skipped). */
function selectors(text: string): string[] {
  const out: string[] = []
  const body = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').replace(/@import[^;]+;/g, '')
  const media = body.replace(/@media[^{]+\{((?:[^{}]*\{[^}]*\})*)[^}]*\}/g, '$1')
  const split = (list: string) => { const parts: string[] = []; let depth = 0, cur = ''
    for (const ch of list) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch }
    return [...parts, cur].map(s => s.trim()).filter(Boolean) }
  for (const m of media.matchAll(/([^{}]+)\{[^}]*\}/g)) out.push(...split(m[1]))
  return out
}

test('P3R styles only ever match P3 mode (never P4, P5 or the host without the skin)', () => {
  const loose = selectors(css).filter(s => !s.startsWith('html[data-dsh-persona="p3r"]'))
  assert.deepEqual(loose, [])
  const looseTrain = selectors(train).filter(s => !s.startsWith('.p3r-train'))
  assert.deepEqual(looseTrain, [])
  // our keyframes are namespaced so they can never replace persona.css / skin.css animations
  for (const name of [...css.matchAll(/@keyframes\s+([\w-]+)/g), ...train.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1])) assert.match(name, /^p3r-/)
})

test('P3R keeps reduced motion and does not touch the 1.x P3 or P4 selectors', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(train, /@media \(prefers-reduced-motion: reduce\)/)
  assert.equal(/data-dsh-persona="p3"\]|data-dsh-persona=p4|data-dsh-persona="p4"/.test(css), false)
})

test('workspaces are read from the real tree; the current one owns the selected session', () => {
  const d = new JSDOM(`<div>
    <div data-row-key="workspace:a" aria-expanded="false"><span class="x_title">Alpha</span></div>
    <div data-row-key="workspace:b" aria-expanded="true"><span class="x_title">Beta 2</span></div>
    <div data-row-key="session:1" aria-selected="false"></div>
    <div data-row-key="session:2" class="wnFoaW_sessionRow wnFoaW_selected"></div>
    <div data-row-key="workspace:c"><span class="x_title">Gamma</span></div></div>`).window.document
  const spaces = readWorkspaces(d)
  assert.deepEqual(spaces.map(s => [s.key, s.name, s.current]), [['workspace:a', 'Alpha', false], ['workspace:b', 'Beta 2', true], ['workspace:c', 'Gamma', false]])
})

test('menu items forward to the four genuine rc3 page buttons, More included', () => {
  const html = readFileSync(new URL('../preview/native-rc3.html', import.meta.url), 'utf8').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
  const d = new JSDOM(html).window.document
  const found = Object.fromEntries(P3R_ITEMS.map(i => [i.key, i.find(d)?.getAttribute('aria-label') ?? null]))
  assert.equal(found.new, '新会话')
  assert.equal(found.plugins, 'Plugins')
  assert.equal(found.automation, 'Automation tasks')
  assert.equal(found.more, '更多')
  assert.ok(found.more && P3R_ITEMS.find(i => i.key === 'more')!.find(d)!.closest('[class*="_moreAnchor"]'))
  // the settings/account menu at the bottom of the white is never one of the four
  for (const i of P3R_ITEMS) assert.equal(i.find(d)?.closest('[class*="_settingsArea"]') ?? null, null)
})

test('apply() maps P3 to the p3r attribute so the 1.x P3 layers stay dormant', () => {
  const src = readFileSync(new URL('../src/client/apply.ts', import.meta.url), 'utf8')
  assert.match(src, /root\.dataset\.dshPersona = persona === 'p3' \? 'p3r' : persona/)
  assert.match(src, /persona === 'p3' \? createElement\(P3ROverlay\)/)
})

test('circles stay circles under the desktop shell superellipse corners', () => {
  // the desktop app injects `*, :before, :after { corner-shape: var(--dsw-corner-shape) }` with superellipse(1.5)
  assert.match(css, /html\[data-dsh-persona="p3r"\] \{ --dsw-corner-shape: round; \}/)
  assert.match(css, /corner-shape: round; \}/)
  assert.match(train, /\.p3r-train \*, \.p3r-train \*::before, \.p3r-train \*::after \{ corner-shape: round; \}/)
  // stations are drawn on the real rows only (data-row-key), never on nested parts whose class merely contains "_projectRow"
  assert.equal(/\[class\*="_(project|session)Row"\]/.test(css), false)
})

test('the skin picker is a radio group of three marked cards', async () => {
  const esbuild = await import('esbuild')
  const { pathToFileURL } = await import('node:url'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path')
  const out = pathToFileURL(join(tmpdir(), `p3r-picker-${process.pid}.test.mjs`))
  await esbuild.build({ entryPoints: [fileURLToPath(new URL('../src/client/persona-picker.tsx', import.meta.url))], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', outfile: fileURLToPath(out), logLevel: 'silent' })
  const { PersonaPicker } = await import(out.href)
  // hook-free component: walk the element tree it returns (function components are expanded)
  const nodes: { type: unknown, props: Record<string, unknown> }[] = []
  const walk = (el: unknown): void => {
    if (Array.isArray(el)) return el.forEach(walk)
    if (!el || typeof el !== 'object' || !('props' in el)) return
    const node = el as { type: unknown, props: Record<string, unknown> }
    if (typeof node.type === 'function') return walk((node.type as (p: unknown) => unknown)(node.props))
    nodes.push(node); walk(node.props.children)
  }
  walk(PersonaPicker({ value: 'p4', label: '皮肤', onPick: () => {} }))
  const group = nodes.find(n => n.props.role === 'radiogroup')
  assert.equal(group?.props['aria-label'], '皮肤')
  const radios = nodes.filter(n => n.props.role === 'radio')
  assert.deepEqual(radios.map(r => [r.props['data-v'], r.props['aria-checked'], r.props.tabIndex]), [['p3', false, -1], ['p4', true, 0], ['p5', false, -1]])
  assert.equal(nodes.filter(n => n.type === 'svg').length, 3)
})
