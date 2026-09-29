/* ===== B-1 the validated drop: from where the ball crossed in, back on the line from the hole to the nearest dry, stable spot; drop, drop again lower, then place — a drop never ends in a hazard ===== */
const DROP_STEP=.5,DROP_FAN=[10,-10,20,-20,30,-30],DRY_H=.05,DRY_R=.3,STABLE_T=1.5,STABLE_R=.25,DROP_H2=.25,SB2=newBall(),DZ_BACK=150;
/* dry: not water, not out of bounds, the ground at the spot and round its footprint above any water level reaching it; strict adds "not the green" (where a drop may not be made). Versions 2–5 test the spot and four points DRY_R away (as #1 shipped); version 6 tests the spot and eight points DRY_R round it (the 1,000-seed sweep found two wet drops between the four) */
function dryAt(x,z,strict){if(oob(W,x,z)||x<W.ox+2||z<W.oz+2||x>W.ox+W.cols*CS-2||z>W.oz+W.rows*CS-2)return false;
  if(W.cv<6){for(let k=0;k<5;k++){const px=x+(k===1?DRY_R:k===2?-DRY_R:0),pz=z+(k===3?DRY_R:k===4?-DRY_R:0);terrainAt(W,px,pz);if(TQ.ty===7||(W.cv>=7&&TQ.ty===9)||(strict&&TQ.ty===4)||(TQ.wl>-1e8&&TQ.h<TQ.wl+DRY_H))return false}return true}
  for(let k=0;k<9;k++){const a=k*Math.PI/4,r=k===8?0:DRY_R,px=x+MM.sin(a)*r,pz=z+MM.cos(a)*r;terrainAt(W,px,pz);if(TQ.ty===7||(W.cv>=7&&TQ.ty===9)||(strict&&TQ.ty===4)||(TQ.wl>-1e8&&TQ.h<TQ.wl+DRY_H))return false}return true}
/* stable: a ball released at rest there is still within STABLE_R after STABLE_T and never reaches water */
function stableAt(x,z){return withBall(SB2,()=>{place(x,z);SB2.st='roll';SB2.rng=mulberry32(1);SB2.k0=0;SB2.n=0;SB2.t=0;const N=Math.round(STABLE_T/DT);let n=0;while(SB2.st==='roll'&&n++<N)stepOne();return SB2.st==='rest'&&MM.hyp(SB2.x-x,SB2.z-z)<=STABLE_R})}
const goodSpot=(x,z)=>dryAt(x,z,true)&&stableAt(x,z);
/* the nearest good spot back on the line from the hole through the reference point, then fanned either side, never nearer the hole */
function dropLine(ref,all){const pin=W.pin,dRef=MM.hyp(ref[0]-pin.x,ref[1]-pin.z),ux=(ref[0]-pin.x)/(dRef||1),uz=(ref[1]-pin.z)/(dRef||1),out=[];
  for(const a of[0].concat(DROP_FAN)){const c=MM.cos(a*DEG),s=MM.sin(a*DEG),vx=ux*c-uz*s,vz=ux*s+uz*c;
    for(let d=0;d<=BACKLINE_MAX+1e-9;d+=DROP_STEP){const x=uPos(qPos(ref[0]+vx*d)),z=uPos(qPos(ref[1]+vz*d));if(MM.hyp(x-pin.x,z-pin.z)<dRef-1e-9||!goodSpot(x,z))continue;out.push({d,a,spot:[x,z]});if(!all)return out}
    if(out.length)return out}return out}
/* the drop itself: from DROP_H, then once more from DROP_H2; if neither stays within DROP_KEEP, dry and no nearer the hole, the ball is placed on the spot */
function dropOnce(x,z,h){return withBall(DB,()=>{const sw=W.wind;W.wind=CALM;place(x,z);DB.y+=h;DB.st='air';DB.rng=mulberry32(4242);DB.k0=0;DB.n=0;DB.nb=1;DB.t=0;settle();W.wind=sw;
  const d0=MM.hyp(x-W.pin.x,z-W.pin.z);if(W.cv<6){const rx=DB.x,rz=DB.z;return DB.st==='rest'&&MM.hyp(rx-x,rz-z)<=DROP_KEEP&&MM.hyp(rx-W.pin.x,rz-W.pin.z)>=d0-1e-9&&dryAt(rx,rz,false)?[uPos(qPos(rx)),uPos(qPos(rz))]:null}
  /* version 6 judges it where the record puts it: the rest point to the record's 5 cm */const q=[uPos(qPos(DB.x)),uPos(qPos(DB.z))];return DB.st==='rest'&&MM.hyp(q[0]-x,q[1]-z)<=DROP_KEEP&&MM.hyp(q[0]-W.pin.x,q[1]-W.pin.z)>=d0-1e-9&&dryAt(q[0],q[1],false)?q:null})}
