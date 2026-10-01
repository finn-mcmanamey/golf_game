'use strict';
//#region KERNEL
/* ===== FW1 kernel: F-157 registry and two-phase boot, F-158 hook channels, F-159 rules table, F-160 modes and fence surfaces, F-161 flags, F-162 save slices. VL.feature(manifest) before VL.boot(); boot validates, sorts (depth, then id), merges tuning, builds and freezes RULES, MODES, FLAGS and the slices, loads the slices, then runs the game's boot steps in their old order. Simulation hooks come from the round's bundle (S.R) or the world's; events run in (at, registry) order; messages drain once a frame. Nothing here moves the ball. ===== */
const BUS_DRAIN_MAX=256,FLAGS_MAX=8,FENCE=['shared','career','none'],SIMH=['round:setup','hole:setup','shot:strike','shot:settle','round:score'],EVI=['round:finished','card:render','title:refresh','career:event','career:season','save:failed','hole:loaded'],EVQ=['round:started','shot:struck','ball:stopped','hole:holed','idle'],RULE_IDS=['R0','R1','R2','R3','R4','R5','R6','R7','R8','R9','R10n','R10i'],
  CAPF={gen1:R=>R.gen>=1,gen2:R=>R.gen>=2,gen3:R=>R.gen>=3,gen4:R=>R.gen>=4,gen7:R=>R.gen>=7,island:R=>R.gen>=CV_ISL,r10:R=>R.v===CV_NOW,golfer:R=>R.v===CV_NOW},FLK=['batch','release','experiment','ops','permission'],FLS=['experimental','default','retired'],
  PENDK={carPending:'car',cupPending:'cup',weeklyPending:'weekly',xgPending:'xg',scenPending:'scen',hsPending:'hs',golferPending:'golfer',forceCv:'forceCv',recvOverride:'recv',fmtNext:'fmt'},LIVEK=['carRound','weekly','cup','hs','scen','range','lab','drill','replay','tourRound'];
