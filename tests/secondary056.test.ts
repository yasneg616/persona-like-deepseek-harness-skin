import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const skinCss = readFileSync(new URL('../src/client/skin.css', import.meta.url), 'utf8')
const sectionStart = skinCss.indexOf('0.5.6 secondary menus')
const reducedMotion = skinCss.indexOf('@media (prefers-reduced-motion: reduce)', sectionStart)
const section056 = skinCss.slice(sectionStart, reducedMotion)
const reducedBlock = skinCss.slice(reducedMotion)

describe('0.5.6 P5 secondary menus & stages', () => {
  it('exists before @media (prefers-reduced-motion: reduce) and obeys opacity/steps invariants', () => {
    assert.ok(sectionStart > 0, '0.5.6 section missing from skin.css')
    assert.ok(reducedMotion > sectionStart, '0.5.6 must precede prefers-reduced-motion')
    assert.doesNotMatch(section056, /opacity|steps\(/)
  })

  it('scopes all secondary rules strictly to html[data-dsh-calling-card-skin]', () => {
    const cleaned = section056
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*|\{[^{}]*\})*\}/g, '')
    // Extract top-level and @media-nested selector headers cleanly using brace depth tracking.
    const selectors: string[] = []
    let depth = 0
    let buf = ''
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i]
      if (ch === '{') {
        const header = buf.trim()
        buf = ''
        if (header.startsWith('@media')) {
          depth += 1
        } else {
          if (header) selectors.push(header)
          depth += 1
        }
      } else if (ch === '}') {
        buf = ''
        depth = Math.max(0, depth - 1)
      } else {
        buf += ch
      }
    }
    assert.ok(selectors.length >= 20)
    for (const selector of selectors) {
      assert.ok(
        selector.includes('html[data-dsh-calling-card-skin]'),
        `Unscoped selector in 0.5.6: ${selector.slice(0, 120)}`,
      )
    }
  })

  it('covers Settings modal, sub-tabs, controls, and secondary main stages without capturing sidebar drawer', () => {
    for (const marker of [
      'AnXs9G_overlay',
      'AnXs9G_panel',
      'AnXs9G_navTitle',
      'AnXs9G_navCell',
      'AnXs9G_close',
      'Iwzhua_themeCube',
      '7qxJPq_stepper',
      'jrmgQW_rowCard',
      'qgYWUG_card',
      'XAL7Ya_tab',
      'St8tea_keyBadge',
      'J8V0KW_dialog',
      'TLFO4W_dialog',
      'V7pFBG_page',
      'olCj9W_page',
      'data-secondary-fixture',
      'role="switch"',
      ':not(.wtg9ga_root):not([data-sidebar-drawer] *):not([data-cc-attention-window])',
    ]) {
      assert.ok(section056.includes(marker), `Missing P5 secondary coverage for ${marker}`)
    }
  })

  it('resets 0.5.6 transforms under prefers-reduced-motion: reduce', () => {
    assert.ok(reducedBlock.includes('Iwzhua_themeCube'))
    assert.ok(reducedBlock.includes('AnXs9G_navCell'))
    assert.ok(reducedBlock.includes('translate: none !important;'))
    assert.ok(reducedBlock.includes('rotate: none !important;'))
  })

  it('brings P3 (1.5.11) and P4 (1.6.1) secondary menus/sub-tabs/controls to the same coverage spec cleanly', () => {
    const personaCss = readFileSync(new URL('../src/client/persona.css', import.meta.url), 'utf8')
    const p3Start = personaCss.indexOf('/* 1.5.11 P3 ONLY')
    const p4Marker = personaCss.indexOf('/* 1.6.0 P4 ONLY')
    const p4Start = personaCss.indexOf('/* 1.6.1 P4 ONLY')
    const footer = personaCss.lastIndexOf('/* Reduced motion: every P3/P4 layer')
    assert.ok(p3Start > 0 && p4Marker > p3Start)
    assert.ok(p4Start > p4Marker && footer > p4Start)
    const p3Sec = personaCss.slice(p3Start, p4Marker)
    const p4Sec = personaCss.slice(p4Start, footer)
    for (const [name, slice] of [['P3 1.5.11', p3Sec], ['P4 1.6.1', p4Sec]] as const) {
      for (const marker of [
        'AnXs9G_overlay',
        'AnXs9G_header',
        'AnXs9G_close',
        'Iwzhua_themeCube',
        '7qxJPq_stepper',
        'jrmgQW_rowCard',
        'qgYWUG_card',
        'XAL7Ya_tab',
        'St8tea_keyBadge',
        'J8V0KW_dialog',
        'TLFO4W_dialog',
        'V7pFBG_page',
        'olCj9W_page',
        'role="switch"',
        ':not(.wtg9ga_root):not([data-sidebar-drawer] *):not([data-cc-attention-window])',
      ]) {
        assert.ok(slice.includes(marker), `${name} missing secondary coverage for ${marker}`)
      }
      assert.equal(/backdrop-filter|setInterval|data-dsh-persona="p5"/.test(slice), false, `${name} violated persona.css invariant`)
    }
    assert.equal(p4Sec.includes('data-dsh-persona="p4"'), false, 'P4 1.6.1 must keep unquoted [data-dsh-persona=p4]')
  })
})
