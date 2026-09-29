/* ===== Q-09 the quality gate (course version 5): every hole's plan is scored for a choice, a landmark and a fair green before any terrain is built; one under GATE_BAR is re-planned from the green outward — same tee, line, length and par — up to GATE_TRIES, keeping the best. The closing three of a Real 18 are scored, never re-planned ===== */
const HZ_NEAR=12,DOG_ANG=20*DEG,LM_CONE=30*DEG,LM_NEAR=120,LM_FAR=300,GREEN_FLAT=.7,GATE_W=[.4,.25,.35],GATE_BAR=.75,GATE_TRIES=3,GATE_LZ=[200,260],GATE_FIXED=15,GATE=new Map();
let GATE_K=-1;
/* what lies at a point of a plan: 0 nothing, 1 sand, 2 water (a pond, a moat or the sea) */
function gateProbe(p,seed,cv,idx){const el=q=>{const c=MM.cos(q.rot),s=MM.sin(q.rot);return(x,z)=>{const dx=x-q.x,dz=z-q.z,u=(dx*c+dz*s)/q.rx,v=(dz*c-dx*s)/q.rz;return Math.sqrt(u*u+v*v)}};
  const bk=p.BK.map(el),pd=p.PD.map(q=>[q,el(q)]),g=p.g,gR=p.gR,CP=cv>=CV_ISL?null:coursePlan(seed,cv);let sea=null;
  if(CP&&CP.coast){const H=courseHole(seed,cv,idx),c=MM.cos(H.h),s=MM.sin(H.h);sea=(x,z)=>MM.hyp(x-g.x,z-g.z)>=gR+22&&MM.hyp(x,z)>=28&&seaExcess(CP,H.ox+x*c+z*s,H.oz-x*s+z*c)>0}
  return(x,z)=>{for(const[q,e]of pd){const d=e(x,z);if(q.ring?d>q.ring&&d<1:d<1)return 2}if(sea&&sea(x,z))return 2;if(MM.hyp(x-g.x,z-g.z)<gR)return 0;for(const e of bk)if(e(x,z)<1)return 1;return 0}}
