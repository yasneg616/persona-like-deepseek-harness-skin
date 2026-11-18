/**
 * The skin picker in Settings → General → Appearance: three icon cards
 * (a radio group) instead of a plain select. Each card carries an original
 * mark for its mode — P3 a crescent over a dot-matrix sea, P4 a CRT set
 * full of static, P5 a tilted calling card with a star. Styles ship with the
 * component so they look the same whichever mode is active.
 */
import type { KeyboardEvent } from 'react'

export type PickerPersona = 'p3' | 'p4' | 'p5'

const CARDS: { value: PickerPersona, title: string, sub: string }[] = [
  { value: 'p3', title: 'P3', sub: 'Reload' },
  { value: 'p4', title: 'P4', sub: 'Golden' },
  { value: 'p5', title: 'P5', sub: 'Calling Card' },
]

function Mark({ value }: { value: PickerPersona }) {
  if (value === 'p3') return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#0b2bb8" />
      <path d="M0 0h64v30H0z" fill="#1455f5" />
      <circle cx="40" cy="20" r="11" fill="#eef8ff" />
      <circle cx="45" cy="16" r="10" fill="#1455f5" />
      {[0, 1, 2, 3, 4].map(row => Array.from({ length: 9 - row }, (_, i) => (
        <circle key={`${row}-${i}`} cx={4 + i * 7.2 + (row % 2) * 3.6} cy={36 + row * 6} r={1 + row * .45} fill="#7fe7ff" opacity={.55 + row * .1} />
      )))}
      <path d="M0 30h64" stroke="#34e1ff" strokeWidth="2" />
    </svg>
  )
  if (value === 'p4') return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#ffd21a" />
      <path d="M0 46 64 30v34H0z" fill="#ff9c0a" />
      <path d="M24 12 32 20 40 10" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" />
      <rect x="10" y="19" width="44" height="34" rx="7" fill="#111" />
      <rect x="15" y="24" width="27" height="24" rx="5" fill="#d9d9d9" />
      <path d="M17 29h22M17 33h18M19 37h20M17 41h21M18 45h16" stroke="#8a8a8a" strokeWidth="2" />
      <circle cx="48" cy="29" r="3" fill="#ffd21a" />
      <circle cx="48" cy="38" r="3" fill="#ffd21a" />
      <path d="M16 53v5M48 53v5" stroke="#111" strokeWidth="3" />
    </svg>
  )
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#0b0b0b" />
      <path d="M0 0h38L22 64H0z" fill="#e5191c" />
      <g transform="rotate(-12 32 34)">
        <rect x="13" y="18" width="38" height="30" fill="#fff" stroke="#000" strokeWidth="2.5" />
        <path d="M32 22l3.2 7.4 8 .7-6 5.3 1.8 7.8L32 39l-7 4.2 1.8-7.8-6-5.3 8-.7z" fill="#e5191c" stroke="#000" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

const CSS = `
.dsh-persona-pick { display: flex; gap: 10px; flex-wrap: wrap; }
.dsh-persona-pick button { all: unset; cursor: pointer; box-sizing: border-box; display: grid; grid-template-columns: 44px auto; align-items: center; gap: 10px; min-width: 150px; padding: 8px 14px 8px 8px;
  border: 2px solid color-mix(in srgb, currentColor 22%, transparent); background: color-mix(in srgb, currentColor 6%, transparent); transform: skewX(-8deg); transition: transform .14s, border-color .14s, box-shadow .14s; corner-shape: round; }
.dsh-persona-pick button > * { transform: skewX(8deg); }
.dsh-persona-pick svg { width: 44px; height: 44px; display: block; }
.dsh-persona-pick b { display: block; font: italic 900 20px/1 PersonaCondensed, "Barlow Semi Condensed", "Arial Narrow", sans-serif; letter-spacing: .5px; }
.dsh-persona-pick small { display: block; margin-top: 2px; font: 700 11px/1.2 PersonaCondensed, "Barlow Semi Condensed", sans-serif; letter-spacing: 2px; text-transform: uppercase; opacity: .7; }
.dsh-persona-pick button:hover { transform: skewX(-8deg) translateY(-2px); border-color: color-mix(in srgb, currentColor 55%, transparent); }
.dsh-persona-pick button:focus-visible { outline: 2px dashed currentColor; outline-offset: 3px; }
.dsh-persona-pick button[aria-checked="true"][data-v="p3"] { border-color: #34e1ff; box-shadow: 4px 4px 0 #1455f5; }
.dsh-persona-pick button[aria-checked="true"][data-v="p4"] { border-color: #ffd21a; box-shadow: 4px 4px 0 #111; }
.dsh-persona-pick button[aria-checked="true"][data-v="p5"] { border-color: #e5191c; box-shadow: 4px 4px 0 #000; }
.dsh-persona-pick button[aria-checked="true"] small { opacity: 1; }
`

export function PersonaPicker({ value, label, onPick }: { value: PickerPersona, label: string, onPick: (next: PickerPersona) => void }) {
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const i = CARDS.findIndex(c => c.value === value)
    const next = CARDS[(i + step + CARDS.length) % CARDS.length].value
    onPick(next)
    const group = event.currentTarget
    queueMicrotask(() => group.querySelector<HTMLButtonElement>(`[data-v="${next}"]`)?.focus())
  }
  return (
    <>
      <style data-dsh-persona-pick-style>{CSS}</style>
      <div className="dsh-persona-pick" role="radiogroup" aria-label={label} data-dsh-persona-picker onKeyDown={onKey}>
        {CARDS.map(card => (
          <button key={card.value} type="button" role="radio" data-v={card.value} aria-checked={card.value === value} tabIndex={card.value === value ? 0 : -1}
            aria-label={`${card.title} · ${card.sub}`} onClick={() => onPick(card.value)}>
            <Mark value={card.value} />
            <span><b>{card.title}</b><small>{card.sub}</small></span>
          </button>
        ))}
      </div>
    </>
  )
}
