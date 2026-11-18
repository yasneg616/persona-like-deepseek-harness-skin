import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createP3RouteSplash } from '../src/client/persona-route-splash.ts'
function fixture(session='one'){
 const dom=new JSDOM(`<html data-dsh-persona="p3"><body><div id="frame"><button data-cc-leaf data-cc-i="1">Plugins</button><button data-cc-leaf data-cc-i="2">Automation</button><div data-row-key="workspace:one" aria-expanded="true"></div><div data-row-key="session:two"></div><main><div data-conversation-content data-conversation-session="${session}"><p>synthetic content</p><input></div></main></div></body></html>`,{pretendToBeVisual:true})
 const d=dom.window.document,w=dom.window as unknown as Window,f=d.querySelector('#frame') as HTMLElement
 let now=1000,id=0;const timers=new Map<number,{due:number,fn:()=>void}>();const media={matches:false,addEventListener(){},removeEventListener(){}}
 Object.defineProperty(w.performance,'now',{value:()=>now});w.matchMedia=()=>media as unknown as MediaQueryList
 w.setTimeout=((fn:()=>void,ms:number)=>{timers.set(++id,{due:now+ms,fn});return id}) as typeof w.setTimeout;w.clearTimeout=(n)=>{if(n!==undefined)timers.delete(n)}
 const advance=(ms:number)=>{const target=now+ms;for(let cap=0;cap<100;cap++){const item=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];if(!item||item[1].due>target)break;now=item[1].due;timers.delete(item[0]);item[1].fn()}now=target}
 const select=(page:string)=>{for(const e of Array.from(f.querySelectorAll('[data-cc-leaf]')))e.removeAttribute('aria-current');f.querySelector(`[data-cc-i="${page}"]`)?.setAttribute('aria-current','page')}
 const bind=(next:string)=>f.querySelector('[data-conversation-content]')!.setAttribute('data-conversation-session',next)
 const splash=createP3RouteSplash(d,w,f),layer=d.querySelector('.dsh-p3-route-splash') as HTMLElement;splash.sync()
 return {dom,d,w,f,advance,select,bind,splash,layer,timers,media}
}
test('confirmed session/page bindings splash once; repeated clicks, folders and streaming do not',()=>{
 const t=fixture();t.splash.sync();t.f.querySelector('[data-row-key^="workspace:"]')!.setAttribute('aria-expanded','false');t.f.querySelector('p')!.append('stream');t.splash.sync();t.advance(100);assert.equal(t.layer.dataset.sequence,undefined)
 t.bind('two');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,'1');assert.equal(t.layer.dataset.kind,'workspace');assert.equal(t.layer.hidden,false)
 t.splash.sync();t.advance(1100);assert.equal(t.layer.hidden,true);t.select('1');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,'2');assert.equal(t.layer.dataset.kind,'page')
 t.splash.dispose();assert.equal(t.timers.size,0);assert.equal(t.d.querySelector('.dsh-p3-route-splash'),null);t.dom.window.close()
})
test('rapid native switches coalesce and an active wake reveals latest content without stacking',()=>{
 const t=fixture();t.select('1');t.splash.sync();t.advance(10);t.select('2');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,'1')
 t.select('0');t.bind('three');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,'1');t.advance(1100);t.splash.sync();t.advance(50);assert.equal(t.layer.dataset.sequence,'1');assert.equal(t.layer.hidden,true)
 t.splash.dispose();t.dom.window.close()
})
test('typing cancels immediately, initial entry and reduced motion never stack a route splash',()=>{
 const t=fixture();t.d.documentElement.dataset.p3Immersion='enter';t.select('1');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,undefined)
 t.d.documentElement.dataset.p3Immersion='settled';t.splash.sync();t.advance(50);assert.equal(t.layer.hidden,true)
 t.select('2');t.splash.sync();t.advance(32);assert.equal(t.layer.hidden,false);t.f.querySelector('input')!.dispatchEvent(new t.dom.window.Event('beforeinput',{bubbles:true}));assert.equal(t.layer.hidden,true);assert.equal(t.d.documentElement.hasAttribute('data-p3-route-active'),false)
 t.select('1');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,'1');t.advance(1000);t.splash.sync();t.advance(50);assert.equal(t.layer.dataset.sequence,'1')
 t.media.matches=true;t.select('2');t.splash.sync();t.advance(32);assert.equal(t.layer.hidden,true)
 for(const mode of ['p4','p5']){t.d.documentElement.dataset.dshPersona=mode;t.splash.sync();assert.equal(t.layer.hidden,true)}t.splash.dispose();t.dom.window.close()
})
test('first-message binding is not navigation, hidden pages cancel and confirmed intent can open first session',()=>{
 const t=fixture('');t.bind('first-message');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,undefined)
 t.bind('');t.splash.sync();t.advance(32);t.advance(1100)
 t.f.querySelector('[data-row-key="session:two"]')!.dispatchEvent(new t.dom.window.Event('pointerdown',{bubbles:true}));t.bind('first-open');t.splash.sync();t.advance(32);assert.equal(t.layer.dataset.sequence,'2')
 Object.defineProperty(t.d,'hidden',{value:true,configurable:true});t.d.dispatchEvent(new t.dom.window.Event('visibilitychange'));assert.equal(t.layer.hidden,true);t.splash.dispose();t.dom.window.close()
})
test('1.5.7 uses P3R kinetic diagonal shard splash, keeps local art logo-free and preserves P4 boundary',()=>{
 const css=readFileSync(new URL('../src/client/persona.css',import.meta.url),'utf8')
 const p3RouteBlock=css.slice(css.indexOf('/* 1.5.7 P3 ONLY'),css.indexOf('/* Shared exit keyframes retained for P4 route layer compatibility. */'))
 assert.match(p3RouteBlock,/dsh-p3-route-shard-cyan/);assert.match(p3RouteBlock,/p3-route-sonar/);assert.equal(/opacity:0/.test(p3RouteBlock),false)
 for(const name of ['headphones','margin','shard-wipe']){const s=readFileSync(new URL('../assets/p3-'+name+'.svg',import.meta.url),'utf8');assert.match(s,/Original/);assert.equal(/<image|href=|<script|filter=|SONY|Audio.Technica|PERSONA/.test(s),false)}
 const source=readFileSync(new URL('../src/client/persona-route-splash.ts',import.meta.url),'utf8');assert.equal(/MutationObserver|setInterval|requestAnimationFrame|fetch\(|textContent|innerText/.test(source),false);assert.match(source,/data-conversation-session/);assert.match(source,/intentionally NOT an identity/);assert.match(source,/shard-cyan/);assert.match(source,/560\)/)
})
