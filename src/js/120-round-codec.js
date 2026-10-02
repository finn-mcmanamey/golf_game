/* ================= round codec ================= */
class BW{constructor(){this.b=[];this.n=0}w(v,bits){for(let i=bits-1;i>=0;i--){const k=this.n>>3;if(k>=this.b.length)this.b.push(0);if(Math.floor(v/MM.pow(2,i))%2)this.b[k]|=128>>(this.n&7);this.n++}}
  str(){let s='';for(const x of this.b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}}
class BR{constructor(str){const s=atob(str.replace(/-/g,'+').replace(/_/g,'/'));this.b=[];for(let i=0;i<s.length;i++)this.b.push(s.charCodeAt(i));this.n=0}
  r(bits){let v=0;for(let i=0;i<bits;i++){const k=this.n>>3;if(k>=this.b.length)throw new Error('short');v=v*2+((this.b[k]>>(7-(this.n&7)))&1);this.n++}return v}}
const HOLESC=[3,9,18],qYaw=y=>Math.round((((y%TAU)+TAU)%TAU)/TAU*65536)%65536,uYaw=q=>q/65536*TAU,qPow=p=>Math.round(clamp(p,0,1)*255),uPow=q=>q/255,qAcc=a=>Math.round((clamp(a,-1.6,1.6)+1.6)/3.2*255),uAcc=q=>q/255*3.2-1.6,qPos=x=>clamp(Math.round((x+1600)*20),0,65535),uPos=q=>q/20-1600;
function encodeRound(seed,n,log,hcp,cv=0,hdr){if(cv>=4)return encodeRound6(seed,n,log,hcp,cv,hdr);const w=new BW(),big=log.some(L=>(L||[]).some(s=>s.s>2)),ver=cv>=3?5:big?4:cv?3:2;w.w(ver,4);w.w(seed,30);w.w(HOLESC.indexOf(n),2);w.w(hcp==null?31:clamp(hcp,0,27),5);if(ver>=3)w.w(cv,3);
  if(ver>=5){const H=hdr||{};w.w(bagMask(H.bag||S.bag),22);w.w(H.ball!=null?H.ball:S.ball,1);w.w(H.setup!=null?H.setup:S.setup,2)}
  for(let h=0;h<n;h++){const L=log[h]||[];w.w(Math.min(L.length,31),5);for(const s of L.slice(0,31)){if(ver>=5)w.w(s.c,5);else w.w(Math.max(0,OLD8.indexOf(s.c)),3);w.w(s.s,ver>=4?3:2);w.w(s.t,2);w.w(s.y,16);w.w(s.p,8);w.w(s.a,8);w.w(s.r,2);w.w(s.x,16);w.w(s.z,16);if(ver>=5){w.w(s.k||0,11);w.w(s.g?1:0,1)}}}return 'V'+w.str()}
function decodeRound(str){try{str=(str||'').trim().replace(/^.*#/,'').split('.')[0];if(str[0]!=='V')return null;const r=new BR(str.slice(1)),ver=r.r(4);if(ver===8||ver===9)return decodeRound8(r,ver===9);if(ver<1||ver>7)return null;const seed=r.r(30),n=HOLESC[r.r(2)];if(!n||seed<1)return null;let hcp=null,cv=0,bag=OLD8.slice(),ball=0,setup=0;if(ver>=2){const v=r.r(5);hcp=v===31?null:v}if(ver>=3)cv=r.r(3);if(cv>CV)return null;if(ver>=6)return cv>=4?decodeRound6(r,seed,n,hcp,cv,ver):null;if(cv>=4)return null;
    if(ver>=5){bag=maskBag(r.r(22));ball=r.r(1);setup=r.r(2)}const log=[],sb=ver>=4?3:2,smax=ver>=4?4:2;
    for(let h=0;h<n;h++){const c=r.r(5),L=[];for(let k=0;k<c;k++){const s={c:ver>=5?r.r(5):OLD8[r.r(3)],s:r.r(sb),t:r.r(2),y:r.r(16),p:r.r(8),a:r.r(8),r:r.r(2),x:r.r(16),z:r.r(16)};if(ver>=5){s.k=r.r(11);s.g=!!r.r(1)}if(s.c==null||s.c>=CLUB_SET.length||s.s>smax||s.t>2)return null;L.push(s)}log.push(L)}return{seed,n,hcp,cv,bag,ball,setup,log}}catch(e){return null}}
function encodeChallenge(seed,n,hole,stroke,sx,sz,ex,ez,holed,cv=0,hdr){const w=new BW(),ver=cv>=4?4:cv>=3?3:cv?2:1;w.w(ver,4);w.w(seed,30);w.w(HOLESC.indexOf(n),2);if(cv)w.w(cv,3);if(ver>=3){const H=hdr||{};w.w(bagMask(H.bag||S.bag),22);w.w(H.ball!=null?H.ball:S.ball,1);w.w(H.setup!=null?H.setup:S.setup,2)}if(ver>=4){const H=hdrOf(hdr);w.w(H.season,2);w.w(H.wear,2);w.w(H.kind,1);w.w(hdr&&hdr.plug?1:0,1);w.w(hdr&&hdr.lf||0,2)}w.w(hole,5);w.w(Math.min(stroke,31),5);w.w(qPos(sx),16);w.w(qPos(sz),16);w.w(qPos(ex),16);w.w(qPos(ez),16);w.w(holed?1:0,1);if(ver>=3)w.w((hdr&&hdr.g)?1:0,1);return 'C'+w.str()}
function decodeChallenge(str){try{str=(str||'').trim().replace(/^.*#/,'');if(str[0]!=='C')return null;const r=new BR(str.slice(1)),ver=r.r(4);if(ver<1||ver>4)return null;const seed=r.r(30),n=HOLESC[r.r(2)],cv=ver>=2?r.r(3):0;let bag=OLD8.slice(),ball=0,setup=0,x4={};if(ver>=3){bag=maskBag(r.r(22));ball=r.r(1);setup=r.r(2)}if(ver>=4)x4={season:r.r(2),wear:r.r(2),kind:r.r(1),plug:!!r.r(1),lf:r.r(2)};const hole=r.r(5),stroke=r.r(5);if(!n||seed<1||hole>=n||stroke<1||cv>CV||(ver>=4)!==(cv>=4))return null;
    const o=Object.assign({seed,n,cv,bag,ball,setup,hole,stroke,sx:uPos(r.r(16)),sz:uPos(r.r(16)),ex:uPos(r.r(16)),ez:uPos(r.r(16)),holed:!!r.r(1)},x4);if(ver>=3)o.g=!!r.r(1);return o}catch(e){return null}}
const holeStrokes=(L,par,cv)=>{if(L.length&&L[0].kind!=null)return holeTally(L,0,cv).n;let s=0;for(const e of L)s+=1+(e.r===2||e.r===3?1:0);return s},holeDone=(L,par,cv)=>{const cap=capFor(par,cv==null?S.cv:cv);if(L.length&&L[0].kind!=null){const T=holeTally(L,0,cv);return T.holed||T.n>=cap}return L.length>0&&(L[L.length-1].r===1||holeStrokes(L,par)>=cap)};
function roundTotal(log,pars,cv){let s=0,p=0,done=0;for(let h=0;h<pars.length;h++){const L=log[h]||[];if(holeDone(L,pars[h],cv)){s+=holeStrokes(L,pars[h],cv);p+=pars[h];done++}}return{s,p,done}}
/* ===== record v6 (course version 4, F-007): header gains season, wear, casual, meter speed, course kind, seat, look and an edits flag; four entry kinds ===== */
const qMis=m=>Math.round(clamp(m,-1,1)*7),uMis=q=>q/7;
const hdrOf=H=>{H=H||{};const g=(k,d)=>H[k]!=null?H[k]:S[k]!=null?S[k]:d;return{bag:H.bag||S.bag,ball:g('ball',0),setup:g('setup',0),season:g('season',0),wear:g('wear',0),casual:g('casual',0)?1:0,meter:g('meter',0),kind:g('kind',0),seat:g('seat',0),look:g('look',0),ghosts:H.ghosts!=null?H.ghosts:gkPack(S.gk),format:g('format',0),twist:(g('twist',0)&3)|((((H.look!=null?H.look:S.look)>>>30)&1)<<2),hand:g('hand',0)?1:0,v10:g('v10',0)?1:0,islDay:g('islDay',0),real:g('real',0),golfer:'golfer' in H?H.golfer:(S.golfer||null)}};
function encodeRound6(seed,n,log,hcp,cv,hdr){const H=hdrOf(hdr),w=new BW(),P=(x,z)=>{w.w(x,16);w.w(z,16)};const V10=(!!H.v10||!!H.real)&&cv>=7;if(cv>=CV_ISL||V10)islHdr8(w,seed,n,hcp,V10?CV_NOW:cv,H);else{w.w(cv>=7?7:6,4);w.w(seed,30);w.w(HOLESC.indexOf(n),2);w.w(hcp==null?31:clamp(hcp,0,27),5);w.w(cv,3)}
  w.w(bagMask(H.bag),22);w.w(H.ball,1);w.w(H.setup,2);w.w(H.season,2);w.w(H.wear,2);w.w(H.casual,1);w.w(H.meter,2);w.w(H.kind===1?1:0,1);w.w(H.seat,2);w.w(H.look>>>0,24);w.w(0,1);if(cv>=7){w.w(H.ghosts&511,9);w.w(H.format&3,2);w.w(H.twist&7,3);w.w(H.hand&1,1)}
  for(let h=0;h<n;h++){const L=(log[h]||[]).slice(0,63);w.w(L.length,6);for(const e of L){const k=e.kind|0;w.w(k,2);
    if(k===0){w.w(e.c,5);w.w(e.s,3);w.w(e.t,3);w.w(e.y,16);w.w(e.p,8);w.w(e.a,8);w.w((e.m|0)+7,4);w.w(e.r,3);P(e.x,e.z);w.w(e.k||0,11);w.w(e.g?1:0,1);w.w(e.pv?1:0,1);w.w(e.mu?1:0,1);if(e.r===2){w.w(e.o|0,2);if(e.o===1||e.o===2)P(e.ox,e.oz)}}
    else if(k===1){w.w(e.o|0,2);if(e.o)P(e.ox,e.oz);P(e.x,e.z)}
    else if(k===3){w.w(e.dx+15,5);w.w(e.dz+15,5)}}}
  return 'V'+w.str()}
function decodeRound6(r,seed,n,hcp,cv,ver){const d={seed,n,hcp,cv,bag:maskBag(r.r(22)),ball:r.r(1),setup:r.r(2),season:r.r(2),wear:r.r(2),casual:r.r(1),meter:r.r(2),kind:r.r(1),seat:r.r(2),look:r.r(24),edits:r.r(1),v10:false,ghosts:0,format:0,twist:0,hand:0,log:[]};if(d.edits||d.meter>2)return null;if(ver>=7){if(cv<7)return null;d.ghosts=r.r(9);d.format=r.r(2);d.twist=r.r(3);d.hand=r.r(1);d.badge=d.twist>>2;d.twist&=3;if(d.badge)d.look|=1<<30;if(d.hand)d.look|=1<<29}
  for(let h=0;h<n;h++){const c=r.r(6),L=[];for(let q=0;q<c;q++){const k=r.r(2),e={kind:k};
      if(k===0){Object.assign(e,{c:r.r(5),s:r.r(3),t:r.r(3),y:r.r(16),p:r.r(8),a:r.r(8),m:r.r(4)-7,r:r.r(3),x:r.r(16),z:r.r(16),k:r.r(11),g:!!r.r(1),pv:!!r.r(1),mu:!!r.r(1)});if(e.c>=CLUB_SET.length||e.s>4||e.t>=TRAJ.length||e.m>7||e.r>3)return null;if(e.r===2){e.o=r.r(2);if(e.o===1||e.o===2){e.ox=r.r(16);e.oz=r.r(16)}}}
      else if(k===1){e.o=r.r(2);if(e.o){e.ox=r.r(16);e.oz=r.r(16)}e.x=r.r(16);e.z=r.r(16)}
      else if(k===3){e.dx=r.r(5)-15;e.dz=r.r(5)-15;if(e.dx>15||e.dz>15)return null}
      L.push(e)}d.log.push(L)}return d}
/* v6 bookkeeping: strokes after each entry, each swing's stroke number and dice attempt; a provisional counts only when the ball before it went out of bounds; a mulliganed swing counts nothing and its replacement rolls MULL_ATTEMPT */
function holeTally(L,seat=0,cv){const out=[],cap=tallyCap(cv);let n=0,orig=null,base=0,mull=false,holed=false;const a0=seat?SEAT_ATTEMPT+seat:0;
  for(const e of L){const o={no:0,att:a0,add:0,counts:false};
    if(e.kind===1)o.add=e.o===3?UNPLAY_BUNKER_OUT:PENALTY;
    else if(e.kind===2){o.add=1;holed=true}
    else if(e.kind===0){if(e.pv){o.no=base+3;o.inPlay=!!orig&&orig.r===3;if(o.inPlay){o.counts=true;o.add=1+(e.r===2||e.r===3?PENALTY:0);if(e.r===1)holed=true}}
      else{o.no=n+1;if(mull)o.att=MULL_ATTEMPT+seat;base=n;orig=e;if(!e.mu){o.counts=true;o.add=1+(e.r===2||e.r===3?PENALTY:0);if(e.r===1)holed=true}}
      mull=!!e.mu}
    if(cap&&o.add){if(n>=cap){o.over=true;o.add=0}else if(n+o.add>cap)o.add=cap-n}n+=o.add;o.n=n;out.push(o)}
  out.n=n;out.holed=holed;return out}
/* where every entry starts and ends, from the record alone; stroke and distance returns to the exact previous spot */
function holePath(L,pin,seat=0,cv){const T=holeTally(L,seat,cv),out=[];let pos=[0,0],plug=false,lf=0,prev=[0,0],origS=null,origEnd=null;
  for(let k=0;k<L.length;k++){const e=L[k],t=T[k],o={k,e,t,prev:prev.slice()};
    if(e.kind===0){const po=e.pv&&origS,start=po?origS.pos.slice():pos.slice(),sp=po?origS.plug:plug,sl=po?origS.lf:lf;o.start=start;o.plug=sp;o.lf=sl;
      const end=e.r===1?[pin.x,pin.z]:(e.r===3||(e.r===2&&!e.o))?start.slice():[uPos(e.x),uPos(e.z)];o.end=end;
      if(!e.pv)origS={pos:start,plug:sp,lf:sl};
      if(e.mu){pos=start;plug=sp;lf=sl}
      else if(e.pv&&!t.inPlay&&origEnd){pos=origEnd.pos.slice();plug=origEnd.plug;lf=origEnd.lf}
      else{pos=end.slice();plug=e.r===0&&!!e.g;lf=e.r===2&&e.o?1:0;prev=start}
      if(!e.pv)origEnd={pos:pos.slice(),plug,lf}}
    else if(e.kind===1){o.start=pos.slice();pos=e.o?[uPos(e.x),uPos(e.z)]:prev.slice();plug=false;lf=e.o?1:0;o.end=pos.slice()}
    else if(e.kind===3){o.start=pos.slice();pos=[pos[0]+e.dx/100,pos[1]+e.dz/100];plug=false;lf=2;o.end=pos.slice()}
    else{o.start=pos.slice();o.end=[pin.x,pin.z]}
    out.push(o)}
  out.pos=pos;out.plug=plug;out.lf=lf;out.T=T;out.prev=prev;return out}
VL.feature({id:'core.codec',kind:'sim',deps:['core.sim'],f:['F-007'],rules:{caps:{ghostCond:['gen4','d.cv>=4']}}});
/* ===== F-048 relief: the drop and the options ===== */
const DB=newBall();
function dropSim(x,z){MM=W.M||NM;return withBall(DB,()=>{const sw=W.wind;W.wind=CALM;place(x,z);DB.y+=DROP_H;DB.st='air';DB.rng=mulberry32(4242);DB.k0=0;DB.n=0;DB.nb=1;DB.t=0;settle();W.wind=sw;let rx=DB.x,rz=DB.z;terrainAt(W,rx,rz);
  if(DB.st!=='rest'||TQ.ty===7||MM.hyp(rx-x,rz-z)>DROP_KEEP||oob(W,rx,rz)){rx=x;rz=z}return[rx,rz]})}
function pondNear(x,z){let best=-1,bd=1e9;const i0=Math.floor((x-W.ox)/CS),j0=Math.floor((z-W.oz)/CS);for(let j=j0-4;j<=j0+4;j++)for(let i=i0-4;i<=i0+4;i++){if(i<0||j<0||i>=W.cols||j>=W.rows)continue;const c=j*W.cols+i;if(W.ty[c]!==7)continue;const d=MM.hyp(W.ox+(i+.5)*CS-x,W.oz+(j+.5)*CS-z);if(d<bd){bd=d;best=W.pond[c]}}return best}
/* a bank cell below the level of the pond beside it is not offered as a drop (the first stroke from it enters the water under the surface); the verifier stays lenient, so records made before this rule (M1) still verify */
const belowPond=(x,z)=>{const h=TQ.h,i0=Math.floor((x-W.ox)/CS),j0=Math.floor((z-W.oz)/CS);for(let j=j0-1;j<=j0+1;j++)for(let i=i0-1;i<=i0+1;i++){if(i<0||j<0||i>=W.cols||j>=W.rows)continue;const c=j*W.cols+i;if(W.ty[c]===7&&W.levels&&h<W.levels[W.pond[c]]+.05)return true}return false};
const spotOK=(x,z,sand,lenient)=>{if(oob(W,x,z))return false;terrainAt(W,x,z);const t=TQ.ty;if(t===7||t===4||!lenient&&belowPond(x,z))return false;terrainAt(W,x,z);return sand==null||(sand?t===6:t!==6)};
function reliefOptions(ctx){MM=W&&W.M||NM;if(W.cv>=5)return reliefOptions5(ctx);const sn=v=>uPos(qPos(v)),pin=W.pin,[rx,rz]=ctx.ref,dRef=MM.hyp(rx-pin.x,rz-pin.z),ux=(rx-pin.x)/(dRef||1),uz=(rz-pin.z)/(dRef||1),opts=[];
  const price=f=>{terrainAt(W,f[0],f[1]);return{ty:TQ.ty,exp:expected(MM.hyp(f[0]-pin.x,f[1]-pin.z),TQ.ty)}},best=list=>list.reduce((a,b)=>b.exp<a.exp-1e-9?b:a);
  opts.push(Object.assign({o:0,n:'Stroke and distance',spot:ctx.start.slice(),fin:ctx.start.slice()},price(ctx.start)));
  const sand=ctx.kind==='unplay'&&ctx.bunker?true:null,line=[],out=[];let inS=true;
  for(let d=0;d<=BACKLINE_MAX+1e-9;d+=BACKLINE_STEP){const x=sn(rx+ux*d),z=sn(rz+uz*d);if(sand){if(!inS)break;terrainAt(W,x,z);if(TQ.ty!==6){inS=false;if(!spotOK(x,z,false))continue;const f=dropSim(x,z);out.push(Object.assign({d,spot:[x,z],fin:f},price(f)));continue}}
    if(!spotOK(x,z,sand))continue;const f=dropSim(x,z);line.push(Object.assign({d,spot:[x,z],fin:f},price(f)))}
  if(sand)for(let d=out.length?out[out.length-1].d+BACKLINE_STEP:0;d<=BACKLINE_MAX&&out.length<30;d+=BACKLINE_STEP){const x=sn(rx+ux*d),z=sn(rz+uz*d);if(spotOK(x,z,false)){const f=dropSim(x,z);out.push(Object.assign({d,spot:[x,z],fin:f},price(f)))}}
  if(line.length){const b=best(line);opts.push(Object.assign({o:1,n:'Back on the line',line,li:line.indexOf(b)},b))}
  if(ctx.kind==='unplay'||ctx.pen==='R'){const lat=[];for(const r of[0,.6,1.2,1.75,LATERAL_R])for(let a=0;a<(r?16:1);a++){const x=sn(rx+MM.sin(a/16*TAU)*r),z=sn(rz+MM.cos(a/16*TAU)*r);if(MM.hyp(x-rx,z-rz)>LATERAL_R||MM.hyp(x-pin.x,z-pin.z)<dRef-1e-9||!spotOK(x,z,sand))continue;const f=dropSim(x,z);lat.push(Object.assign({spot:[x,z],fin:f},price(f)))}
    if(lat.length)opts.push(Object.assign({o:2,n:'Lateral',lat},best(lat)))}
  if(ctx.kind==='water'&&ctx.island){const dz=ctx.island,f=dropSim(dz[0],dz[1]);opts.push(Object.assign({o:3,n:'Drop zone',spot:dz.slice(),fin:f},price(f)))}
  if(sand&&out.length){const b=best(out);opts.push(Object.assign({o:3,n:'Out of the bunker',line:out,li:out.indexOf(b),extra:UNPLAY_BUNKER_OUT-PENALTY},b))}
  return W.cv>=4?opts.filter(o=>o.o===0||dryAt(o.fin[0],o.fin[1],false)):opts}
/* the verifier's legality check for a relief entry (null = legal) */
function reliefCheck(ctx,e){MM=W&&W.M||NM;if(W.cv>=5)return reliefCheck5(ctx,e);const pin=W.pin,o=e.o|0;if(o===0)return null;const fin=[uPos(e.x),uPos(e.z)],[rx,rz]=ctx.ref,dRef=MM.hyp(rx-pin.x,rz-pin.z);
  let spot;if(ctx.kind==='water'&&o===3){if(!ctx.island)return'no drop zone here';spot=ctx.island}else{if(e.ox==null)return'no spot';spot=[uPos(e.ox),uPos(e.oz)]}
  const sand=ctx.kind==='unplay'&&ctx.bunker;
  if(o===1||(ctx.kind==='unplay'&&o===3)){if(o===3&&!sand)return'not in a bunker';const ux=(rx-pin.x)/(dRef||1),uz=(rz-pin.z)/(dRef||1),vx=spot[0]-rx,vz=spot[1]-rz,al=vx*ux+vz*uz,ac=Math.abs(vx*uz-vz*ux);if(ac>.12||al<-.12||al>BACKLINE_MAX+.12)return'not back on the line';if(!spotOK(spot[0],spot[1],sand?(o===1):null,true))return'spot not playable'}
  else if(o===2){if(ctx.kind==='water'&&ctx.pen!=='R')return'lateral relief from a yellow area';if(MM.hyp(spot[0]-rx,spot[1]-rz)>LATERAL_R+.08)return'lateral drop beyond '+LATERAL_R+' m';if(MM.hyp(spot[0]-pin.x,spot[1]-pin.z)<dRef-.08)return'dropped nearer the hole';if(!spotOK(spot[0],spot[1],sand?true:null,true))return'spot not playable'}
  const f=dropSim(spot[0],spot[1]);return MM.hyp(f[0]-fin[0],f[1]-fin[1])>1?'the drop settles elsewhere':null}
function reliefCtx(kind,ref,start,e){const c={kind,ref,start};if(kind==='water'){const p=pondNear(ref[0],ref[1]);c.pond=p;c.pen=p<0?'R':pondPen(W,p);const P=p>=0&&p<W.PD.length?W.PD[p]:null;if(P&&P.ring&&P.drop)c.island=W.cv>=5?dropZone5():[uPos(qPos(P.drop.x)),uPos(qPos(P.drop.z))]}else{terrainAt(W,ref[0],ref[1]);c.bunker=TQ.ty===6}return c}
/* v6 replay: re-simulates every swing and drop from the record and checks each against the rules (F-013 verifier, ghosts) */
function holeReplay(L,h,hd){MM=W.M||NM;const P=holePath(L,W.pin,hd.seat|0,hd.cv),steps=[];let ok=true,why='';const fail=(k,w)=>{if(ok){ok=false;why='hole '+(h+1)+', entry '+(k+1)+': '+w}};
  for(const o of P){const e=o.e;if(e.mu&&(!hd.casual||hd.format))fail(o.k,hd.format?'mulligan in a format round':'mulligan in a strict round');
    if(e.kind===0){const seed=shotSeed(hd.seed,h,o.t.no,o.t.att),mis=uMis(e.m|0),r=withBall(GB,()=>{place(o.start[0],o.start[1]);GB.plug=o.plug;GB.lf=o.lf;GB.rng=mulberry32(seed);GB.k0=e.k||0;GB.ballType=hd.ball|0;GB.hand=hd.hand|0;GB.G=gAt(hd.golfer,L,h,L.indexOf(e));strike(clubById(e.c),uPow(e.p),uAcc(e.a),uYaw(e.y),e.s,e.t,mis);settle();return{st:GB.st,x:GB.x,z:GB.z,dx:GB.dx,dz:GB.dz,g:!!GB.plug}});
      steps.push({o,seed,mis,r});const rc=resCode(r.st);
      if(rc!==e.r)fail(o.k,'result '+rc+', recorded '+e.r);else if(rc===0&&(MM.hyp(r.x-uPos(e.x),r.z-uPos(e.z))>1||r.g!==!!e.g))fail(o.k,'rest point');
      else if(rc===2&&!(e.pv&&!o.t.inPlay)){const w=reliefCheck(reliefCtx('water',[r.dx,r.dz],o.start),e);if(w)fail(o.k,w)}}
    else if(e.kind===1){terrainAt(W,o.start[0],o.start[1]);if(TQ.ty===4||TQ.ty===7)fail(o.k,'unplayable on the green or in water');else{const w=reliefCheck(reliefCtx('unplay',o.start,o.prev),e);if(w)fail(o.k,w)}}
    else if(e.kind===2){terrainAt(W,o.start[0],o.start[1]);if(!hd.casual)fail(o.k,'gimme in a strict round');else if(TQ.ty!==4||MM.hyp(o.start[0]-W.pin.x,o.start[1]-W.pin.z)>GIMME_R+.01)fail(o.k,'not a gimme')}
    else{terrainAt(W,o.start[0],o.start[1]);const d0=MM.hyp(o.start[0]-W.pin.x,o.start[1]-W.pin.z),d1=MM.hyp(o.end[0]-W.pin.x,o.end[1]-W.pin.z);if(hd.season!==3)fail(o.k,'placement outside winter');else if(TQ.ty!==2&&TQ.ty!==3)fail(o.k,'placement off the fairway');else if(MM.hyp(e.dx,e.dz)/100>PLACE_R+.011||d1<d0-.005)fail(o.k,'placement too far or nearer the hole')}}
  if(ok&&hd.cv>=7){const k=P.T.findIndex(t=>t.over);if(k>=0)fail(k,'a stroke after the cap of '+TUNE.STROKE_CAP)}return{ok,why,steps,path:P}}
function mullCount(log,from,to){let n=0;for(let h=from;h<to;h++)for(const e of log[h]||[])if(e.mu)n++;return n}
function verifyRound6(d){{const tw=twistCheck5(d);if(tw)return{ok:false,why:tw,failHole:0}}/* F-013: every hole re-simulated on this build; returns the same shape as verify.js */const pars=parsFor(d.n,d.cv,d.kind,d.real),holes=[];
  for(let h=0;h<d.n;h++){W=genHole(d.seed,h,pars[h],d.cv,d.setup,d);const R=holeReplay(d.log[h]||[],h,d);if(!R.ok)return{ok:false,why:R.why,failHole:h+1};holes.push(holeTally(d.log[h]||[],d.seat,d.cv).n)}
  for(let s=0;s<d.n;s+=9)if(mullCount(d.log,s,Math.min(d.n,s+9))>MULL_PER_NINE)return{ok:false,why:'more than '+MULL_PER_NINE+' mulligan in a nine'};
  const total=holes.reduce((a,b)=>a+b,0),par=pars.reduce((a,b)=>a+b,0);return{ok:true,holes,total,par,rel:total-par}}
VL.feature({id:'f048.relief',kind:'sim',deps:['core.sim'],f:['F-048']});
