import skinCss from 'skin.css'
import personaCss from 'persona.css'
import p3rCss from 'p3r.css'
import p4gCss from 'p4g.css'
import { PLUGIN_INJECT, PLUGIN_NAME, apply as applySkin, type SkinContext } from './apply.ts'

export const name = PLUGIN_NAME
export const inject = [...PLUGIN_INJECT]

export function apply(ctx: SkinContext): void {
  applySkin(ctx, document, skinCss, personaCss, p3rCss, p4gCss)
}
