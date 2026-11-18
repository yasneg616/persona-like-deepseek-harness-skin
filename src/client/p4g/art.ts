/** Original flat vector art for P4 Golden mode. No characters, logos or game assets. */

/** Six rounded petals, black ink outline, white-ringed centre. Colours come from CSS (fill: currentColor). */
export const P4G_FLOWER_SVG = `<svg viewBox="-100 -100 200 200" aria-hidden="true"><g class="petals">${
  Array.from({ length: 6 }, (_, i) => `<path transform="rotate(${i * 60})" d="M0 -14 C -26 -30 -34 -70 -14 -88 C -6 -95 6 -95 14 -88 C 34 -70 26 -30 0 -14 Z"/>`).join('')
}</g><circle class="eye" r="17"/><circle class="dot" r="7"/></svg>`

/** A four-point glint used beside the flowers. */
export const P4G_SPARK_SVG = `<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0 -46 C 5 -12 12 -5 46 0 C 12 5 5 12 0 46 C -5 12 -12 5 -46 0 C -12 -5 -5 -12 0 -46 Z"/></svg>`

/** Weather medallion; `data-persona-weather` (sun | cloud | rain | fog) picks the visible strokes in p4g.css. */
export const P4G_WEATHER_SVG = `<span class="wx"><svg data-persona-weather="sun" viewBox="0 0 32 32" aria-hidden="true">
  <circle class="w-sun" cx="16" cy="16" r="7"/>
  <path class="w-rays" d="M16 2v5M16 25v5M2 16h5M25 16h5M6 6l3.5 3.5M22.5 22.5L26 26M6 26l3.5-3.5M22.5 9.5L26 6"/>
  <path class="w-cloud" d="M8 22h15a5 5 0 0 0 0-10a7 7 0 0 0-13 2a4 4 0 0 0-2 8z"/>
  <path class="w-rain" d="M11 25l-2 4M17 25l-2 4M23 25l-2 4"/>
  <path class="w-fog" d="M4 12h24M7 17h20M4 22h22M9 27h16"/>
</svg></span>`