const VL=window.VL=window.VL||{},K={F:[],id:{},up:0,on:{},q:[],sfx:[],surf:{},modes:{},frame:{},rb:[],rules:{},caps:{},ev:0,fl:{},sl:{},ro:{},rec:{}},PEND={},LIVE={},NOOP=()=>{},NULLO=new Proxy({},{get:(t,k)=>k==='then'||typeof k==='symbol'?undefined:NOOP});
const RULES=K.rules,MODES=K.modes,RULES_NOW=10;/* RULES_NOW equals CV_NOW; both tables fill and freeze at boot */
const vlLate=w=>{const e='VL: '+w+' after boot';if(devOn())throw Error(e);console.warn(e)};
VL.feature=m=>{if(K.up)return vlLate('feature '+(m&&m.id));K.F.push(m);if(m&&m.id&&!K.id[m.id])K.id[m.id]=m;for(const i in m&&m.flags||{})K.fl[i]=K.fl[i]||Object.assign({id:i,f:m.id},m.flags[i])};
VL.surface=(id,d)=>{if(K.up)return vlLate('surface '+id);K.sfx.push([id,d||{},''])};
VL.has=id=>!!K.id[id];
VL.get=id=>K.id[id]&&K.id[id].api||NULLO;
/* F-161 flags {id,kind,stage,owner,lock,expires}: VL.flag(id) is the only reader. The try switch turns on every experimental flag; a season-locked flag is copied into C.cur.flags[key] when a season is made and never read by it again. No flag changes the simulation (the switch matrix) */
VL.flag=id=>{const f=K.fl[id];if(!f){if(K.up&&devOn())throw Error('VL: no flag '+id);return false}return f.read?!!f.read():f.stage==='experimental'?VL.flag('try'):f.stage==='default'};
VL.flags=()=>Object.values(K.fl);
/* channels: an event or message listener may not call a simulation hook or replace W, B, MM or S.play (dev builds throw) */
function vlCall(l,d,e,dev){if(!dev)return l.fn(d);const g=[W,B,MM,S.play];l.fn(d);if(g[0]!==W||g[1]!==B||g[2]!==MM||g[3]!==S.play)throw Error('VL: '+l.f+' wrote W, B, MM or S.play in '+e)}
VL.emit=(e,d,st)=>{const L=K.on[e];if(!L)return d;const dev=devOn(),m=S.play.mode&&S.play.mode.id;K.ev++;try{for(const l of L)if(l.st===(st|0)&&(!l.m||l.m.includes(m)))vlCall(l,d,e,dev)}finally{K.ev--}return d};
VL.post=(e,d)=>{K.q.push([e,d])};
VL.drain=()=>{const dev=devOn();let n=0;K.ev++;try{while(K.q.length&&n<BUS_DRAIN_MAX){const[e,d]=K.q.shift();n++;for(const l of K.on[e]||[])vlCall(l,d,e,dev)}}finally{K.ev--}if(K.q.length&&dev)throw Error('VL: '+K.q.length+' messages over BUS_DRAIN_MAX')};
VL.on=(e,fn,at)=>{const L=K.on[e]=K.on[e]||[],l={at:at==null?1e9:at,fn,f:'panel',m:null,st:0};L.push(l);L.sort((a,b)=>a.at-b.at);return()=>{const i=L.indexOf(l);if(i>=0)L.splice(i,1)}};
function simRun(n,s,a,b,c){if(K.ev&&devOn())throw Error('VL: '+n+' from a listener');for(const h of S.R.hooks[n])if(h.s===s)h.fn(a,b,c)}
/* a world's own bundle: v10 is R10n/R10i (the range strikes as R10n), older worlds their generation's */
const wRules=w=>w.v10?(w.R&&w.R.v===CV_NOW?w.R:K.rb[10]):w.R||rulesFor(w.cv|0);
/* shot:strike: the swing's golfer (B.G for one swing, or G_TEST) goes to the world's strike hooks, which return the ball's modifiers or null */
function strikeMods(G,c){const R=wRules(W);let m=null;for(const h of R.hooks['shot:strike'])m=h.fn(G,c,m,R);return m}
function playFrame(dt){const M=S.play.mode||K.modes.casual;if(M)for(const f of M.frame)f(dt)}
/* rules: R0-R9 play their generation; R10n/R10i are version 10 on generation 7 or 9 (S.cv keeps the generation, S.v10 the ruleset) */
function rulesFor(cv,v10,kind){const R=K.rb;return v10&&kind!=null?R[kind>=2?11:10]:v10&&cv===CV?R[10]:v10&&cv===CVX?R[11]:R[Math.max(0,Math.min(9,cv|0))]}
function withRules(R,fn){const s=[W,B,MM,EXACT,CALCV,G_TEST],c=CALCV!==R.v;MM=R.math==='VM'?VM:NM;if(c)useCalib(R.v);try{return fn()}finally{W=s[0];B=s[1];MM=s[2];EXACT=s[3];G_TEST=s[5];if(c)useCalib(s[4])}}
/* modes: S.play={mode,cfg}; the old pending slots are the next play's cfg (staged here until startRound opens the play), the live flags live in S.play.st */
function playInit(S){for(const n in PENDK){const k=PENDK[n];Object.defineProperty(S,n,{get:()=>k in PEND?PEND[k]:null,set:v=>{PEND[k]=v},enumerable:true})}for(const n of LIVEK)Object.defineProperty(S,n,{get:()=>S.play.st[n],set:v=>{S.play.st[n]=v},enumerable:true});Object.defineProperty(S,'R',{get:()=>rulesFor(S.cv,S.v10)});S.play={mode:null,cfg:Object.freeze({}),st:LIVE}}
function playOpen(sv){const c=Object.assign({},PEND),id=c.mode||(c.car?'career':c.cup?'cup':(sv?sv.weekly:c.weekly)?'weekly':sv&&sv.hs||c.hs?'hotseat':c.scen?'scenario':S.tourRound!=null?'tour':'casual');delete c.mode;for(const k in PEND)delete PEND[k];return S.play={mode:K.modes[id]||null,cfg:Object.freeze(c),st:LIVE}}
VL.play=(id,c)=>{const M=K.modes[id];if(!M)throw Error('VL.play: no mode '+id);if(K.ev&&devOn())throw Error('VL.play from a listener');if(c.save)for(const k in PEND)delete PEND[k];PEND.mode=id;applyConditions(c);return startRound(c.n,c.ghost||null,c.save||null,c.opp===undefined&&M.oppFor?M.oppFor(c):c.opp)};
/* the fence: a record's class is career for format 9, shared otherwise; a live round's is the class of the record it writes */
const vlClass=x=>x==null||x===S?(S.golfer?'career':'shared'):x.golfer||x.ver===9?'career':'shared';
VL.may=(s,x)=>{const d=K.surf[s];if(!d){if(devOn())throw Error('VL: no surface '+s);return false}return d.accepts.includes(vlClass(x))};
/* F-162 slices and voxellinks.meta={v:1,slices,fixes,seen,lastExport}: a save is {key,v,ok,kept,backup,migrate:{n:fn},fixes:{name:fn},budget} or a part {key,part,init}. A load runs the pure chain from the value's own v (else 0) and writes back once; a newer slice is read-only (VL.ro); a named fix runs once a profile */
const META='voxellinks.meta';let MET=null,MET0=null;
function metaGet(){if(!MET){let m=null;MET0=VS.getItem(META);try{m=JSON.parse(MET0)}catch(e){}if(m&&m.v>1)K.ro[META]='newer';MET=m&&m.v>=1&&m.slices&&Array.isArray(m.fixes)&&Array.isArray(m.seen)?m:{v:1,slices:{},fixes:[],seen:[],lastExport:null}}return MET}
function metaPut(keep){const s=JSON.stringify(metaGet());if(s!==MET0&&!K.ro[META]){VS.setItem(META,s,keep);MET0=s}}
VL.ro=k=>K.ro[k]||null;
function slLoad(k,wr){const D=K.sl[k],raw=VS.getItem(k);if(K.ro[k]==='broken')delete K.ro[k];if(raw==null)return null;let c=null;try{c=JSON.parse(raw)}catch(e){}const v=c&&typeof c==='object'&&c.v!=null?c.v|0:0;
  if(c&&v>D.v){K.ro[k]='newer';return c}if(!c||typeof c!=='object'||D.ok&&!D.ok(c)){if(wr&&D.kept&&VS.getItem(D.kept)!==raw)VS.setItem(D.kept,raw,1);return null}
  /* a migration that throws leaves the stored value as it was and opens the slice read-only ('broken', with a banner and Export); the rest of the profile boots */
  if(v<D.v){const b=D.backup&&D.backup[v];if(wr&&b&&VS.getItem(b)==null)VS.setItem(b,raw,1);try{for(let n=v+1;n<=D.v;n++)c=D.migrate[n](c)}catch(e){K.ro[k]='broken';(K.roWhy=K.roWhy||{})[k]=String(e&&e.message||e).slice(0,120);return null}c.v=D.v}for(const p of D.parts)if(c[p.part]==null)c[p.part]=p.init();
  if(wr&&v<D.v&&!K.ro[k])VS.setItem(k,JSON.stringify(c),1);return c}
