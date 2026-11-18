import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createP3Immersion } from '../src/client/persona-immersion.ts'
function fixture(mode='p3', reduced=false) {
 const dom=new JSDOM(`<html data-dsh-persona="${mode}"><body><div id="frame"><div data-shell-overlay></div><div data-conversation-content></div></div></body></html>`,{pretendToBeVisual:true})
 const w=dom.window
 let match=reduced
 let listener: (()=>void)|undefined
 w.matchMedia=(()=>({get matches(){return match},addEventListener(_type:string,fn:()=>void){listener=fn},removeEventListener(){listener=undefined}})) as unknown as typeof w.matchMedia
 return {dom,w,d:w.document,motion(){match=true;listener?.()}}
}
const tick=()=>new Promise(r=>setTimeout(r,0))
test('whole-app water is a viewport body sibling, once per P3 entry, not per message or selection',async()=>{
 const {dom,w,d}=fixture();const stop=createP3Immersion(d,w as unknown as Window)
 assert.equal(d.documentElement.getAttribute('data-p3-immersion'),'enter')
 const water=d.querySelector('.dsh-persona-immersion')!
 assert.equal(water.parentElement,d.body);assert.equal(d.querySelector('#frame')!.contains(water),false)
 d.querySelector('[data-conversation-content]')!.setAttribute('data-conversation-session','synthetic-next');await tick()
 assert.equal(d.querySelector('.dsh-persona-immersion'),water)
 d.dispatchEvent(new w.Event('beforeinput',{bubbles:true}));assert.equal(d.documentElement.getAttribute('data-p3-immersion'),'settled');assert.equal(d.querySelector('.dsh-persona-immersion'),null)
 d.querySelector('[data-conversation-content]')!.textContent='local fixture typing';await tick();assert.equal(d.documentElement.getAttribute('data-p3-immersion'),'settled')
 stop();assert.equal(d.documentElement.hasAttribute('data-p3-immersion'),false);dom.window.close()
})
test('reduced motion starts settled and a live preference change settles immediately',()=>{
 const a=fixture('p3',true);const stopA=createP3Immersion(a.d,a.w as unknown as Window);assert.equal(a.d.documentElement.getAttribute('data-p3-immersion'),'settled');assert.equal(a.d.querySelector('.dsh-persona-immersion'),null);stopA();a.dom.window.close()
 const b=fixture();const stopB=createP3Immersion(b.d,b.w as unknown as Window);b.motion();assert.equal(b.d.documentElement.getAttribute('data-p3-immersion'),'settled');assert.equal(b.d.querySelector('.dsh-persona-immersion'),null);stopB();b.dom.window.close()
})
test('P4/P5 never get a water layer; leaving P3 cleans timers/state, deliberate return plays once',async()=>{
 for(const mode of ['p4','p5']){const f=fixture(mode);const stop=createP3Immersion(f.d,f.w as unknown as Window);assert.equal(f.d.querySelector('.dsh-persona-immersion'),null);assert.equal(f.d.documentElement.hasAttribute('data-p3-immersion'),false);stop();f.dom.window.close()}
 const f=fixture();const stop=createP3Immersion(f.d,f.w as unknown as Window);f.d.documentElement.dataset.dshPersona='p4';await tick();assert.equal(f.d.querySelector('.dsh-persona-immersion'),null);assert.equal(f.d.documentElement.hasAttribute('data-p3-immersion'),false);f.d.documentElement.dataset.dshPersona='p3';await tick();assert.equal(f.d.documentElement.getAttribute('data-p3-immersion'),'enter');stop();f.dom.window.close()
})
