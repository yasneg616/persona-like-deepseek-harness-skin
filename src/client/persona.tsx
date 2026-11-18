import { createP3RouteSplash } from './persona-route-splash.ts'
import { PersonaPicker } from './persona-picker.tsx'
import { createP3Scene } from './persona-scene.ts'
import { createP3Immersion } from './persona-immersion.ts'
import { createP4Immersion, createP4RouteSplash, createP4Scene } from './persona-p4.ts'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { personaBanner, personaClock, personaDays } from './persona-clock.ts'
import { clearHeroType, clearNavLeaves, syncHeroType, syncNavLeaves, syncSideWidth } from './leaves.ts'

export type Persona = 'p3' | 'p4' | 'p5'
const key = 'dsh-calling-card-skin:persona'

function normalize(value: string | null): Persona {
  return value === 'p3' || value === 'p4' ? value : 'p5'
}

export function createPersonaPreference(win: Window | null) {
  const read = () => {
    try { return normalize(win?.localStorage.getItem(key) ?? null) }
    catch { return 'p5' }
  }
  let current = read()
  const listeners = new Set<() => void>()
  const update = (next: Persona) => {
    if (next === current) return
    current = next
    listeners.forEach(listener => listener())
  }
  return {
    get: () => current,
    set(next: Persona) {
      try { win?.localStorage.setItem(key, next) } catch { /* Applies for this window. */ }
      update(next)
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    listen() {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) update(read())
      }
      win?.addEventListener('storage', onStorage)
      return () => win?.removeEventListener('storage', onStorage)
    },
  }
}

type Preference = ReturnType<typeof createPersonaPreference>

function stamp(decoration: HTMLElement, frame: Element, now: Date) {
  const clock = personaClock(now)
  const set = (selector: string, text: string) => {
    decoration.querySelectorAll(selector).forEach(node => { if (node.textContent !== text) node.textContent = text })
  }
  set('[data-persona-time]', clock.time)
  set('[data-persona-period]', clock.period)
  set('[data-persona-date]', clock.date)
  set('[data-persona-day]', clock.day)
  set('[data-persona-banner]', personaBanner(now))
  decoration.querySelectorAll('[data-persona-day]').forEach(node => node.setAttribute('data-weekend', clock.weekend))
  decoration.querySelectorAll('svg[data-persona-weather]').forEach(node => node.setAttribute('data-persona-weather', clock.weather))
  decoration.querySelectorAll('[data-persona-days] > li').forEach((cell, index) => {
    const day = personaDays(now)[index]
    if (!day) return
    cell.querySelector('b')!.textContent = day.date
    cell.querySelector('span')!.textContent = day.day
    cell.setAttribute('data-weekend', day.weekend)
    cell.toggleAttribute('data-today', day.today)
  })
  decoration.style.setProperty('--persona-moon-shift', String(clock.moonShift))
  frame.toggleAttribute('data-persona-dark-hour', clock.darkHour)
}

/** Restarts the mode transition (P3 water wipe, P4 TV switch-on) by flipping between two keyframe sets. */
function cut(frame: Element) {
  frame.setAttribute('data-persona-cut', frame.getAttribute('data-persona-cut') === 'a' ? 'b' : 'a')
}

function sceneKey(documentRef: Document) {
  const content = documentRef.querySelector('[data-conversation-content]')
  const page = documentRef.querySelector('[data-cc-leaf][aria-current="page"]')?.getAttribute('data-cc-i') ?? ''
  return [documentRef.documentElement.dataset.dshPersona ?? '', content?.getAttribute('data-content-phase') ?? '',
    content?.getAttribute('data-conversation-session') ?? '', page].join('|')
}

/**
 * The giant echo word behind the layout (P3R's pause menu repeats the chosen command in the background):
 * the current page's label, the first leaf's label on the landing, otherwise SESSION.
 */