function gateScore(p,seed,idx,par,cv){const A=p.arch||{},hz=gateProbe(p,seed,cv,idx),{len,g,gR,hw,at,perp,N}=p,end=len-gR-20,hp=(q,o)=>{const r=perp(q,o);return hz(r.x,r.z)};
  /* choice */let c=.2;
  if(A.drivable||A.reach||A.cape||A.lane)c=1;else if(A.island||A.front)c=.8;
  if(par>3){let L=0,R=0;for(let t=GATE_LZ[0];t<=GATE_LZ[1]&&t<end;t+=10){const q=at(t),w=hw(t)+HZ_NEAR;for(let o=-w;o<=w;o+=2){if(hp(q,o))o<0?L=1:R=1}}if(L+R)c=Math.max(c,L+R===1?1:.5);
    for(const b of p.B){if(Math.abs(b.dh)<DOG_ANG)continue;const sg=Math.sign(b.dh);let hit=0;for(let t=b.t0-20;t<=b.t1+20&&t<end;t+=10){const q=at(t),w=hw(t);for(let o=w*.5;o<=w+HZ_NEAR+8;o+=2)if(hp(q,sg*o))hit=1}c=Math.max(c,hit?1:.6)}
    for(let t=120;t<len-gR-5;t+=4){const q=at(t),w=hw(t)*.5;if(hp(q,-w)===2&&hz(q.x,q.z)===2&&hp(q,w)===2){c=Math.max(c,.7);break}}}
  else{const f=MM.atan2(g.x,g.z),sides=new Set();for(const r of[gR+2,gR+5,gR+8])for(let a=0;a<24;a++){const u=a/24*TAU;if(hz(g.x+MM.sin(u)*r,g.z+MM.cos(u)*r)){let d=u-f;d=MM.atan2(MM.sin(d),MM.cos(d));sides.add(Math.round(d/(Math.PI/2))&3)}}
    if(sides.size)c=Math.max(c,sides.size===1?1:sides.size===2?.8:.6)}
  /* landmark: water, sand or a raised or sunken green where the tee shot is aimed */
  const aim=par>3?at(Math.min(230,len*.8)):g,f=MM.atan2(aim.x,aim.z);let nw=0,nb=0;
  for(let r=LM_NEAR;r<=LM_FAR;r+=6)for(let a=-LM_CONE;a<=LM_CONE+1e-9;a+=3*DEG){const k=hz(MM.sin(f+a)*r,MM.cos(f+a)*r);if(k===2)nw++;else if(k===1)nb++}
  const gd=MM.hyp(g.x,g.z),gIn=gd>=LM_NEAR&&gd<=LM_FAR&&Math.abs(MM.atan2(MM.sin(MM.atan2(g.x,g.z)-f),MM.cos(MM.atan2(g.x,g.z)-f)))<=LM_CONE;
  const l=nw>=3||nb>=6||(gIn&&p.gRise)?1:nb?.6:gIn?.5:0;
  /* fair green: the share of the green flatter than PIN_SLOPE (mapped so GREEN_FLAT is full marks) × the share of pin slots that stand where they were drawn × a way in along the ground */
  const tx=MM.sin(p.ta)*p.tm,tz=MM.cos(p.ta)*p.tm,bk=p.BK.map(q=>{const cq=MM.cos(q.rot),sq=MM.sin(q.rot);return(x,z)=>{const dx=x-q.x,dz=z-q.z,u=(dx*cq+dz*sq)/q.rx,v=(dz*cq-dx*sq)/q.rz,e=Math.sqrt(u*u+v*v);return e<1.4?q.depth*(1-sstep(.55,1.4,e)):0}});
  const hG=(x,z)=>{let h=(x-g.x)*tx+(z-g.z)*tz+N.fbm(x*.11+2,z*.11+9,2)*.13+(p.gs?p.gs.f(x,z):0);for(const d of bk)h-=d(x,z);return h},tan3=MM.tan(PINS.slope),flat=(x,z)=>MM.hyp(hG(x+.5,z)-hG(x-.5,z),hG(x,z+.5)-hG(x,z-.5))<=tan3;
  let nf=0,nt=0;for(let x=-gR;x<=gR;x+=1.5)for(let z=-gR;z<=gR;z+=1.5){if(MM.hyp(x,z)>gR-1)continue;nt++;if(flat(g.x+x,g.z+z))nf++}if(p.twin){const tw=p.twin;for(let x=-tw.r;x<=tw.r;x+=1.5)for(let z=-tw.r;z<=tw.r;z+=1.5){if(MM.hyp(x,z)>tw.r-1)continue;nt++;if(flat(tw.x+x,tw.z+z))nf++}}
  let ps=1;if(p.pins){let ok=0;for(let i=1;i<4;i++){const q=p.pins[i];let good=MM.hyp(q.x-g.x,q.z-g.z)<gR-.5&&flat(q.x,q.z);for(let a=0;a<6&&good;a++){const x=q.x+MM.sin(a/6*TAU)*PINS.edge,z=q.z+MM.cos(a/6*TAU)*PINS.edge,d=MM.hyp(x-g.x,z-g.z);if(d>=gR+1.6||hz(x,z))good=false}if(good)ok++}ps=ok/3}
  let way=1;if(par>3&&!(A.island||A.reach||A.drivable)){for(let t=len-gR-40;t<=len-gR;t+=4){const q=at(t),w=hw(t);let all=true;for(const o of[-w,-w/2,0,w/2,w])if(hp(q,o)!==2){all=false;break}if(all){way=0;break}}}
  const gg=Math.min(1,(nt?nf/nt:1)/GREEN_FLAT)*ps*way;
  if(cv>=7){const bt=boldTerm(p,hz);if(bt)return{c,l,g:gg,b:bt.bold,payoff:bt.payoff,risk:bt.risk,s:GATE_W7[0]*c+GATE_W7[1]*l+GATE_W7[2]*gg+GATE_W7[3]*bt.bold};if(A.blind){const c2=Math.max(c,.8);return{c:c2,l:1,g:gg,s:GATE_W[0]*c2+GATE_W[1]+GATE_W[2]*gg}}}return{c,l,g:gg,s:GATE_W[0]*c+GATE_W[1]*l+GATE_W[2]*gg}}
/* the attempt a hole plays: the first plan unless it scores under GATE_BAR; cached per hole */
function gatePick(seed,idx,par,cv){const key=seed+'/'+idx+'/'+par+'/'+cv;let r=GATE.get(key);if(r)return r;const sc=[];let best=0;
  for(let k=0;k<GATE_TRIES;k++){GATE_K=k;let p;try{p=holePlan_(seed,idx,par,cv,false)}finally{GATE_K=-1}sc.push(gateScore(p,seed,idx,par,cv));if(sc[k].s>sc[best].s+1e-12)best=k;if(sc[k].s>=GATE_BAR||(cv>=CV_ISL?(idx<36?idx%18:0):idx)>=GATE_FIXED)break}
  r={k:best,sc};GATE.set(key,r);return r}
/* the first plan's score (the suite's measure of the gate) */
const gateFirst=(seed,idx,par,cv)=>withMath(cv,()=>{GATE_K=0;try{return gateScore(holePlan_(seed,idx,par,cv,false),seed,idx,par,cv)}finally{GATE_K=-1}});