function dropAt5(x,z){return dropOnce(x,z,DROP_H)||dropOnce(x,z,DROP_H2)||[x,z]}
/* an island's drop zone, validated when first needed: the planned point moved back along the centreline to the nearest good spot */
function dropZone5(){if(W.dz5!==undefined)return W.dz5;const P=W.PD.find(p=>p.ring&&p.drop);if(!P)return W.dz5=null;const C=W.C;let k=0,bd=1e9;
  for(let i=0;i<C.length;i++){const d=MM.hyp(C[i].x-P.drop.x,C[i].z-P.drop.z);if(d<bd){bd=d;k=i}}
  let x=P.drop.x,z=P.drop.z,walked=0;for(let i=k;i>0&&walked<=DZ_BACK;){const a=C[i],b=C[i-1],seg=MM.hyp(a.x-b.x,a.z-b.z)||1;for(let u=0;u<seg&&walked<=DZ_BACK;u+=DROP_STEP,walked+=DROP_STEP){x=a.x+(b.x-a.x)*u/seg;z=a.z+(b.z-a.z)*u/seg;const qx=uPos(qPos(x)),qz=uPos(qPos(z));if(goodSpot(qx,qz))return W.dz5=[qx,qz]}i--}
  return W.dz5=null}
/* versions 2 and 3 place the ball automatically: their own spot unless it is wet, then the validated one (or back where it was played from) */
function dropPointLive(){const r=dropPoint();if(dryAt(r[0],r[1],false))return r;const L=dropLine([B.dx,B.dz]);return L.length?L[0].spot:[B.sx,B.sz]}
function dropPointOK(s){/* the version 2–3 ghost check accepts either spot */const a=dropPoint(),b=dropPointLive();return MM.hyp(a[0]-uPos(s.x),a[1]-uPos(s.z))<=1||MM.hyp(b[0]-uPos(s.x),b[1]-uPos(s.z))<=1}
/* version 5 relief: every spot validated; back on the line starts at the nearest good spot; an option with no good spot is not offered */
function reliefOptions5(ctx){const pin=W.pin,[rx,rz]=ctx.ref,dRef=MM.hyp(rx-pin.x,rz-pin.z),opts=[];const price=f=>{terrainAt(W,f[0],f[1]);return{ty:TQ.ty,exp:expected(MM.hyp(f[0]-pin.x,f[1]-pin.z),TQ.ty)}};
  opts.push(Object.assign({o:0,n:'Stroke and distance',spot:ctx.start.slice(),fin:ctx.start.slice()},price(ctx.start)));
  const sand=ctx.kind==='unplay'&&ctx.bunker;
  if(!sand){const L=dropLine(ctx.ref,true).slice(0,40).map(q=>{const f=dropAt5(q.spot[0],q.spot[1]);return Object.assign({d:q.d,spot:q.spot,fin:f},price(f))});if(L.length)opts.push(Object.assign({o:1,n:'Back on the line',line:L,li:0},L[0]))}
  else{const inS=[],out=[],ux=(rx-pin.x)/(dRef||1),uz=(rz-pin.z)/(dRef||1);for(let d=0;d<=BACKLINE_MAX+1e-9&&(inS.length<30||out.length<30);d+=DROP_STEP){const x=uPos(qPos(rx+ux*d)),z=uPos(qPos(rz+uz*d));if(MM.hyp(x-pin.x,z-pin.z)<dRef-1e-9)continue;terrainAt(W,x,z);
      if(TQ.ty===6){if(inS.length<30&&stableAt(x,z)){const f=dropAt5(x,z);inS.push(Object.assign({d,spot:[x,z],fin:f},price(f)))}}else if(out.length<30&&goodSpot(x,z)){const f=dropAt5(x,z);out.push(Object.assign({d,spot:[x,z],fin:f},price(f)))}}
    if(inS.length)opts.push(Object.assign({o:1,n:'Back on the line',line:inS,li:0},inS[0]));if(out.length)opts.push(Object.assign({o:3,n:'Out of the bunker',line:out,li:0,extra:UNPLAY_BUNKER_OUT-PENALTY},out[0]))}
  if(ctx.kind==='unplay'||ctx.pen==='R'){const lat=[];for(const r of[0,.6,1.2,1.75,LATERAL_R])for(let a=0;a<(r?16:1);a++){const x=uPos(qPos(rx+MM.sin(a/16*TAU)*r)),z=uPos(qPos(rz+MM.cos(a/16*TAU)*r));if(MM.hyp(x-rx,z-rz)>LATERAL_R||MM.hyp(x-pin.x,z-pin.z)<dRef-1e-9)continue;terrainAt(W,x,z);if(sand?TQ.ty!==6:!goodSpot(x,z))continue;const f=sand?dropSim(x,z):dropAt5(x,z);lat.push(Object.assign({spot:[x,z],fin:f},price(f)))}
    if(lat.length)opts.push(Object.assign({o:2,n:'Lateral',lat},lat.reduce((a,b)=>b.exp<a.exp-1e-9?b:a)))}
  if(ctx.kind==='water'&&ctx.island){const dz=ctx.island,f=dropAt5(dz[0],dz[1]);opts.push(Object.assign({o:3,n:'Drop zone',spot:dz.slice(),fin:f},price(f)))}
  return opts}