export function echoWord(documentRef: Document): string {
  const label = (node: Element | null) => (node?.getAttribute('data-cc-label') ?? node?.textContent ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
  const current = label(documentRef.querySelector('[data-cc-leaf][aria-current="page"]'))
  if (current) return current
  if (documentRef.querySelector('[data-conversation-content][data-content-phase="hero"]') || (documentRef.querySelector('[data-p3-native-layout] [data-cc-hero-group], [data-p4-native-layout] [data-cc-hero-group]'))) {
    return label(documentRef.querySelector('[data-cc-leaf][data-cc-i="0"]')) || 'NEW SESSION'
  }
  return 'SESSION'
}

function echo(decoration: HTMLElement, documentRef: Document) {
  const word = echoWord(documentRef)
  const node = decoration.querySelector('.dsh-persona-session') as HTMLElement | null
  if (!node || node.textContent === word) return
  node.textContent = word
  node.style.setProperty('--echo-len', String(Math.max(4, [...word].length)))
}

export function usePersona(preference: Preference) {
  const [persona, setPersona] = useState(preference.get)
  useEffect(() => {
    const sync = () => setPersona(preference.get())
    const stop = preference.subscribe(sync)
    sync()
    return stop
  }, [preference])
  return persona
}

export function PersonaSettings({ preference, documentRef }: { preference: Preference; documentRef: Document }) {
  const persona = usePersona(preference)
  const id = useId()
  const lang = documentRef.documentElement.lang.toLowerCase()
  const label = /^zh-(tw|hk|mo|hant)/.test(lang) ? '皮膚' : lang.startsWith('zh') ? '皮肤' : 'Skin'
  return (
    <div className="dsh-persona-settings">
      <label id={id}>{label}</label>
      <PersonaPicker value={persona} label={label} onPick={next => preference.set(next)} />
    </div>
  )
}

const BUBBLES = Array.from({ length: 12 }, (_, index) => index)
const DAYS = Array.from({ length: 7 }, (_, index) => index)

export function PersonaOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const art = ref.current
    const frame = art?.closest('[data-shell-overlay]')?.parentElement
    if (!art || !frame) return
    const decoration = art.cloneNode(true) as HTMLElement
    decoration.hidden = false
    frame.append(decoration)
    const stopImmersion = createP3Immersion(document, window)
    const sceneMotion = createP3Scene(document, window, frame as HTMLElement)
    const routeSplash = createP3RouteSplash(document, window, frame as HTMLElement)
    const stopP4Immersion = createP4Immersion(document, window)
    const p4Scene = createP4Scene(document, window, frame as HTMLElement)
    const p4Splash = createP4RouteSplash(document, window, frame as HTMLElement)
    let scene = sceneKey(document)
    const paint = () => {
      syncNavLeaves(document)
      sceneMotion.sync()
      routeSplash.sync()
      p4Scene.sync()
      p4Splash.sync()
      syncHeroType(document)
      syncSideWidth(document)
      echo(decoration, document)
      const next = sceneKey(document)
      if (next !== scene) {
        scene = next
        cut(frame)
      }
    }
    paint()
    cut(frame)
    stamp(decoration, frame, new Date())
    const clock = window.setInterval(() => stamp(decoration, frame, new Date()), 15000)
    const observer = new MutationObserver(records => {
      if (records.some(record => !(record.target as Element).closest('[data-conversation-scroll]'))) paint()
    })
    observer.observe(frame, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-current', 'data-phase', 'data-content-phase', 'data-conversation-session', 'data-sidebar-collapsed', 'data-sidebar-drawer'],
    })
    const modes = new MutationObserver(paint)
    modes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-dsh-persona'] })
    const resize = () => syncSideWidth(document)
    window.addEventListener('resize', resize)
    const handle = frame.querySelector('[data-side="sidebar"]')
    const drag = new MutationObserver(() => syncSideWidth(document))
    if (handle) drag.observe(handle, { attributes: true, attributeFilter: ['style'] })
    return () => {
      frame.removeAttribute('data-p3-native-layout')
      frame.removeAttribute('data-p4-native-layout')
      routeSplash.dispose()
      stopImmersion()
      sceneMotion.dispose()
      p4Splash.dispose()
      stopP4Immersion()
      p4Scene.dispose()
      observer.disconnect()
      modes.disconnect()
      window.clearInterval(clock)
      frame.removeAttribute('data-persona-cut')
      frame.removeAttribute('data-persona-dark-hour')
      window.removeEventListener('resize', resize)
      drag.disconnect()
      clearNavLeaves(document)
      clearHeroType(document)
      decoration.remove()
    }
  }, [])
  return (
    <div className="dsh-persona-art" ref={ref} hidden aria-hidden="true">
      <div className="dsh-persona-header" />
      <div className="dsh-p3-surface" data-for="p3" />
      <div className="dsh-p3-environment" data-for="p3"><div className="dsh-p3-window-moon" /><div className="dsh-p3-outside" /><div className="dsh-p3-carriage" /><i className="dsh-p3-glass" /></div>
      <div className="dsh-p3-disc" data-for="p3" />
      <div className="dsh-p3-headphones-seam" data-for="p3" />
      <div className="dsh-persona-caustics" data-for="p3"><i /><i /></div>
      <div className="dsh-p3-submerge" data-for="p3"><div className="dsh-p3-player" /><i className="dsh-p3-wake" /><i className="dsh-p3-release" /></div>
      <div className="dsh-persona-moon" data-for="p3"><i /></div>
      <div className="dsh-persona-shaft" data-for="p3" />
      <div className="dsh-persona-card" data-for="p3"><i /></div>
      <div className="dsh-persona-bubbles" data-for="p3">{BUBBLES.map(index => <i key={index} />)}</div>
      <div className="dsh-persona-panel" data-for="p4" />
      <div className="dsh-p4-band-top" data-for="p4" />
      <div className="dsh-p4-environment" data-for="p4"><div className="dsh-p4-portal-sun" /><div className="dsh-p4-inaba" /><div className="dsh-p4-studio" /><i className="dsh-p4-glint" /></div>
      <div className="dsh-p4-broadcast-wheel" data-for="p4" />
      <div className="dsh-p4-tuner-seam" data-for="p4" />
      <div className="dsh-p4-glasses-seam" data-for="p4"><div className="dsh-p4-glasses-prop" /><i className="dsh-p4-lens-flare" /><i className="dsh-p4-ribbon-trail" /></div>
      <div className="dsh-persona-stage" data-for="p4"><i /><i /><i /><i /><i /></div>
      <div className="dsh-persona-tv" data-for="p4"><i className="dsh-persona-antenna" /><i className="dsh-persona-knobs" /></div>
      <div className="dsh-persona-static" data-for="p4" />
      <div className="dsh-persona-fog" data-for="p4"><i /><i /></div>
      <div className="dsh-persona-illustration" />
      <div className="dsh-persona-wordmark">DEEPSEEK<br />{' '}HARNESS</div>
      <div className="dsh-persona-session">SESSION</div>
      <div className="dsh-persona-tagline">
        <span data-for="p3">MEMENTO MORI</span>
        <span data-for="p4">SEEK YOUR TRUTH</span>
      </div>
      <div className="dsh-persona-clock" data-for="p3">
        <span className="dsh-persona-phase"><i /></span>
        <span className="dsh-persona-date"><b data-persona-date>1/1</b> <span data-persona-day>MON</span></span>
        <b data-persona-time>0:00</b>
        <small data-persona-period>DARK HOUR</small>
        <em data-persona-banner>WEEKDAY</em>
      </div>
      <ol className="dsh-persona-days" data-for="p4" data-persona-days>
        {DAYS.map(index => <li key={index}><b>1/1</b><span>MON</span></li>)}
      </ol>
      <div className="dsh-persona-calendar" data-for="p4">
        <b data-persona-date>1/1</b>
        <span data-persona-day>MON</span>
        <small data-persona-period>EVENING</small>
        <svg data-persona-weather="sun" viewBox="0 0 32 32" width="34" height="34">
          <circle className="w-sun" cx="16" cy="16" r="7" />
          <path className="w-rays" d="M16 2v5M16 25v5M2 16h5M25 16h5M6 6l3.5 3.5M22.5 22.5L26 26M6 26l3.5-3.5M22.5 9.5L26 6" />
          <path className="w-cloud" d="M8 22h15a5 5 0 0 0 0-10a7 7 0 0 0-13 2a4 4 0 0 0-2 8z" />
          <path className="w-rain" d="M11 25l-2 4M17 25l-2 4M23 25l-2 4" />
          <path className="w-fog" d="M4 12h24M7 17h20M4 22h22M9 27h16" />
        </svg>
      </div>
    </div>
  )
}
