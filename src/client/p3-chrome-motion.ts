/** P3-only continuous graphic light passes. Never moves targets or invokes native actions. */
export function createP3ChromeMotion(doc: Document) {
 const win=doc.defaultView!,root=doc.documentElement,mq=win.matchMedia?.('(prefers-reduced-motion: reduce)')
 const hosts='[data-windows-menu], [data-industrial-caption-fallback]'
 const controls='[data-sidebar-toggle],.wtg9ga_newSession,.wtg9ga_panelRow,.GAkraW_rail button,.wtg9ga_footArea button'
 const sheets=new Map<ParentNode,HTMLStyleElement>(),animations=new Set<Animation>(),paints=new Set<HTMLElement>()
 const timers=new Set<ReturnType<typeof setTimeout>>(),targets=new Map<HTMLElement,string|null>()
 type Pass={wrap:HTMLElement,p:HTMLElement,q:HTMLElement,mode:string}
 const passes=new Map<HTMLElement,Pass>(),iconEffects=new WeakMap<Element,Animation>()
 let active=false,disposed=false,layout:Element|null=null,lastCollapsed=false,observer:MutationObserver|null=null,selected=new WeakSet<HTMLElement>()
 const allowed=()=>active&&root.getAttribute('data-dsh-persona')==='p3'&&!disposed&&!mq?.matches&&doc.visibilityState!=='hidden'
 const later=(fn:()=>void,ms:number)=>{const t=setTimeout(()=>{timers.delete(t);fn()},ms);timers.add(t)}
 const css=(scope:string)=>`
 ${scope} [data-p3-motion-target]{isolation:isolate!important}
 ${scope} [data-p3-motion-wrap]{position:absolute!important;inset:0 -2px!important;pointer-events:none!important;z-index:-1!important;overflow:hidden!important;clip-path:polygon(0 8%,100% 0,96% 94%,0 100%);contain:layout paint}
 ${scope} [data-p3-motion-plane]{position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:35%!important;pointer-events:none!important;background:#4ee2ec;clip-path:polygon(25% 0,100% 0,75% 100%,0 100%)}
 ${scope} [data-p3-motion-plane="counter"]{top:auto!important;bottom:2px!important;height:4px!important;width:40%!important;background:#fff}
 ${scope} [data-p3-motion-wrap="fold"]{inset:0!important;z-index:0!important}
 ${scope} [data-p3-motion-wrap="fold"] [data-p3-motion-plane]{width:24%!important;clip-path:polygon(34% 0,100% 7%,64% 100%,0 94%)}
 ${scope} [data-p3-motion-wrap="entry"]{inset:0!important;z-index:0!important}
 @media(prefers-reduced-motion:reduce){${scope} [data-p3-motion-wrap]{display:none!important}}
 `
 const sheet=(parent:ParentNode)=>{if(sheets.has(parent))return;const s=doc.createElement('style');s.setAttribute('data-p3-chrome-motion-style','');s.textContent=css(parent===doc.head?'html[data-dsh-persona="p3"]':':host-context(html[data-dsh-persona="p3"])');parent.appendChild(s);sheets.set(parent,s)}
 const own=(b:HTMLElement)=>{if(!targets.has(b)){targets.set(b,b.getAttribute('data-p3-motion-target'));b.setAttribute('data-p3-motion-target','')}}
 const restore=(b:HTMLElement)=>{if(!targets.has(b))return;const old=targets.get(b)!;if(old===null)b.removeAttribute('data-p3-motion-target');else b.setAttribute('data-p3-motion-target',old);targets.delete(b)}
 const wrap=(b:HTMLElement,kind:string)=>{const w=doc.createElement('span');w.setAttribute('data-p3-motion-wrap',kind);w.setAttribute('aria-hidden','true');b.append(w);paints.add(w);return w}
 const plane=(w:HTMLElement,kind:string,color:string)=>{const p=doc.createElement('span');p.setAttribute('data-p3-motion-plane',kind);p.style.background=color;w.append(p);return p}
 const remove=(w:HTMLElement)=>{w.remove();paints.delete(w)}
 const animate=(el:Element,frames:Keyframe[],duration:number,delay=0)=>{
  if(!allowed()||typeof el.animate!=='function')return null
  const a=el.animate(frames,{duration,delay,easing:'cubic-bezier(.3,0,.25,1)',fill:el.hasAttribute('data-p3-motion-plane')?'both':'backwards'});animations.add(a)
  const done=()=>animations.delete(a);a.addEventListener('finish',done,{once:true});a.addEventListener('cancel',done,{once:true});return a
 }
 const after=(as:(Animation|null)[],fn:()=>void,duration:number)=>{const xs=as.filter((a):a is Animation=>!!a);if(xs.length)void Promise.all(xs.map(a=>a.finished.catch(()=>{}))).then(fn);else later(fn,duration)}
 const cancel=()=>{for(const a of animations)a.cancel();animations.clear();for(const t of timers)clearTimeout(t);timers.clear();for(const p of paints)p.remove();paints.clear();passes.clear();for(const b of [...targets.keys()])restore(b)}
 const pulse=(b:HTMLElement,mode:'hover'|'focus'|'select')=>{
  if(!allowed()||b.matches(':disabled,[aria-disabled="true"]'))return
  const existing=passes.get(b)
  if(existing){ // Focus/selection joins the SAME clock; never cancels/restarts a visible pass.
   if(mode==='select'&&existing.mode!=='select'){existing.mode=mode;existing.p.style.background='#fff';existing.q.style.background='#ee4275'}
   return
  }
  own(b);const w=wrap(b,'glint'),p=plane(w,'flag',b.getAttribute('data-dsh-p3-action')==='close'?'#0d3b9e':mode==='select'?'#fff':'#4ee2ec'),q=plane(w,'counter',mode==='select'?'#ee4275':'#fff')
  const pass={wrap:w,p,q,mode};passes.set(b,pass)
  // Both ends are completely outside the fixed clipping frame. No pop on removal.
  const a=animate(p,[{transform:'translateX(-150%)'},{transform:'translateX(420%)'}],340)
  const c=animate(q,[{transform:'translateX(420%)'},{transform:'translateX(-150%)'}],340)
  after([a,c],()=>{remove(w);if(passes.get(b)===pass){passes.delete(b);restore(b)}},360)
 }
 const buttonFrom=(e:Event)=>{for(const n of e.composedPath())if(n instanceof win.HTMLElement&&n.matches('button')){const host=(n.getRootNode()as ShadowRoot).host;return host instanceof win.Element&&host.matches(hosts)||n.matches(controls)?n:null}return null}
 const point=(e:Event)=>{if(!allowed())return;const b=buttonFrom(e);if(!b)return;const related=(e as PointerEvent).relatedTarget;if(related instanceof win.Node&&b.contains(related))return;pulse(b,e.type==='focusin'?'focus':'hover')}
 const click=(e:Event)=>{if(!allowed())return;const b=buttonFrom(e);if(b&&b.getAttribute('aria-current')!=='page'&&b.matches('.wtg9ga_panelRow,.wtg9ga_newSession'))pulse(b,'select')}
 const fold=()=>{
  if(!allowed()||!layout)return;const rail=layout.querySelector<HTMLElement>('.wtg9ga_root');if(!rail)return
  // Native layout is not delayed/replaced. One coalesced monotonic facet pass, no rebound.
  if(!rail.querySelector('[data-p3-motion-wrap="fold"]')){
   const w=wrap(rail,'fold'),p=plane(w,'fold','#4ee2ec'),forward=lastCollapsed
   const a=animate(p,[{transform:`translateX(${forward?'480%':'-150%'})`},{transform:`translateX(${forward?'-150%':'480%'})`}],330)
   after([a],()=>remove(w),350)
  }
  let i=0;for(const b of Array.from(rail.querySelectorAll<HTMLElement>(controls))){const icon=b.querySelector('svg');if(!icon)continue;const running=iconEffects.get(icon);if(running&&running.playState==='running')continue;const a=animate(icon,[{translate:`${lastCollapsed?-5:5}px 0`},{translate:'0px 0px'}],280,Math.min(i++*8,32));if(a)iconEffects.set(icon,a)}
 }
 const watch=()=>{
  const next=doc.querySelector('[data-p3-native-layout]');if(next===layout)return;observer?.disconnect();layout=next;if(!layout)return
  lastCollapsed=layout.hasAttribute('data-sidebar-collapsed');selected=new WeakSet(Array.from(layout.querySelectorAll<HTMLElement>('.wtg9ga_panelRow[aria-current="page"],.wtg9ga_newSession[aria-current="page"]')))
  observer=new win.MutationObserver(records=>{if(!active||!layout)return;const collapsed=layout.hasAttribute('data-sidebar-collapsed');if(collapsed!==lastCollapsed){lastCollapsed=collapsed;fold()}for(const target of new Set(records.filter(r=>r.attributeName==='aria-current').map(r=>r.target))){if(!(target instanceof win.HTMLElement)||!target.matches('.wtg9ga_panelRow,.wtg9ga_newSession'))continue;const value=target.getAttribute('aria-current')==='page';if(value&&!selected.has(target))pulse(target,'select');if(value)selected.add(target);else selected.delete(target)}})
  observer.observe(layout,{subtree:true,attributes:true,attributeFilter:['data-sidebar-collapsed','aria-current']})
 }
 const entrance=()=>{if(!allowed())return;const bed=doc.querySelector<HTMLElement>('[data-dsh-p3-caption-bed]');if(bed){const w=wrap(bed,'entry'),p=plane(w,'entry','#4ee2ec'),a=animate(p,[{transform:'translateX(-150%)'},{transform:'translateX(420%)'}],440);after([a],()=>remove(w),460)}layout?.querySelectorAll<HTMLElement>('.wtg9ga_panelRow').forEach((b,i)=>later(()=>pulse(b,'hover'),Math.min(i*16,48)))}
 const release=()=>{cancel();observer?.disconnect();observer=null;layout=null;for(const s of sheets.values())s.remove();sheets.clear()}
 const sync=()=>{if(disposed)return;const next=root.getAttribute('data-dsh-persona')==='p3';if(!next){active=false;release();return}for(const[parent,s]of sheets){const host=(parent as ShadowRoot).host;if(host&&!host.isConnected){s.remove();sheets.delete(parent)}}sheet(doc.head);for(const h of Array.from(doc.querySelectorAll(hosts)))if(h.shadowRoot)sheet(h.shadowRoot);watch();const fresh=!active;active=true;if(fresh)queueMicrotask(entrance)}
 const visibility=()=>{if(!allowed())cancel()}
 doc.addEventListener('pointerover',point,true);doc.addEventListener('focusin',point,true);doc.addEventListener('click',click,true);doc.addEventListener('visibilitychange',visibility);mq?.addEventListener?.('change',visibility)
 return{sync,dispose:()=>{if(disposed)return;active=false;release();doc.removeEventListener('pointerover',point,true);doc.removeEventListener('focusin',point,true);doc.removeEventListener('click',click,true);doc.removeEventListener('visibilitychange',visibility);mq?.removeEventListener?.('change',visibility);disposed=true}}
}