function slBoot(){const me=metaGet();for(const k in K.sl){const D=K.sl[k],c=slLoad(k,!K.ro[k]);if(K.ro[k]!=='broken')me.slices[k]=K.ro[k]==='newer'?c.v:D.v;
    for(const n in D.fixes||{})if(!me.fixes.includes(n)&&!K.ro[k]){const x=slLoad(k,1);if(x)VS.setItem(k,JSON.stringify(D.fixes[n](x)||x),1);me.fixes.push(n)}}}
VL.boot=B=>{if(K.up)throw Error('VL.boot twice');K.up=1;const F=K.F,E=[],id={},st={},seen={},ss={},ms={},fs={};
  for(const m of F){if(!m||!m.id){E.push('a feature without an id');continue}if(id[m.id])E.push('duplicate id '+m.id);id[m.id]=m;if(!['sim','view','shell'].includes(m.kind))E.push(m.id+': no kind')}
  for(const m of F)for(const x of m.deps||[])if(!id[x])E.push(m.id+': missing dependency '+x);
  const dep=m=>{if(st[m.id]===2)return m.depth;if(st[m.id]===1){E.push('dependency cycle at '+m.id);return 0}st[m.id]=1;let d=0;for(const x of m.deps||[])if(id[x])d=Math.max(d,dep(id[x])+1);st[m.id]=2;return m.depth=d};
  for(const m of F)if(m&&m.id)dep(m);
  for(const m of F)for(const n in m.tuning||{})if(!(n in TUNE)&&m.tuning[n].panel!==false){const t=m.tuning[n];tuneDef((m.f||[m.id])[0],n,t.v,t.sim?'phys':'ui',t.note||'',t.lo,t.hi,t.step)}
  for(const t of TUNE_META){const m=F.find(m=>m&&(m.f||[]).includes(t.f));if(!m){E.push('tuning '+t.n+' ('+t.f+') has no feature');continue}(m.tuning=m.tuning||{})[t.n]={v:t.d,sim:t.kind!=='ui',lo:t.lo,hi:t.hi,step:t.step,note:t.note}}
  for(const m of F){if(!m||!m.id)continue;const r=m.rules||{};if(m.kind!=='sim'&&Object.values(m.tuning||{}).some(t=>t.sim))E.push(m.id+': a sim tuning key in a '+m.kind+' feature');if(m.kind==='view'&&(r.hooks||[]).length)E.push(m.id+': a view feature declares a simulation hook');
    if(r.from&&!RULE_IDS.includes(r.from))E.push(m.id+': no bundle '+r.from);for(const h of r.hooks||[])if(!SIMH.includes(h[0]))E.push(m.id+': no simulation hook '+h[0]);
    for(const c in r.caps||{}){if(!CAPF[r.caps[c][0]])E.push(m.id+': no cap family '+r.caps[c][0]);if(seen[c])E.push('cap '+c+' twice');seen[c]=1}
    for(const o of m.on||[])if(!EVI.includes(o[0])&&!EVQ.includes(o[0]))E.push(m.id+': no event '+o[0]);Object.assign(K.frame,m.view&&m.view.frame);for(const s in m.surfaces||{})K.sfx.push([s,m.surfaces[s],m.id]);
    for(const i in m.flags||{}){const x=m.flags[i];if(fs[i])E.push('flag '+i+' twice');fs[i]=1;if(!FLK.includes(x.kind))E.push('flag '+i+' has no kind');if(!x.read&&!FLS.includes(x.stage))E.push('flag '+i+' has no stage');if(x.lock==='season'&&!x.key)E.push('flag '+i+': a season lock without a key')}
    for(const n in m.record||{}){if(K.rec[n])E.push('record format '+n+' twice');K.rec[n]=Object.freeze(Object.assign({f:m.id},m.record[n]))}
    for(const d of[].concat(m.save||[]))if(!d.part){if(K.sl[d.key])E.push('slice '+d.key+' twice');K.sl[d.key]=Object.assign({},d,{f:m.id,parts:[]});for(let n=1;n<=d.v;n++)if(n>(d.from|0)&&typeof(d.migrate||{})[n]!=='function')E.push('slice '+d.key+': no migration to v'+n)}}
  for(const m of F)for(const d of[].concat(m&&m.save||[]))if(d.part){if(!K.sl[d.key])E.push(m.id+': a part of no slice '+d.key);else K.sl[d.key].parts.push(Object.freeze(Object.assign({f:m.id},d)))}
  for(const[s,d]of K.sfx){const a=d.accepts;if(ss[s])E.push('surface '+s+' twice');ss[s]=1;if(!Array.isArray(a)||!a.length||a.some(x=>!FENCE.includes(x)))E.push('surface '+s+' has no fence class');else if(a.includes('career')&&!d.watch)E.push('surface '+s+' takes career rounds and is not watch-only')}
  for(const m of F)for(const i in m&&m.modes||{}){const d=m.modes[i];if(ms[i])E.push('mode '+i+' twice');ms[i]=1;if(!FENCE.includes(d.fence))E.push('mode '+i+' has no fence class');for(const n of d.frame||[])if(!K.frame[n])E.push('mode '+i+': no frame hook '+n);if(d.resume!=null&&typeof d.resume!=='function'&&typeof d.resume!=='string'||d.valid!=null&&typeof d.valid!=='function')E.push('mode '+i+': resume or valid is not a function')}
  for(const m of F)for(const i in m&&m.modes||{}){const r=m.modes[i].resume;if(typeof r==='string'&&!ms[r])E.push('mode '+i+' resumes as '+r+', which is no mode')}
  if(E.length)throw Error('VL.boot: '+E.join('; '));
  F.sort((a,b)=>a.depth-b.depth||(a.id<b.id?-1:a.id>b.id?1:0));B.calibrate();
  const RB=K.rb;RULE_IDS.forEach((r,i)=>{const gen=i<10?i:i>10?CVX:CV,v=i<10?i:CV_NOW;RB.push({id:r,v,gen,math:gen>=5?'VM':'NM',calib:v>=9?3:v>=5?2:v>=4?1:0,caps:{},tune:{},hooks:Object.fromEntries(SIMH.map(n=>[n,[]]))})});
  for(const m of F){const r=m.rules;if(!r)continue;const f0=RULE_IDS.indexOf(r.from||'R0');RB.forEach((R,i)=>{for(const c in r.caps||{}){K.caps[c]=Object.freeze([r.caps[c][0],r.caps[c][1]||null,m.id,r.from||'R0']);R.caps[c]=i>=f0&&CAPF[r.caps[c][0]](R)}if(i<f0)return;for(const[n,at,fn]of r.hooks||[])R.hooks[n].push(Object.freeze({at,s:Math.floor(at),fn,f:m.id}));for(const k in m.tuning||{})if(m.tuning[k].sim)R.tune[k]=k in TUNE?TUNE[k]:m.tuning[k].v})}
  for(const R of RB){for(const n in R.hooks)Object.freeze(R.hooks[n].sort((a,b)=>a.at-b.at));Object.freeze(R.caps);Object.freeze(R.tune);Object.freeze(R.hooks);K.rules[R.id]=Object.freeze(R)}Object.freeze(RB);Object.freeze(K.rules);Object.freeze(K.caps);
  for(const m of F)for(const i in m.modes||{}){const d=m.modes[i];K.modes[i]=Object.freeze(Object.assign({},d,{id:i,f:m.id,frame:Object.freeze((d.frame||[]).map(n=>K.frame[n]))}))}Object.freeze(K.modes);
  for(const[s,d,f]of K.sfx)K.surf[s]=Object.freeze({id:s,f,accepts:Object.freeze(d.accepts.slice()),watch:!!d.watch});Object.freeze(K.surf);
  for(const m of F)for(const[e,at,fn,md,s]of m.on||[])(K.on[e]=K.on[e]||[]).push(Object.freeze({at,fn,f:m.id,m:md||null,st:s|0}));for(const e in K.on)K.on[e].sort((a,b)=>a.at-b.at);
  for(const i in K.fl)Object.freeze(K.fl[i]);for(const k in K.sl)Object.freeze(K.sl[k]);Object.freeze(K.fl);Object.freeze(K.sl);Object.freeze(K.rec);for(const m of F)Object.freeze(m);Object.freeze(F);
  /* the tab lock, the slices, the game's load, load hooks (read-only), init once a profile (meta.seen), the UI */
  B.lock();slBoot();B.load();for(const m of F)if(m.load)m.load();const me=metaGet();for(const m of F)if(!me.seen.includes(m.id)){if(m.init)m.init(me);me.seen.push(m.id)}metaPut(1);for(const m of F)if(m.view&&m.view.mount)m.view.mount();B.title();B.after()};
