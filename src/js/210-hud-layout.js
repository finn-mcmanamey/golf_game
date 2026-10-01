/* ===== B-4 the HUD lays itself out: one scale for every panel (--u), zones that never meet, the hole card fitted between them, the ticker trimmed before it touches the shot card, and the view centred above the bar ===== */
const HUD_MIN=.8,HUD_MAX=1.5,HUD_MSG_W=.7,HUD_MSG_PX=900,HUD_TOOLS_ROW=700,HUD_GAP=8,HUD_EDGE=12,HUD_MSG_K=[1,.9,.8],HUDL={u:1,q:0,sy:0,syT:0,on:false};
const hudU=()=>clamp(Math.min(innerWidth/1280,innerHeight/720),HUD_MIN,HUD_MAX);
function hudSchedule(){if(HUDL.on&&!HUDL.q)HUDL.q=requestAnimationFrame(()=>{HUDL.q=0;hudLayout()})}
function hudInit(){if(typeof document==='undefined'||!document.body||typeof ResizeObserver!=='function')return;HUDL.on=true;const ids=['top','wind','tools','right','score','map','ticker','bottom','relief','lower','shotcard','hint','msg'],ro=new ResizeObserver(hudSchedule),mo=new MutationObserver(hudSchedule);
  for(const id of ids){const el=document.getElementById(id);if(el){ro.observe(el);mo.observe(el,{attributes:true,attributeFilter:['class']})}}addEventListener('resize',hudSchedule);hudLayout()}
function hudLayout(){if(!HUDL.on)return;const $=id=>document.getElementById(id),u=hudU(),g=HUD_GAP*u,e=HUD_EDGE*u,Wd=innerWidth,Ht=innerHeight,R=el=>el.getBoundingClientRect(),shown=el=>!!el&&el.getClientRects().length>0&&!el.classList.contains('hide'),live=el=>shown(el)&&!el.classList.contains('off'),xo=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1;
  HUDL.u=u;document.documentElement.style.setProperty('--u',u);
  /* the bottom stack: the bar (or the relief panel), the hint above it, then the lower third (left) and the shot card (right) above whatever they would meet */
  const bar=[$('bottom'),$('relief')].find(shown);for(const id of['bottom','relief'])$(id).style.bottom=2*g+'px';const bT=bar?R(bar).top:Ht,hint=$('hint');hint.style.bottom=Ht-bT+g+'px';const hR=R(hint);
  for(const[id,side]of[['lower','left'],['shotcard','right']]){const el=$(id);el.style[side]=e+'px';let y=bT-g;const r=R(el);if(bar&&!xo(r,R(bar)))y=Ht-e;if(xo(r,hR))y=Math.min(y,hR.top-g);el.style.bottom=Ht-y+'px'}
  const low=$('lower'),sc=$('shotcard'),floorFor=r=>{let y=Ht-e;for(const el of[bar,live(low)?low:null,live(sc)?sc:null])if(el){const q=R(el);if(xo(r,q))y=Math.min(y,q.top-g)}return y};
  /* the top-left column: hole, wind, tools (a row when the window is short or the column would reach the lower third) */
  const top=$('top'),wind=$('wind'),tools=$('tools');top.style.left=wind.style.left=tools.style.left=e+'px';top.style.top=e+'px';wind.style.top=R(top).bottom+g+'px';tools.style.top=R(wind).bottom+g+'px';
  tools.classList.toggle('row',Ht<HUD_TOOLS_ROW);if(shown(tools)&&!tools.classList.contains('row')&&R(tools).bottom>floorFor(R(tools)))tools.classList.add('row');
  /* the top-right column: score, map, ticker; the ticker drops rows (never yours, never the leader) before it meets what is below */
  const right=$('right'),tk=$('ticker');right.style.top=right.style.right=e+'px';const rows=[...tk.querySelectorAll('.r')];for(const r of rows)r.classList.remove('cut');
  if(live(tk)){const cut=rows.slice(1).filter(r=>!r.classList.contains('me')).reverse();for(const r of cut){const q=R(tk);if(q.bottom<=floorFor(q))break;r.classList.add('cut')}}
  /* the hole card: as wide as HUD_MSG_W allows, its font down to 0.8 before it may meet a panel, centred at a third of the height where there is room */
  const m=$('msg'),ups=[top,wind,shown(tools)?tools:null,$('score'),$('map'),live(tk)?tk:null].filter(Boolean).map(R),downs=[bar,live(low)?low:null,live(sc)?sc:null,hint.classList.contains('on')?hint:null].filter(Boolean).map(R);
  const fit=w=>{for(const k of HUD_MSG_K){m.style.fontSize=36*k+'px';m.style.maxWidth=w/u+'px';const r=R(m);let c=e,f=Ht-e;for(const q of ups)if(xo(r,q))c=Math.max(c,q.bottom+g);for(const q of downs)if(xo(r,q))f=Math.min(f,q.top-g);if(f-c>=r.height)return{c,f,h:r.height}}return null};
  const L=Math.max(...[top,wind,shown(tools)?tools:null].filter(Boolean).map(el=>R(el).right)),Rr=R(right).left,gapW=Rr-L-2*g;
  let p=fit(Math.min(HUD_MSG_W*Wd,HUD_MSG_PX*u))||(gapW>200*u?fit(gapW):null);if(!p){m.style.fontSize=36*HUD_MSG_K[HUD_MSG_K.length-1]+'px';const r=R(m);p={c:e,f:Ht-e,h:r.height}}
  m.style.top=clamp(.34*Ht-p.h/2,p.c,Math.max(p.c,p.f-p.h))+'px';
  /* the view: centred in what the bar leaves (drawing only) */
  HUDL.syT=bar?-(Ht-bT)/Ht:0}
/* the projection's lens shift, eased once a frame so the view never jumps; the reflection pass uses the same value */
function hudEase(dt){HUDL.sy+=(HUDL.syT-HUDL.sy)*Math.min(1,dt*9);if(Math.abs(HUDL.syT-HUDL.sy)<1e-4)HUDL.sy=HUDL.syT}
const hudLens=P=>{P[9]=HUDL.sy;return P};
VL.feature({id:'b4.hud',kind:'view',deps:['core.view'],f:['B-4']});
