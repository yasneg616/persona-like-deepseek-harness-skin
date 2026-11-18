/** Re-scope the P3R stylesheet (quoted or minified selectors) to another persona value. */
export function rescopeP3R(css: string, to: string): string {
  return css.replace(/data-dsh-persona=("?)p3r\1\]/g, `data-dsh-persona="${to}"]`)
}

/**
 * The parts of persona.css that P4 Golden still needs (font faces, the settings row) when the rest of that
 * sheet — the dormant 2D P3/P4 rules — is switched off so the browser stops matching it on every restyle.
 */
export function personaEssentials(css: string): string {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  let depth = 0, start = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      const block = src.slice(start, i + 1).trim(), sel = block.slice(0, block.indexOf('{')).trim()
      if (sel.startsWith('@font-face') || (!sel.startsWith('@') && sel.includes('dsh-persona-settings') && !sel.includes('data-dsh-persona'))) out.push(block)
      start = i + 1
    }
  }
  return out.join('\n')
}
