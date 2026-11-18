import { mountP3Chrome } from './p3-chrome.ts'
import { BrandMark, BrandName, CallingCardOverlay, HeroMark } from './overlay.tsx'
import { installSkinStyle, STYLE_ID } from './dom.ts'
import { createPersonaPreference, PersonaOverlay, PersonaSettings, usePersona } from './persona.tsx'
import { CALLING_CARD_SOURCE, personaTokens, type ThemeTokenOverrides } from './tokens.ts'
import { createElement } from 'react'
import { P3ROverlay } from './p3r/component.ts'
import { P4GOverlay } from './p4g/component.ts'
import { personaEssentials, rescopeP3R } from './p4g/rescope.ts'

export interface ThemeApi {
  overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void
  getTheme?: () => unknown
}

export interface SlotRegisterOptions {
  name: string
  id: string
  order?: number
  priority?: number
}

export interface SlotsApi {
  register(options: SlotRegisterOptions, component: unknown): () => void
  inject?(key: string, callback: () => (() => void) | void): () => void
}

export interface SkinContext {
  theme: ThemeApi
  slots: SlotsApi
  effect(setup: () => (() => void) | void): () => void
  on?(event: string, listener: () => void): () => void
}

const OVERLAY_ID = 'dsh-calling-card-skin.architecture'
const MARK_ID = 'dsh-calling-card-skin.mark'
const NAME_ID = 'dsh-calling-card-skin.name'
const HERO_ID = 'dsh-calling-card-skin.hero'

function whenSlot(ctx: SkinContext, key: string, setup: () => (() => void) | void): void {
  if (typeof ctx.slots.inject === 'function') {
    ctx.slots.inject(key, setup)
    return
  }
  const stop = setup()
  if (typeof stop === 'function') ctx.effect(() => stop)
}

function registerBrand(ctx: SkinContext, name: string, id: string, component: unknown): () => void {
  try {
    return ctx.slots.register({ name, id, priority: -1 }, component)
  } catch (error) {
    console.warn(`[dsh-calling-card-skin] left ${name} to the occupant already registered`, error)
    return () => {}
  }
}

/**
 * Browser plugin body. Tokens, the scoped stylesheet, and slot contributions
 * are disposed with the Cordis fiber when the bundle is disabled or removed.
 */
export function apply(ctx: SkinContext, documentRef: Document = document, css = '', personaCss = '', p3rCss = '', p4gCss = ''): void {
  const preference = createPersonaPreference(documentRef.defaultView)
  ctx.effect(() => {
    const root = documentRef.documentElement
    const previousScheme = root.style.colorScheme
    const releaseStyle = installSkinStyle(documentRef, css)
    const callingCard = documentRef.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ID}"]`)
    const alternate = documentRef.createElement('style')
    alternate.dataset.pluginCss = 'dsh-calling-card-skin/persona.css'
    alternate.textContent = personaCss
    documentRef.head.append(alternate)
    // P4 Golden switches persona.css off (its rules are all for the 2D modes) and keeps only these
    const essentials = documentRef.createElement('style')
    essentials.dataset.pluginCss = 'dsh-calling-card-skin/persona-essentials.css'
    essentials.textContent = personaEssentials(personaCss)
    documentRef.head.append(essentials)
    const p3r = documentRef.createElement('style')
    p3r.dataset.pluginCss = 'dsh-calling-card-skin/p3r.css'
    p3r.textContent = p3rCss
    documentRef.head.append(p3r)
    // P4 Golden reuses the P3R composition (same layers, same host restyling) in its own palette
    const p4g = documentRef.createElement('style')
    p4g.dataset.pluginCss = 'dsh-calling-card-skin/p4g.css'
    p4g.textContent = rescopeP3R(p3rCss, 'p4g') + '\n' + p4gCss
    documentRef.head.append(p4g)
    let releaseTokens = () => {}
    const restamp = () => { root.style.colorScheme = 'dark' }
    const paint = () => {
      const persona = preference.get()
      // P3 is drawn by the P3R layers (p3r/); the 1.x P3 rules key on "p3" and stay dormant.
      root.dataset.dshPersona = persona === 'p3' ? 'p3r' : persona === 'p4' ? 'p4g' : persona
      if (callingCard) callingCard.media = persona === 'p5' ? '' : 'not all'
      alternate.media = persona === 'p4' ? 'not all' : ''
      essentials.media = persona === 'p4' ? '' : 'not all'
      releaseTokens()
      releaseTokens = ctx.theme.overrideTokens(CALLING_CARD_SOURCE, personaTokens(persona))
      restamp()
    }
    paint()
    const stopPreference = preference.subscribe(paint)
    const stopStorage = preference.listen()
    const stopListen = ctx.on?.('theme/change', restamp)
    return () => {
      stopStorage()
      stopPreference()
      stopListen?.()
      releaseTokens()
      alternate.remove()
      p3r.remove()
      p4g.remove()
      essentials.remove()
      releaseStyle()
      delete root.dataset.dshPersona
      root.style.colorScheme = previousScheme
    }
  })
  ctx.effect(() => mountP3Chrome(documentRef))
  whenSlot(ctx, 'shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: OVERLAY_ID,
    order: 12,
  }, function SkinOverlay() {
    const persona = usePersona(preference)
    return persona === 'p5' ? createElement(CallingCardOverlay) : persona === 'p3' ? createElement(P3ROverlay) : persona === 'p4' ? createElement(P4GOverlay) : createElement(PersonaOverlay)
  }))
  whenSlot(ctx, 'settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'dsh-calling-card-skin.persona',
    order: 10.5,
  }, function SkinSettings() {
    return createElement(PersonaSettings, { preference, documentRef })
  }))
  whenSlot(ctx, 'sidebar.brand.mark', () => registerBrand(ctx, 'sidebar.brand.mark', MARK_ID, BrandMark))
  whenSlot(ctx, 'sidebar.brand.name', () => registerBrand(ctx, 'sidebar.brand.name', NAME_ID, BrandName))
  whenSlot(ctx, 'conversation.hero.brand.mark', () => registerBrand(ctx, 'conversation.hero.brand.mark', HERO_ID,
    function SkinHero(props: Parameters<typeof HeroMark>[0]) {
      const persona = usePersona(preference)
      return persona === 'p5' ? createElement(HeroMark, props)
        : createElement('svg', { className: 'dsh-cc-hero', 'aria-hidden': true })
    }))
}

export const PLUGIN_NAME = 'dsh-calling-card-skin'
export const PLUGIN_INJECT = ['theme', 'slots'] as const
