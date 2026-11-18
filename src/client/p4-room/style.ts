/** Styles for the P4 3D room. Active only while html[data-p4-3d] is set (P4 + WebGL + motion allowed). */
export const P4_ROOM_CSS = String.raw`
html[data-p4-3d] [data-p4-frame] { animation: none !important; transform: none !important; filter: none !important; background: transparent !important; }
html[data-p4-3d] .dsh-persona-art { background: #04050b !important; }
html[data-p4-3d] .dsh-persona-art > :not(.dsh-p4-room-gl):not(.dsh-p4-room-flash):not(.dsh-persona-calendar) { display: none !important; }
html[data-p4-3d] .dsh-persona-p4-immersion,
html[data-p4-3d] .dsh-p4-route-splash { display: none !important; }

.dsh-p4-room-gl { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0;
  transition: filter 1.1s ease; filter: blur(0px) brightness(1) saturate(1); }
html[data-p4-room-view="desk"] .dsh-p4-room-gl { filter: blur(3.5px) brightness(.88) saturate(.95); }

/* The native conversation column becomes the picture on the CRT: a 4:3 box inside its grid cell,
   laid onto the 3D screen with a matrix3d. At rest (pushed in) the transform is none, so text stays crisp. */
html[data-p4-3d] [data-p4-screen] {
  margin: var(--p4-my, 0px) var(--p4-mx, 0px) !important;
  border-radius: 7% / 9.3% !important;
  overflow: hidden !important;
  transform-origin: 0 0 !important;
  animation: none !important; translate: none !important; rotate: none !important; scale: none !important;
  position: relative; z-index: 1;
  box-shadow: 0 0 0 3px #0b0a08, 0 0 46px 6px rgba(var(--p4-room-glow, 191,216,255), .28) !important;
}
/* The 2D P4 drew its own CRT bezel on the conversation root; the 3D TV is the bezel now. */
html[data-p4-3d][data-dsh-persona] [data-p4-screen] [data-p4-root] {
  margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; height: 100% !important; box-sizing: border-box !important;
}
html[data-p4-3d][data-dsh-persona] [data-p4-screen] [data-p4-root]::before,
html[data-p4-3d][data-dsh-persona] [data-p4-screen] [data-p4-root]::after,
html[data-p4-3d][data-dsh-persona] [data-p4-screen] [data-conversation-content]::before { display: none !important; }

.dsh-p4-room-glass { position: absolute; z-index: 2; pointer-events: none; border-radius: 7% / 9.3%; overflow: hidden; transform-origin: 0 0; display: none;
  --p4-noise: none; }
html[data-p4-3d] .dsh-p4-room-glass { display: block; }
.dsh-p4-room-glass::before { content: ""; position: absolute; inset: 0; z-index: 3;
  background:
    radial-gradient(ellipse 46% 30% at 28% 14%, rgba(255,255,255,.07), transparent 70%),
    repeating-linear-gradient(transparent 0 2px, rgba(0,0,0,.05) 2px 3px);
  box-shadow: inset 0 0 70px 10px rgba(0,0,0,.42), inset 0 0 0 2px rgba(0,0,0,.55); }
.dsh-p4-room-glass > i { position: absolute; inset: 0; display: none; }
.dsh-p4-room-glass .off { background: radial-gradient(ellipse 46% 30% at 28% 16%, rgba(255,255,255,.12), transparent 70%), radial-gradient(ellipse at center, #1c211e, #050605 78%); }
.dsh-p4-room-glass[data-state="off"] .off { display: block; }
.dsh-p4-room-glass .mc { background: var(--p4-noise) 0 0 / 180px, #b8c25a; background-blend-mode: multiply; animation: p4r-jit .09s steps(2) infinite; }
.dsh-p4-room-glass .mc::after { content: ""; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 40%, rgba(232,236,140,.55), rgba(40,46,10,.85) 75%); mix-blend-mode: hard-light; }
.dsh-p4-room-glass[data-state="midnight"] .mc { display: block; }
.dsh-p4-room-glass .tz { background: var(--p4-noise) 0 0 / 210px; animation: p4r-jit .1s steps(2) infinite; }
.dsh-p4-room-glass .tz::after { content: ""; position: absolute; inset: 0; background: linear-gradient(rgba(255,212,0,.55), rgba(214,214,120,.65)); mix-blend-mode: multiply; }
.dsh-p4-room-glass .bar { inset: 0 0 auto; height: 3%; background: linear-gradient(transparent, rgba(255,245,190,.95) 45%, #ffd400 55%, transparent); box-shadow: 0 0 30px 8px rgba(255,212,0,.55); }
.dsh-p4-room-glass[data-tune] .tz { display: block; animation: p4r-jit .1s steps(2) infinite, p4r-wipe .78s .12s cubic-bezier(.65,0,.3,1) both; }
.dsh-p4-room-glass[data-tune] .bar { display: block; animation: p4r-scan .78s .12s cubic-bezier(.65,0,.3,1) both; }
.dsh-p4-room-glass[data-zap] { animation: p4r-zap .32s steps(4) both; }
.dsh-p4-room-glass[data-zap]::after { content: ""; position: absolute; inset: 0; background: rgba(220,232,255,.35); animation: p4r-fade .32s ease-out both; }
@keyframes p4r-jit { 50% { background-position: 37px 21px; } }
@keyframes p4r-wipe { from { clip-path: inset(0 0 0 0); } to { clip-path: inset(100% 0 0 0); } }
@keyframes p4r-scan { from { transform: translateY(-100%); } to { transform: translateY(3400%); } }
@keyframes p4r-zap { 0% { filter: brightness(1.8); } 50% { filter: brightness(1.2); } 100% { filter: none; } }
@keyframes p4r-fade { to { opacity: 0; } }
html:is([data-p4-room-view="room"], [data-p4-room-view="orbit"]) .dsh-p4-room-glass { pointer-events: auto; cursor: zoom-in; }
html[data-p4-room-view="focus"] .dsh-p4-room-gl { filter: blur(3.5px) brightness(.88) saturate(.95); }
/* the conversation has no TV in this band / world: keep it out of sight and out of reach */
html[data-p4-offscreen] [data-p4-screen], html[data-p4-offscreen] .dsh-p4-room-glass { opacity: 0 !important; pointer-events: none !important; }
/* diving into the TV: the room goes yellow-black */
html[data-p4-dive] .dsh-p4-room-gl { transition-duration: .28s; filter: grayscale(1) sepia(1) saturate(7) hue-rotate(20deg) contrast(2.8) brightness(1.1); }
/* tower: drag / wheel / pick surface under the native columns */
.dsh-p4-tower-input { position: absolute; inset: 0; pointer-events: none; touch-action: none; }
html[data-p4-world="tower"] .dsh-p4-tower-input { pointer-events: auto; cursor: grab; }
/* room: the same surface takes hover / click on the furniture (and a click beside the TV steps back) */
html[data-p4-world="room"] .dsh-p4-tower-input { pointer-events: auto; }
html[data-p4-world="room"][data-p4-room-view="desk"] .dsh-p4-tower-input { cursor: zoom-out; }
.dsh-p4-plate { position: absolute; z-index: 41; pointer-events: none; opacity: 0; white-space: nowrap;
  background: #ffd400; color: #0a0a0a; font: 900 17px/1 system-ui, sans-serif; letter-spacing: .08em; padding: 8px 30px 9px 14px;
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%); filter: drop-shadow(4px 4px 0 #0a0a0a); }
.dsh-p4-plate.on { opacity: 1; animation: p4r-plate .22s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes p4r-plate { from { transform: translateX(-24px) skewX(-12deg); opacity: 0; } to { transform: none; opacity: 1; } }
.dsh-p4-check { position: absolute; z-index: 41; pointer-events: none; display: none; transform: translate(-50%, -120%) rotate(-6deg);
  background: #fff; color: #e2241b; font: italic 900 22px/1 "Barlow Condensed", Impact, sans-serif; letter-spacing: .04em; padding: 6px 12px 7px;
  border: 3px solid #0a0a0a; box-shadow: 4px 4px 0 #0a0a0a; }
.dsh-p4-check::after { content: ""; position: absolute; left: 44%; bottom: -12px; border: 7px solid transparent; border-top-color: #0a0a0a; }
.dsh-p4-check.on { display: block; animation: p4r-check .9s ease-in-out infinite; }
@keyframes p4r-check { 50% { transform: translate(-50%, -132%) rotate(-3deg); } }
.dsh-p4-msg { position: absolute; z-index: 42; left: 60%; bottom: 72px; width: min(620px, 56vw); transform: translateX(-50%) translateY(18px); opacity: 0; pointer-events: none; transition: opacity .2s, transform .25s cubic-bezier(.2,1.4,.4,1);
  background: rgba(10,10,10,.92); color: #fff; border: 3px solid #fff; border-radius: 14px; padding: 18px 24px 16px; box-shadow: 0 0 0 3px #0a0a0a, 6px 6px 0 3px #ffd400; }
.dsh-p4-msg.on { opacity: 1; transform: translateX(-50%); }
.dsh-p4-msg .who { position: absolute; left: 18px; top: -16px; background: #ffd400; color: #0a0a0a; font: 900 14px/1 system-ui, sans-serif; padding: 6px 16px 6px 10px; clip-path: polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%); }
.dsh-p4-msg p { margin: 0; font: 600 17px/1.6 system-ui, sans-serif; }
html[data-p4-dragging] .dsh-p4-tower-input { cursor: grabbing; }
.dsh-p4-tower-tip { position: absolute; z-index: 40; pointer-events: none; opacity: 0; transition: opacity .12s; white-space: nowrap; max-width: 60vw; overflow: hidden; text-overflow: ellipsis;
  background: #ffd400; color: #0a0a0a; font: 800 15px/1 system-ui, sans-serif; padding: 7px 26px 8px 12px; clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%); box-shadow: 0 0 0 2px #0a0a0a; }
.dsh-p4-tower-tip.on { opacity: 1; }
.dsh-p4-warp { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 58; pointer-events: none; display: none; }
/* TUNING IN slogan */
.dsh-p4-slogan { position: absolute; left: -160px; right: -160px; top: 32%; z-index: 59; pointer-events: none; transform: rotate(-9deg); display: none; }
.dsh-p4-slogan.go { display: block; }
.dsh-p4-slogan .band { position: relative; animation: p4r-band 1.25s cubic-bezier(.75,0,.25,1) both; }
@keyframes p4r-band { 0% { transform: translateX(115%) skewX(-18deg); } 20% { transform: translateX(2%) skewX(-18deg); } 30% { transform: translateX(0) skewX(-12deg); } 76% { transform: translateX(-3%) skewX(-12deg); } 100% { transform: translateX(-125%) skewX(-22deg); } }
.dsh-p4-slogan .y { background: #ffd400; height: clamp(90px, 15vh, 150px); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 6px #0a0a0a, 0 14px 0 6px #0a0a0a; }
.dsh-p4-slogan .y b { font: italic 900 clamp(90px, 17vh, 168px)/1 "Barlow Condensed", "Arial Narrow", Impact, sans-serif; color: #0a0a0a; letter-spacing: -3px; transform: skewX(6deg); text-shadow: 7px 7px 0 #fff, 11px 11px 0 #0a0a0a; white-space: nowrap; }
.dsh-p4-slogan .y b span { display: inline-block; }
.dsh-p4-slogan.go .y b span { animation: p4r-pop .38s calc(.16s + var(--i) * .035s) cubic-bezier(.3,1.9,.5,1) both; }
@keyframes p4r-pop { from { transform: translateY(46px) scale(.5) rotate(-10deg); } to { transform: none; } }
.dsh-p4-slogan .k { margin: 22px 0 0 34%; width: 52%; background: #0a0a0a; color: #fff; font: 800 22px/40px "Barlow Condensed", system-ui, sans-serif; letter-spacing: .3em; padding-left: 26px; white-space: nowrap; overflow: hidden; }
.dsh-p4-slogan .k em { font-style: normal; color: #ffd400; }

.dsh-p4-room-hud { position: absolute; right: 18px; bottom: 16px; z-index: 30; pointer-events: auto; display: none; gap: 10px; align-items: center; }
html[data-p4-3d] .dsh-p4-room-hud { display: flex; }
.dsh-p4-room-hud button { font: 800 14px/1 system-ui, sans-serif; letter-spacing: .06em; color: #0a0a0a; background: #ffd400; border: 0; padding: 9px 16px 9px 14px; cursor: pointer;
  clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%); box-shadow: 0 0 0 2px #0a0a0a; }
.dsh-p4-room-hud button:hover { background: #fff36a; }
.dsh-p4-room-hud button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.dsh-p4-room-hud .mode { display: flex; background: #0a0a0a; padding: 3px; gap: 3px; transform: skewX(-10deg); box-shadow: 4px 4px 0 #ff9d00; }
.dsh-p4-room-hud .mode button { clip-path: none; box-shadow: none; background: transparent; color: #ffd400; transform: skewX(10deg); padding: 7px 12px; }
.dsh-p4-room-hud .mode button[aria-pressed="true"] { background: #ffd400; color: #0a0a0a; }
.dsh-p4-room-hud .mode button:hover:not([aria-pressed="true"]) { background: #2a2618; }
.dsh-p4-room-flash { position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at 70% 10%, #e9f0ff, #9fb6ff 60%, #6c82d8); mix-blend-mode: screen; }
`
