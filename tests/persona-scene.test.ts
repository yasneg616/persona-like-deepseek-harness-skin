import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { createP3Scene } from '../src/client/persona-scene.ts'
function setup(){
 const dom=new JSDOM('<html data-dsh-persona="p3"><body><div id="frame"><aside><button data-sidebar-toggle></button><button data-cc-leaf data-cc-i="1" aria-current="page" aria-label="Plugins">Plugins</button></aside><main><h1>Plugins / 插件</h1><article data-plugin-package="test"><input aria-label="search"></article></main><div data-shell-overlay></div></div></body></html>',{pretendToBeVisual:true})
 const d=dom.window.document,f=d.querySelector('#frame') as HTMLElement
 return {dom,d,f,scene:createP3Scene(d,dom.window as unknown as Window,f)}
}
test('P3 record pages use actual route heading, one aria-hidden background and no fake metadata',()=>{
 const {dom,d,f,scene}=setup();scene.sync();scene.sync()
 assert.equal(d.querySelectorAll('.dsh-p3-record-page').length,1)
 assert.equal(d.querySelector('.dsh-p3-record-page')!.getAttribute('aria-hidden'),'true')
 assert.equal(d.querySelector('.dsh-p3-record-page')!.textContent,'SECTION / PLUGINS / 插件')
 d.querySelector('h1')!.outerHTML='<h2>Secondary panel</h2>';scene.sync();assert.equal(d.querySelector('.dsh-p3-record-page')!.textContent,'SECTION / SECONDARY PANEL')
 const initial=f.getAttribute('data-p3-route-motion')
 for(let i=0;i<100;i++){d.querySelector('article')!.append(d.createTextNode('content'));scene.sync()}
 assert.equal(f.getAttribute('data-p3-route-motion'),initial)
 scene.dispose();assert.equal(d.querySelector('[data-p3-secondary]'),null);assert.equal(d.querySelector('.dsh-p3-record-page'),null);dom.window.close()
})
test('P3 route choreography quiets while editing, pauses hidden and leaves P4/P5 clean',()=>{
 const {dom,d,f,scene}=setup();scene.sync();d.querySelector('input')!.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(f.hasAttribute('data-p3-quiet'),true)
 Object.defineProperty(d,'hidden',{value:true,configurable:true});d.dispatchEvent(new dom.window.Event('visibilitychange'));assert.equal(d.documentElement.hasAttribute('data-p3-suspended'),true)
 for(const mode of ['p4','p5']){d.documentElement.dataset.dshPersona=mode;scene.sync();assert.equal(d.querySelector('.dsh-p3-record-page'),null);assert.equal(f.hasAttribute('data-p3-route-motion'),false)}
 scene.dispose();assert.equal(d.documentElement.hasAttribute('data-p3-suspended'),false);dom.window.close()
})
test('1.5.6 preserves P3/P4 boundaries and self-contained background art',()=>{
 const css=readFileSync(new URL('../src/client/persona.css',import.meta.url),'utf8')
 assert.ok(css.indexOf('/* 1.5.6 P3 ONLY') < css.indexOf('/* 1.6.0 P4 ONLY'))
 for(const name of ['window-moon','surface-ripples','disc-panel','coast-foreground','shard-wipe']){const art=readFileSync(new URL('../assets/p3-'+name+'.svg',import.meta.url),'utf8');assert.match(art,/Original/);assert.equal(/<image|href=|<script|feTurbulence/.test(art),false)}
 const scene=readFileSync(new URL('../src/client/persona-scene.ts',import.meta.url),'utf8');assert.equal(/MutationObserver|setInterval|requestAnimationFrame|fetch\(/.test(scene),false)
 assert.match(css,/data-p3-suspended/);assert.match(css,/p3-moon-distance 90s/);assert.match(css,/p3-surface-breath 13s/)
})