VL.dump=()=>{if(!devOn())return null;const me=metaGet(),o={features:K.F.map(m=>m.id+' '+m.kind+' d'+m.depth+(m.deps&&m.deps.length?' < '+m.deps.join(','):'')),hooks:{},events:{},modes:Object.keys(K.modes).map(i=>i+' '+K.modes[i].fence),surfaces:Object.keys(K.surf).map(s=>s+' '+K.surf[s].accepts.join('/')),caps:{},
    flags:VL.flags().map(f=>f.id+' '+(VL.flag(f.id)?'on':'off')+' '+f.kind+(f.stage?' '+f.stage:'')+(f.lock==='season'?' season:'+f.key:'')),slices:Object.keys(K.sl).map(k=>k+' v'+K.sl[k].v+' stored v'+me.slices[k]+(K.ro[k]?' '+K.ro[k]:'')),meta:{fixes:me.fixes,seen:me.seen.length,lastExport:me.lastExport}};
  for(const n of SIMH){const h=new Map;for(const R of K.rb)for(const x of R.hooks[n]){const k=x.at+' '+x.f;h.set(k,(h.get(k)||[]).concat(R.id))}o.hooks[n]=[...h].map(([k,b])=>k+' '+(b.length===12?'all':b.join(',')))}
  for(const e in K.on)o.events[e]=K.on[e].map(l=>l.at+' '+l.f+(l.m?' '+l.m:'')+(l.st?' @'+l.st:''));for(const c in K.caps)o.caps[c]=K.caps[c][0]+' '+K.rb.map(R=>R.caps[c]?1:0).join('');console.log('VL.dump '+JSON.stringify(o,null,1));return o};