/* the version-5 verifier's check of a relief entry (null = legal) */
function reliefCheck5(ctx,e){const pin=W.pin,o=e.o|0;if(o===0)return null;const fin=[uPos(e.x),uPos(e.z)],[rx,rz]=ctx.ref,dRef=MM.hyp(rx-pin.x,rz-pin.z),sand=ctx.kind==='unplay'&&ctx.bunker;let spot;
  if(ctx.kind==='water'&&o===3){if(!ctx.island)return'no drop zone here';spot=ctx.island}else{if(e.ox==null)return'no spot';spot=[uPos(e.ox),uPos(e.oz)]}
  if(o===1||(ctx.kind==='unplay'&&o===3)){if(o===3&&!sand)return'not in a bunker';const ux=(rx-pin.x)/(dRef||1),uz=(rz-pin.z)/(dRef||1),vx=spot[0]-rx,vz=spot[1]-rz,al=vx*ux+vz*uz,ac=Math.abs(vx*uz-vz*ux);
    if(o===1&&al<-.12)return'not back on the line';if(o===1&&ac>Math.max(.12,al*MM.tan(DROP_FAN[DROP_FAN.length-1]*DEG)+.12))return'not back on the line';if(o===3&&(ac>.12||al<-.12))return'not back on the line';if(MM.hyp(spot[0]-pin.x,spot[1]-pin.z)<dRef-.08)return'dropped nearer the hole';terrainAt(W,spot[0],spot[1]);if(sand&&o===1?TQ.ty!==6||!stableAt(spot[0],spot[1]):(sand&&TQ.ty===6)||!goodSpot(spot[0],spot[1]))return'spot not dry and stable'}
  else if(o===2){if(ctx.kind==='water'&&ctx.pen!=='R')return'lateral relief from a yellow area';if(MM.hyp(spot[0]-rx,spot[1]-rz)>LATERAL_R+.08)return'lateral drop beyond '+LATERAL_R+' m';if(MM.hyp(spot[0]-pin.x,spot[1]-pin.z)<dRef-.08)return'dropped nearer the hole';if(sand){terrainAt(W,spot[0],spot[1]);if(TQ.ty!==6)return'spot not in the bunker'}else if(!goodSpot(spot[0],spot[1]))return'spot not dry and stable'}
  const f=sand&&o===2?dropSim(spot[0],spot[1]):dropAt5(spot[0],spot[1]);return MM.hyp(f[0]-fin[0],f[1]-fin[1])>1?'the drop settles elsewhere':null}