//#endregion KERNEL
/* ===== B-2 the game's own maths: course version 5 generates, simulates, drops and plays its bots on sin, cos, tan, atan, atan2, asin, exp, log, pow and hypot written from +, −, ×, ÷ and square root only (fdlibm's algorithms), so every browser computes the same bits; versions 0–4 keep the engine's functions and stay byte-identical ===== */
const VM=(()=>{const DV=new DataView(new ArrayBuffer(8)),HI=x=>{DV.setFloat64(0,x);return DV.getInt32(0)},LO=x=>{DV.setFloat64(0,x);return DV.getUint32(4)},W2=(h,l)=>{DV.setInt32(0,h|0);DV.setUint32(4,l>>>0);return DV.getFloat64(0)},setHI=(x,h)=>{DV.setFloat64(0,x);DV.setInt32(0,h|0);return DV.getFloat64(0)};
  const S1=-1.66666666666666324348e-01,S2=8.33333333332248946124e-03,S3=-1.98412698298579493134e-04,S4=2.75573137070700676789e-06,S5=-2.50507602534068634195e-08,S6=1.58969099521155010221e-10;
  const C1=4.16666666666666019037e-02,C2=-1.38888888888741095749e-03,C3=2.48015872894767294178e-05,C4=-2.75573143513906633035e-07,C5=2.08757232129817482790e-09,C6=-1.13596475577881948265e-11;
  const ksin=(x,y,iy)=>{const z=x*x,v=z*x,r=S2+z*(S3+z*(S4+z*(S5+z*S6)));return iy===0?x+v*(S1+z*r):x-((z*(.5*y-v*r)-y)-v*S1)};
  const kcos=(x,y)=>{const ix=HI(x)&0x7fffffff;if(ix<0x3e400000&&Math.trunc(x)===0)return 1;const z=x*x,r=z*(C1+z*(C2+z*(C3+z*(C4+z*(C5+z*C6)))));if(ix<0x3FD33333)return 1-(.5*z-(z*r-x*y));const qx=ix>0x3fe90000?.28125:W2(ix-0x00200000,0),hz=.5*z-qx,a=1-qx;return a-(hz-(z*r-x*y))};
  const IP2=6.36619772367581382433e-01,P21=1.57079632673412561417e+00,P21T=6.07710050650619224932e-11,P22=6.07710050630396597660e-11,P22T=2.02226624879595063154e-21,P23=2.02226624871116645580e-21,P23T=8.47842766036889956997e-32,Y=[0,0];
  /* argument reduction by π/2 (fdlibm's medium case, three-part π/2, exact to |x| < 2^19·π/2); beyond that a double-length 2π reduction, deterministic if less precise */
  function rem(x){const hx=HI(x),ix=hx&0x7fffffff;let t=Math.abs(x);if(ix>0x413921fb){const P2A=6.283185307179586,P2B=2.4492935982947064e-16,k=Math.floor(t/P2A);t=(t-k*P2A)-k*P2B;if(t<0)t+=P2A;x=hx<0?-t:t;return rem(x)}
    const n=Math.floor(t*IP2+.5),fn=n;let r=t-fn*P21,w=fn*P21T,y0=r-w;const j=ix>>20;let i=j-((HI(y0)>>20)&0x7ff);
    if(i>16){let tt=r;w=fn*P22;r=tt-w;w=fn*P22T-((tt-r)-w);y0=r-w;i=j-((HI(y0)>>20)&0x7ff);if(i>49){tt=r;w=fn*P23;r=tt-w;w=fn*P23T-((tt-r)-w);y0=r-w}}
    const y1=(r-y0)-w;if(hx<0){Y[0]=-y0;Y[1]=-y1;return-n}Y[0]=y0;Y[1]=y1;return n}
  function sin(x){const ix=HI(x)&0x7fffffff;if(ix<=0x3fe921fb)return ksin(x,0,0);if(ix>=0x7ff00000)return NaN;const n=rem(x)&3;return n===0?ksin(Y[0],Y[1],1):n===1?kcos(Y[0],Y[1]):n===2?-ksin(Y[0],Y[1],1):-kcos(Y[0],Y[1])}
  function cos(x){const ix=HI(x)&0x7fffffff;if(ix<=0x3fe921fb)return kcos(x,0);if(ix>=0x7ff00000)return NaN;const n=rem(x)&3;return n===0?kcos(Y[0],Y[1]):n===1?-ksin(Y[0],Y[1],1):n===2?-kcos(Y[0],Y[1]):ksin(Y[0],Y[1],1)}
  const AH=[4.63647609000806093515e-01,7.85398163397448278999e-01,9.82793723247329054082e-01,1.57079632679489655800e+00],AL=[2.26987774529616870924e-17,3.06161699786838301793e-17,1.39033110312309984516e-17,6.12323399573676603587e-17],
    AT=[3.33333333333329318027e-01,-1.99999999998764832476e-01,1.42857142725034663711e-01,-1.11111104054623557880e-01,9.09088713343650656196e-02,-7.69187620504482999495e-02,6.66107313738753120669e-02,-5.83357013379057348645e-02,4.97687799461593236017e-02,-3.65315727442169155270e-02,1.62858201153657823623e-02];
  function atan(x){const hx=HI(x),ix=hx&0x7fffffff;let id;if(ix>=0x44100000){if(x!==x)return x;return hx>0?AH[3]+AL[3]:-AH[3]-AL[3]}
    if(ix<0x3fdc0000){if(ix<0x3e200000)return x;id=-1}else{x=Math.abs(x);if(ix<0x3ff30000){if(ix<0x3fe60000){id=0;x=(2*x-1)/(2+x)}else{id=1;x=(x-1)/(x+1)}}else if(ix<0x40038000){id=2;x=(x-1.5)/(1+1.5*x)}else{id=3;x=-1/x}}
    const z=x*x,w=z*z,s1=z*(AT[0]+w*(AT[2]+w*(AT[4]+w*(AT[6]+w*(AT[8]+w*AT[10]))))),s2=w*(AT[1]+w*(AT[3]+w*(AT[5]+w*(AT[7]+w*AT[9]))));
    if(id<0)return x-x*(s1+s2);const r=AH[id]-((x*(s1+s2)-AL[id])-x);return hx<0?-r:r}
  const PI=3.1415926535897931160e+00,PI_LO=1.2246467991473531772e-16,PI2=1.5707963267948965580e+00;
  function atan2(y,x){if(x!==x||y!==y)return NaN;if(x===1)return atan(y);const hx=HI(x),hy=HI(y),ix=hx&0x7fffffff,iy=hy&0x7fffffff,m=((hy>>>31)&1)|((hx>>>30)&2);
    if(y===0){return m===0||m===1?y:m===2?PI:-PI}if(x===0)return hy<0?-PI2:PI2;
    if(ix===0x7ff00000&&LO(x)===0){if(iy===0x7ff00000&&LO(y)===0){return m===0?PI/4:m===1?-PI/4:m===2?3*PI/4:-3*PI/4}return m===0?0:m===1?-0:m===2?PI:-PI}
    if(iy===0x7ff00000&&LO(y)===0)return hy<0?-PI2:PI2;
    const k=(iy-ix)>>20;let z;if(k>60)z=PI2+.5*PI_LO;else if(hx<0&&k<-60)z=0;else z=atan(Math.abs(y/x));
    return m===0?z:m===1?-z:m===2?PI-(z-PI_LO):(z-PI_LO)-PI}
  const tan=x=>sin(x)/cos(x),asin=x=>x>1||x<-1?NaN:atan2(x,Math.sqrt((1-x)*(1+x)));
  const LN2HI=[6.93147180369123816490e-01,-6.93147180369123816490e-01],LN2LO=[1.90821492927058770002e-10,-1.90821492927058770002e-10],INVLN2=1.44269504088896338700e+00,
    EP1=1.66666666666666019037e-01,EP2=-2.77777777770155933842e-03,EP3=6.61375632143793436117e-05,EP4=-1.65339022054652515390e-06,EP5=4.13813679705723846039e-08,TWOM1000=9.33263618503218878990e-302;
  function exp(x){let hx=HI(x);const xsb=(hx>>>31)&1;hx&=0x7fffffff;let hi=0,lo=0,k=0;
    if(hx>=0x40862E42){if(hx>=0x7ff00000){if(x!==x)return x;return xsb===0?x:0}if(x>7.09782712893383973096e+02)return Infinity;if(x< -7.45133219101941108420e+02)return 0}
    if(hx>0x3fd62e42){if(hx<0x3FF0A2B2){hi=x-LN2HI[xsb];lo=LN2LO[xsb];k=1-xsb-xsb}else{k=Math.trunc(INVLN2*x+(xsb?-.5:.5));hi=x-k*LN2HI[0];lo=k*LN2LO[0]}x=hi-lo}
    else if(hx<0x3e300000)return 1+x;
    const t=x*x,c=x-t*(EP1+t*(EP2+t*(EP3+t*(EP4+t*EP5))));if(k===0)return 1-((x*c)/(c-2)-x);const y=1-((lo-(x*c)/(2-c))-hi);
    return k>=-1021?setHI(y,HI(y)+(k<<20)):setHI(y,HI(y)+((k+1000)<<20))*TWOM1000}
  const LG1=6.666666666666735130e-01,LG2=3.999999999940941908e-01,LG3=2.857142874366239149e-01,LG4=2.222219843214978396e-01,LG5=1.818357216161805012e-01,LG6=1.531383769920937332e-01,LG7=1.479819860511658591e-01,L2H=6.93147180369123816490e-01,L2L=1.90821492927058770002e-10,TWO54=1.80143985094819840000e+16;
  function log(x){let hx=HI(x),k=0;const lx=LO(x);if(hx<0x00100000){if(((hx&0x7fffffff)|lx)===0)return-Infinity;if(hx<0)return NaN;k-=54;x*=TWO54;hx=HI(x)}if(hx>=0x7ff00000)return x+x;
    k+=(hx>>20)-1023;hx&=0x000fffff;const i0=(hx+0x95f64)&0x100000;x=setHI(x,hx|(i0^0x3ff00000));k+=(i0>>20);const f=x-1;
    if((0x000fffff&(2+hx))<3){if(f===0){if(k===0)return 0;return k*L2H+k*L2L}const R=f*f*(.5-.33333333333333333*f);return k===0?f-R:k*L2H-((R-k*L2L)-f)}
    const s=f/(2+f),dk=k,z=s*s;let i=hx-0x6147a;const w=z*z,j=0x6b851-hx,t1=w*(LG2+w*(LG4+w*LG6)),t2=z*(LG1+w*(LG3+w*(LG5+w*LG7)));i|=j;const R=t2+t1;
    if(i>0){const hfsq=.5*f*f;return k===0?f-(hfsq-s*(hfsq+R)):dk*L2H-((hfsq-(s*(hfsq+R)+dk*L2L))-f)}return k===0?f-s*(f-R):dk*L2H-((s*(f-R)-dk*L2L)-f)}
  function pow(x,y){if(y===0)return 1;if(x!==x||y!==y)return NaN;if(x===1)return 1;if(y===1)return x;if(y===2)return x*x;if(y===.5&&x>=0)return Math.sqrt(x);
    const yi=Math.trunc(y)===y&&Math.abs(y)<=64;if(yi){let b=y<0?1/x:x,n=Math.abs(y),r=1;while(n){if(n&1)r*=b;b*=b;n=n>>>1}return r}
    if(x===0)return y>0?0:Infinity;if(x<0)return NaN;return exp(y*log(x))}
  const hyp=(a,b,c)=>c===undefined?Math.sqrt(a*a+b*b):Math.sqrt(a*a+b*b+c*c);
  return Object.freeze({sin,cos,tan,atan,atan2,asin,exp,log,pow,hyp})})();
const NM=Object.freeze({sin:Math.sin,cos:Math.cos,tan:Math.tan,atan:Math.atan,atan2:Math.atan2,asin:Math.asin,exp:Math.exp,log:Math.log,pow:Math.pow,hyp:Math.hypot});
let MM=NM;const mathFor=cv=>cv>=5?VM:NM;
const withMath=(cv,fn)=>{const m0=MM;MM=mathFor(cv);try{return fn()}finally{MM=m0}};
VL.feature({id:'b2.maths',kind:'sim',deps:[],f:['B-2']});
