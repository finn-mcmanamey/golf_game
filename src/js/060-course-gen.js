/* ================= course generation ================= */
function makeTree(x,z,y,R){const rr=(a,b)=>a+R()*(b-a),s=rr(.8,1.4),t={x,z,y,cs:[],boxes:[]},trunk=[.36,.24,.14],vary=c=>c.map(v=>v*rr(.88,1.12));
  if(R()<.45){t.th=3.2*s;t.tr=.3*s;const c=[.16+R()*.06,.40+R()*.1,.22];t.boxes.push([x,y+t.th/2,z,.26*s,t.th/2,.26*s,trunk]);
    let yy=y+t.th;for(const w of[2.2,1.7,1.2]){const ww=w*s;t.boxes.push([x,yy+ww*.9,z,ww,ww*.9,ww,vary(c)]);t.cs.push({x,y:yy+ww*.9,z,r:ww*1.2});yy+=ww*1.35}}
  else{t.th=3.4*s;t.tr=.36*s;const c=R()<.08?[.85,.55,.18]:[.30+R()*.08,.60+R()*.1,.24];t.boxes.push([x,y+t.th/2,z,.34*s,t.th/2,.34*s,trunk]);
    const cy=y+t.th+1.6*s;t.boxes.push([x,cy,z,2.3*s,2*s,2.3*s,c]);t.cs.push({x,y:cy,z,r:2.7*s});
    for(let k=0;k<3;k++){const a=R()*TAU,d=1.7*s,bx=x+MM.sin(a)*d,by=cy+rr(-.6,1.2)*s,bz=z+MM.cos(a)*d,hs=1.5*s;t.boxes.push([bx,by,bz,hs,hs*.9,hs,vary(c)]);t.cs.push({x:bx,y:by,z:bz,r:hs*1.15})}}
  return t}
function holePlan(seed,idx,par,cv=0,noWind){return withMath(cv,()=>holePlan_(seed,idx,par,cv,noWind))}function holePlan_(seed,idx,par,cv=0,noWind){PCV=cv;const BI=BIOMES[biomeOf(seed,cv)];
  const R=mulberry32((seed*1000003+idx*7919+13)|0),rr=(a,b)=>a+R()*(b-a),N=makeNoise(mulberry32((seed*31+idx*101+7)|0));
  if(cv>=2){if(cv>=5&&!noWind&&GATE_K<0){GATE_K=gatePick(seed,idx,par,cv).k;try{return plan7(holePlan2(seed,idx,par,cv,R,rr,N,BI,noWind),seed,idx,par,cv,noWind)}finally{GATE_K=-1}}return plan7(holePlan2(seed,idx,par,cv,R,rr,N,BI,noWind),seed,idx,par,cv,noWind)}
  const len=par===3?rr(125,195):par===4?rr(315,410):rr(455,530);
  const nb=par===3?0:par===4?(R()<.75?1:0):(R()<.6?2:1),B=[];
  for(let b=0;b<nb;b++){const t0=nb===1?len*rr(.4,.6):len*(.28+b*.36+rr(0,.1));B.push({t0,t1:t0+rr(70,120),dh:(R()<.5?-1:1)*rr(.3,.6)})}
  const step=4,n=Math.ceil(len/step),C=[];
  for(let i=0,x=0,z=0;i<=n;i++){const t=Math.min(i*step,len);let h=0;for(const b of B)h+=b.dh*sstep(b.t0,b.t1,t);C.push({x,z,t,h});const ds=clamp(len-i*step,0,step);x+=MM.sin(h)*ds;z+=MM.cos(h)*ds}
  const g=C[n],gR=par===3?rr(9,13):rr(11,15);
  const hw=t=>(par===3?11:15)+4*N.n2(t*.02,7.3)-3*sstep(len-70,len,t);
  const at=t=>{const f=clamp(t/step,0,n-1e-6),k=f|0,u=f-k,a=C[k],b=C[k+1]||a;return{x:lerp(a.x,b.x,u),z:lerp(a.z,b.z,u),h:a.h}};
  const perp=(c,o)=>({x:c.x+MM.cos(c.h)*o,z:c.z-MM.sin(c.h)*o});
  const pa=rr(0,TAU),pd=gR*rr(0,.55),pin={x:g.x+MM.sin(pa)*pd,z:g.z+MM.cos(pa)*pd,y:0};
  const BK=[],PD=[],ng=1+(R()<.6?1:0)+(R()<.3?1:0);let nfb=0;
  for(let k=0;k<ng;k++){const a=rr(0,TAU),d=gR+rr(3.5,7);BK.push({x:g.x+MM.sin(a)*d,z:g.z+MM.cos(a)*d,rx:rr(4,7),rz:rr(3,5),rot:rr(0,Math.PI),depth:rr(.5,.9)})}
  if(par>3){const nf=R()<.7?1:R()<.5?2:0;nfb=nf;for(let k=0;k<nf;k++){const t=rr(190,260),c=at(t),p=perp(c,(R()<.5?-1:1)*(hw(t)+rr(-3,6)));BK.push({x:p.x,z:p.z,rx:rr(6,10),rz:rr(4,6),rot:c.h+rr(-.3,.3),depth:rr(.4,.7)})}}
  if(par===3){if(R()<.55){const c=at(len*rr(.32,.52));PD.push({x:c.x+rr(-6,6),z:c.z,rx:rr(20,30),rz:rr(15,22),rot:rr(-.3,.3),depth:3})}}
  else if(R()<.65){const t=len*rr(.48,.8),c=at(t),p=perp(c,(R()<.5?-1:1)*(hw(t)+rr(5,14)));PD.push({x:p.x,z:p.z,rx:rr(20,34),rz:rr(16,26),rot:rr(0,Math.PI),depth:3})}
  const ta=rr(0,TAU),tm=rr(.012,.028),ws=R()*R()*8*BI.wind,wa=rr(0,TAU),wind={x:MM.sin(wa)*ws,z:MM.cos(wa)*ws,s:ws,a:wa};
  return{R,rr,N,len,B,step,n,C,g,gR,hw,at,perp,pin,BK,PD,nfb,ta,tm,wind}}
/* Course version 2: archetypes (F-031) and routing (F-030). Weights and dimensions live in the brief's Numbers tables. */
const ARCH=[
  {n:'Short iron',par:3,len:[125,160],w:.35},{n:'Long over water',par:3,len:[165,195],w:.25,front:true},{n:'Island green',par:3,len:[140,175],w:.2,island:true},{n:'Punchbowl',par:3,len:[150,190],w:.2,gRise:-1.8,gBlend:[-1,7]},
  {n:'Dogleg',par:4,len:[315,410],w:.3,bends:1},{n:'Cape',par:4,len:[345,410],w:.2,cape:true},{n:'Drivable',par:4,len:[265,300],w:.15,drivable:true,tRise:1.5},{n:'Plateau',par:4,len:[330,390],w:.2,gRise:2.5,gBlend:[2,11],bends:1},{n:'Split fairway',par:4,len:[340,400],w:.15,bends:1,lane:true},
  {n:'Three-shot',par:5,len:[455,530],w:.35,bends:1},{n:'Reachable over water',par:5,len:[455,500],w:.3,reach:true,tRise:1.5,bends:1},{n:'Double dogleg',par:5,len:[470,530],w:.2,bends:2},{n:'Cape',par:5,len:[480,530],w:.15,cape:true}];
const WEATHER=[{n:'Clear',wind:1,fog:1,p:.55},{n:'Breezy',wind:1.4,fog:1,p:.25},{n:'Overcast',wind:1,fog:1.8,p:.2,flat:true}];
const WEATHER3=[{n:'Clear',wind:1,fog:1,p:.45},{n:'Breezy',wind:1.4,fog:1,p:.22},{n:'Overcast',wind:1,fog:1.8,p:.18,flat:true},{n:'Rain',wind:.9,fog:1.6,p:.15,flat:true,rain:true,light:.85}];
const RAIN={rest:.8,bf:1.2,roll:1.25,drag:1.03,spin:1.15,swell:.6};
const WIND={period:12,swell:.25,ahead:8,ticks:Math.round(12/DT)};
const PINS={slots:4,c:.3,t:.62,edge:3.5,slope:3*DEG,diff:[0,11,22,33],day:[0,0,1,1,2,2,3],names:['centre pins','midweek pins','weekend pins','Sunday pins']};
const SWING_TICKS=92;
const GOLF={back:.55,down:.22,thru:.5,top0:60*DEG,top1:120*DEG,tempo:[.8,1.3],putt:.35,idle:6,practice:1.4};
const CAM3={pin:3,from:20,water:8,launch:.7,ff:8,slow:.35,slowT:1.2,fade:.15,rev:1.2,short:3.5};
const LIES={sitDown:[.4,.55],sitDf:.9,sitSf:.7,plugAng:45*DEG,plugV:14,plugDf:.85,plugDf2:.6,plugSf:.3,markAng:35*DEG};
const CPLAN={};
function coursePlan(seed,cv){return withMath(cv,()=>coursePlan_(seed,cv))}function coursePlan_(seed,cv){if(cv>=CV_ISL)return islPlan(seed,cv);const key=seed+'/'+cv;if(CPLAN[key])return CPLAN[key];const R=mulberry32((seed*2654435+977)|0),rr=(a,b)=>a+R()*(b-a),BI=BIOMES[biomeOf(seed,cv)];
  const WT=cv>=3?WEATHER3:WEATHER;let u=R(),wi=0;for(let i=0;i<WT.length;i++){if(u<WT[i].p){wi=i;break}u-=WT[i].p}const wea=WT[wi];
  const ws=R()*R()*8*BI.wind*wea.wind,wa=rr(0,TAU),wind={x:MM.sin(wa)*ws,z:MM.cos(wa)*ws,s:ws,a:wa};
  const P={seed,cv,wea,wind,holes:[],R,rr,swell:cv>=3?WIND.swell*(wea.rain?RAIN.swell:1):0};
  if(cv>=4){P.style=Math.floor(R()*3);P.architect=ARCHITECT_NAMES[Math.floor(R()*ARCHITECT_NAMES.length)];
    if(BI.coast){const b=rr(0,TAU),nx=MM.sin(b),nz=MM.cos(b);P.coast={nx,nz,tx:nz,tz:-nx,s0:rr(COAST_S0[0],COAST_S0[1]),N:makeNoise(mulberry32(thash(seed,6101)))};
      wind.x-=nx*SEA_BREEZE;wind.z-=nz*SEA_BREEZE;wind.s=MM.hyp(wind.x,wind.z);wind.a=MM.atan2(wind.x,wind.z)}}
  CPLAN[key]=P;return P}
/* F-059: the sea is a half-plane of the property; positive = metres beyond the coastline */
const seaExcess=(P,wx,wz)=>{if(P.isl)return P.isl.sea(wx,wz);const C=P.coast,u=wx*C.tx+wz*C.tz;return wx*C.nx+wz*C.nz-(C.s0+COAST_WOBBLE*clamp(C.N.n2(u*.012,3.3),-1,1))};
const fromWorld=(H,wx,wz)=>{const dx=wx-H.ox,dz=wz-H.oz,c=MM.cos(H.h),s=MM.sin(H.h);return[dx*c-dz*s,dx*s+dz*c]};
/* F-057 Real 18 (course version 4): two loops from one clubhouse, the routing keeps clear of the sea */
function courseHole4(seed,cv,idx){const P=coursePlan(seed,cv);
  while(P.holes.length<=idx){const i=P.holes.length,par=PAR18_4[i],prev=P.holes[i-1],plan0=holePlan(seed,i,par,cv,true),L=MM.hyp(plan0.g.x,plan0.g.z),ga=MM.atan2(plan0.g.x,plan0.g.z);
    const pen=(ox,oz,h)=>{if(!P.coast)return 0;const c=MM.cos(h),s=MM.sin(h);let m=-1e9;for(let k=0;k<plan0.C.length;k+=5){const q=plan0.C[k];m=Math.max(m,seaExcess(P,ox+q.x*c+q.z*s,oz-q.x*s+q.z*c)+COAST_IN)}
      m=Math.max(m,seaExcess(P,ox+plan0.g.x*c+plan0.g.z*s,oz-plan0.g.x*s+plan0.g.z*c)+COAST_IN+plan0.gR+15);return m>0?200+8*m:m>-45?-50:0};
    let h,ox,oz;
    if(i===0||i===9){if(i===0){ox=0;oz=0}else{const h1=P.holes[0].h;ox=-MM.sin(h1)*CLUB_OFF;oz=-MM.cos(h1)*CLUB_OFF}let best=null;
      for(let k=0;k<ROUTE_TRIES;k++){const cand=i===0?P.rr(0,TAU):P.holes[0].h+(P.R()<.5?-1:1)*P.rr(BACK_TURN[0],BACK_TURN[1])*DEG,dd=pen(ox,oz,cand)+k*1e-3;if(!best||dd<best.dd)best={h:cand,dd}}h=best.h;
      if(i===0){const t10=[-MM.sin(h)*CLUB_OFF,-MM.cos(h)*CLUB_OFF];P.club={x:t10[0]/2+MM.cos(h)*16,z:t10[1]/2-MM.sin(h)*16,h}}}
    else{const gx=prev.ox+prev.g.x*MM.cos(prev.h)+prev.g.z*MM.sin(prev.h),gz=prev.oz-prev.g.x*MM.sin(prev.h)+prev.g.z*MM.cos(prev.h),left=9-i%9,target=Math.min((left-1)*330,900),hx=cv>=7&&i>=9&&P.twinT?P.twinT.x:0,hz=cv>=7&&i>=9&&P.twinT?P.twinT.z:0;let best=null;
      for(let k=0;k<ROUTE_TRIES;k++){const cand=prev.h+P.rr(-100,100)*DEG,tx=gx+MM.sin(cand)*60,tz=gz+MM.cos(cand)*60,ex=tx+MM.sin(cand+ga)*L,ez=tz+MM.cos(cand+ga)*L;
        const dd=Math.abs(MM.hyp(ex-hx,ez-hz)-target)+(k?0:-40)+pen(tx,tz,cand);if(!best||dd<best.dd)best={h:cand,dd}}
      h=best.h;let walk=P.rr(40,80);if(cv>=7&&i>=9&&i<=16&&P.twinT){const r=route16(P,gx,gz,L,ga,pen,prev.h,i);if(r)h=r.h}if(cv>=7&&i===17&&P.twinT){const r=twinRoute(P,gx,gz,L,ga,pen);if(r){h=r.h;walk=r.walk}}ox=gx+MM.sin(h)*walk;oz=gz+MM.cos(h)*walk}
    const plan=holePlan(seed,i,par,cv,true),c=MM.cos(h),sn=MM.sin(h),lw={x:P.wind.x*c-P.wind.z*sn,z:P.wind.x*sn+P.wind.z*c};
    P.holes.push({i,par,h,ox,oz,g:plan.g,gR:plan.gR,len:plan.len,arch:plan.arch,C:plan.C,PD:plan.PD,hw:plan.hw,wind:{x:lw.x,z:lw.z,s:P.wind.s,a:MM.atan2(lw.x,lw.z)}});if(cv>=7)twin7(P,i,plan)}
  return P.holes[idx]}
function courseHole(seed,cv,idx){return withMath(cv,()=>courseHole_(seed,cv,idx))}function courseHole_(seed,cv,idx){if(cv>=4)return courseHole4(seed,cv,idx);const P=coursePlan(seed,cv);while(P.holes.length<=idx){const i=P.holes.length,par=PAR18[i],prev=P.holes[i-1];let h,ox,oz;
    if(!prev){h=P.rr(0,TAU);ox=0;oz=0}else{const gx=prev.ox+prev.g.x*MM.cos(prev.h)+prev.g.z*MM.sin(prev.h),gz=prev.oz-prev.g.x*MM.sin(prev.h)+prev.g.z*MM.cos(prev.h),left=(i%9===0?9:9-i%9);
      const plan0=holePlan(seed,i,par,cv,true),L=MM.hyp(plan0.g.x,plan0.g.z),ga=MM.atan2(plan0.g.x,plan0.g.z),target=Math.min((left-1)*330,900);let best=null;
      for(let k=0;k<7;k++){const cand=prev.h+P.rr(-100,100)*DEG,tx=gx+MM.sin(cand)*60,tz=gz+MM.cos(cand)*60,ex=tx+MM.sin(cand+ga)*L,ez=tz+MM.cos(cand+ga)*L;
        const dd=Math.abs(MM.hyp(ex,ez)-target)+(k?0:-40);if(!best||dd<best.dd)best={h:cand,dd}}
      h=best.h;let walk=P.rr(40,80);if(cv>=7&&i>=9&&i<=16&&P.twinT){const r=route16(P,gx,gz,L,ga,pen,prev.h,i);if(r)h=r.h}if(cv>=7&&i===17&&P.twinT){const r=twinRoute(P,gx,gz,L,ga,pen);if(r){h=r.h;walk=r.walk}}ox=gx+MM.sin(h)*walk;oz=gz+MM.cos(h)*walk}
    const plan=holePlan(seed,i,par,cv,true),c=MM.cos(h),sn=MM.sin(h),lw={x:P.wind.x*c-P.wind.z*sn,z:P.wind.x*sn+P.wind.z*c};
    P.holes.push({i,par,h,ox,oz,g:plan.g,gR:plan.gR,len:plan.len,arch:plan.arch,C:plan.C,PD:plan.PD,hw:plan.hw,wind:{x:lw.x,z:lw.z,s:P.wind.s,a:MM.atan2(lw.x,lw.z)}});if(cv>=7)twin7(P,i,plan)}
  return P.holes[idx]}
const toWorld=(H,lx,lz)=>[H.ox+lx*MM.cos(H.h)+lz*MM.sin(H.h),H.oz-lx*MM.sin(H.h)+lz*MM.cos(H.h)];
function pickArch(R,par){const list=ARCH.filter(a=>a.par===par);let u=R()*list.reduce((s,a)=>s+a.w,0);for(const a of list){if(u<a.w)return a;u-=a.w}return list[0]}
/* version 4: the architect bends the weights (F-058); holes 16-18 of a Real 18 are the closing three (F-057), still drawn from the same number */
function pickArch4(R,par,idx,ST){const u=R();if(PCV>=CV_ISL){if(idx===33)return ARCH[6];if(idx===34)return ARCH[3];if(idx===35)return ARCH[10];if(idx===39)return ARCH[6]}if(idx===15)return ARCH[5];if(idx===16)return u<ISLAND_17?ARCH[2]:ARCH[1];if(idx===17)return ARCH[7];
  const list=(PCV>=7?ARCH7:ARCH).filter(a=>a.par===par),w=a=>a.w*(ST.w[a.n]||1);let v=u*list.reduce((s,a)=>s+w(a),0);for(const a of list){if(v<w(a))return a;v-=w(a)}return list[0]}
function holePlan2(seed,idx,par,cv,R,rr,N,BI,noWind){const CP=cv>=4?(cv>=CV_ISL?islMeta(seed):coursePlan(seed,cv)):null,ST=CP?ARCH_STYLES[CP.style]:null,A=ST?pickArch4(R,par,idx,ST):pickArch(R,par),len=rr(A.len[0],A.len[1]),B=[];
  const nb=A.bends||0;for(let b=0;b<nb;b++){const t0=nb===1?len*rr(.4,.6):len*(.28+b*.36+rr(0,.1));B.push({t0,t1:t0+rr(70,120),dh:(R()<.5?-1:1)*(PCV>=7&&A.lane?rr(TUNE.LANE_BEND0,TUNE.LANE_BEND1):rr(.3,.6))})}
  if(A.cape){const t0=len*rr(.36,.44);B.push({t0,t1:t0+rr(60,90),dh:(R()<.5?-1:1)*rr(.6,.95)})}
  const step=4,n=Math.ceil(len/step),C=[];
  for(let i=0,x=0,z=0;i<=n;i++){const t=Math.min(i*step,len);let h=0;for(const b of B)h+=b.dh*sstep(b.t0,b.t1,t);C.push({x,z,t,h});const ds=clamp(len-i*step,0,step);x+=MM.sin(h)*ds;z+=MM.cos(h)*ds}
  if(GATE_K>0&&!noWind){R=mulberry32(thash(seed,idx+7000,GATE_K));rr=(a,b)=>a+R()*(b-a)}const g=C[n],gR=(par===3?rr(9,13):A.drivable?rr(9,11):rr(11,15))*(ST?ST.gr:1),fwK=ST?ST.fw:1;
  const hw=t=>((par===3?11:15)+4*N.n2(t*.02,7.3)-3*sstep(len-70,len,t))*fwK;
  const at=t=>{const f=clamp(t/step,0,n-1e-6),k=f|0,u=f-k,a=C[k],b=C[k+1]||a;return{x:lerp(a.x,b.x,u),z:lerp(a.z,b.z,u),h:a.h}};
  const perp=(c,o)=>({x:c.x+MM.cos(c.h)*o,z:c.z-MM.sin(c.h)*o});
  const pa=rr(0,TAU),pd=gR*rr(0,.55),pin={x:g.x+MM.sin(pa)*pd,z:g.z+MM.cos(pa)*pd,y:0};
  const BK=[],PD=[],ng0=A.drivable?2:1+(R()<.6?1:0)+(R()<.3?1:0),ng=ST?Math.max(0,ng0+Math.min(0,ST.gb)):ng0;let nfb=0;
  for(let k=0;k<ng;k++){const a=rr(0,TAU),d=gR+rr(3.5,7);BK.push({x:g.x+MM.sin(a)*d,z:g.z+MM.cos(a)*d,rx:rr(4,7),rz:rr(3,5),rot:rr(0,Math.PI),depth:rr(.5,.9)})}
  if(ST&&ST.gb>0){const a=rr(0,TAU),d=gR+rr(2.5,4);BK.push({x:g.x+MM.sin(a)*d,z:g.z+MM.cos(a)*d,rx:rr(2.2,3),rz:rr(2,2.6),rot:rr(0,Math.PI),depth:rr(1,1.3),pot:true})}
  if(par>3&&!A.drivable){const nf0=R()<.7?1:R()<.5?2:0,nf=ST?clamp(nf0+ST.fb,0,3):nf0;nfb=nf;for(let k=0;k<nf;k++){const t=rr(190,260),c=at(t),s0=R()<.5?-1:1,bd=ST&&ST.short&&B.length?B.reduce((m,b)=>Math.abs((b.t0+b.t1)/2-t)<Math.abs((m.t0+m.t1)/2-t)?b:m):null,sd=bd?(Math.sign(bd.dh)||1):s0,p=perp(c,sd*(hw(t)+rr(-3,6)));BK.push({x:p.x,z:p.z,rx:rr(6,10),rz:rr(4,6),rot:c.h+rr(-.3,.3),depth:rr(.4,.7)})}}
  if(A.front){const c=at(len*rr(.32,.52));PD.push({x:c.x+rr(-6,6),z:c.z,rx:rr(20,30),rz:rr(15,22),rot:rr(-.3,.3),depth:3,pen:'Y'})}
  if(A.island){const ro=gR+16;PD.push({x:g.x,z:g.z,rx:ro,rz:ro,rot:0,depth:3,ring:(gR+2)/ro,neckT:[len-gR-17,len-gR-1],drop:at(len-gR-22),pen:'Y'})}
  if(A.cape){const b=B[B.length-1],c=at(b.t0+45),sg=Math.sign(b.dh)||1,p=perp(c,-sg*(hw(b.t0+45)+18)),c2=at(Math.min(len-30,b.t1+40));PD.push({x:p.x,z:p.z,rx:rr(40,50),rz:rr(30,38),rot:c2.h+Math.PI/2,depth:3,pen:'R'})}
  if(A.drivable){const c=at(len-45);PD.push({x:c.x,z:c.z,rx:14,rz:10,rot:c.h+Math.PI/2,depth:3,pen:'Y'})}
  if(A.reach){const c=at(len-gR-22);PD.push({x:c.x,z:c.z,rx:26,rz:16,rot:c.h+Math.PI/2,depth:3,pen:'Y'})}
  if(!A.front&&!A.island&&!A.cape&&!A.drivable&&!A.reach&&par>3&&R()<.5*(ST?ST.side:1)){const t=len*rr(.48,.8),c=at(t),p=perp(c,(R()<.5?-1:1)*(hw(t)+rr(5,14)));PD.push({x:p.x,z:p.z,rx:rr(20,34),rz:rr(16,26),rot:rr(0,Math.PI),depth:3,pen:'R'})}
  let lane=null;if(A.lane){const a=at(110),b=at(len-70),sg=Math.sign(B[0]&&B[0].dh||1);lane={ax:a.x,az:a.z,bx:b.x,bz:b.z,hw:8};const mx=lerp(a.x,b.x,.72),mz=lerp(a.z,b.z,.72),ang=MM.atan2(b.x-a.x,b.z-a.z);PD.push({x:mx,z:mz,rx:13,rz:9,rot:ang+Math.PI/2,depth:3,pen:'Y'});lane.sg=sg}
  let ta=rr(0,TAU);const tm=rr(.012,.028)*(ST&&ST.tilt||1);if(A.gRise>0)ta=C[n].h+(ta-Math.PI)*.15;let wind={x:0,z:0,s:0,a:0},cliff=0;if(!noWind&&cv<CV_ISL){const H=courseHole(seed,cv,idx);wind=H.wind;if(CP&&CP.coast&&seaExcess(CP,H.ox,H.oz)>-60)cliff=CLIFF_TEE}
  let pins=null;if(cv>=3){const RP=mulberry32(thash(seed,idx+500,GATE_K>0&&!noWind?GATE_K:0)),rp=(a,b)=>a+RP()*(b-a),h=C[n].h,gb=BK.filter(b=>MM.hyp(b.x-g.x,b.z-g.z)<gR+9);
    const side=gb.length?MM.atan2(gb[0].x-g.x,gb[0].z-g.z):h+(RP()<.5?1:-1)*Math.PI/2,angs=[rp(0,TAU),h+Math.PI,side,h],mk=(a,dk)=>{const dd=gR*dk;return{x:g.x+MM.sin(a)*dd,z:g.z+MM.cos(a)*dd,y:0}};
    pins=[mk(angs[0],rp(0,PINS.c)),mk(angs[1]+rp(-.15,.15),PINS.t+rp(-.05,.03)),mk(angs[2]+rp(-.15,.15),PINS.t+rp(-.05,.03)),mk(angs[3]+rp(-.15,.15),PINS.t+rp(-.05,.03))]}
  return{R,rr,N,len,B,step,n,C,g,gR,hw,at,perp,pin,pins,BK,PD,nfb,ta,tm,wind,arch:A,lane,gRise:A.gRise||0,tRise:(A.tRise||0)+cliff,gBlend:A.gBlend||[-1,7],style:ST,crest:null,post:null,guard:false,gs:null,path:null,walls:null,twin:null}}
/* ---- F-060: the par-3 course — nine short holes beside the property, course kind 1; its own routing and dice, the property's biome, architect, season and greens ---- */
const PAR3C_LEN=[55,130],PAR3C_GR=[7,10],PAR3C_WATER=.3,PAR3C_WALK=[20,35],PAR3C_GAP=25,PAR3C_TRIES=24,P3C=new Map();
/* distance between segments ab and cd (0 when they cross) */
const segD=(ax,az,bx,bz,cx,cz,dx,dz)=>{const cr=(px,pz,qx,qz,rx,rz)=>(qx-px)*(rz-pz)-(qz-pz)*(rx-px),pd=(px,pz,qx,qz,rx,rz)=>{const ex=rx-qx,ez=rz-qz,u=clamp(((px-qx)*ex+(pz-qz)*ez)/(ex*ex+ez*ez||1),0,1);return MM.hyp(px-qx-ex*u,pz-qz-ez*u)};
  if(cr(ax,az,bx,bz,cx,cz)*cr(ax,az,bx,bz,dx,dz)<0&&cr(cx,cz,dx,dz,ax,az)*cr(cx,cz,dx,dz,bx,bz)<0)return 0;return Math.min(pd(ax,az,cx,cz,dx,dz),pd(bx,bz,cx,cz,dx,dz),pd(cx,cz,ax,az,bx,bz),pd(dx,dz,ax,az,bx,bz))};
const pd3=(x,z,q)=>segD(x,z,x,z,q.ox,q.oz,q.gx,q.gz);
function courseP3(seed,cv){return withMath(cv,()=>courseP3_(seed,cv))}function courseP3_(seed,cv){const k=seed+'/'+cv;let P=P3C.get(k);if(P)return P;const R=mulberry32(thash(seed,4003,cv)),rr=(a,b)=>a+R()*(b-a),M=coursePlan(seed,cv),c=courseHole(seed,cv,0)&&M.club,holes=[];
  let h=(c?c.h:0)+Math.PI+rr(-.6,.6),x=(c?c.x:0)+MM.sin(h)*60,z=(c?c.z:0)+MM.cos(h)*60;
  for(let i=0;i<9;i++){let len=Math.round(rr(PAR3C_LEN[0],PAR3C_LEN[1]));
    if(i){/* each tee a short walk from the last green; of PAR3C_TRIES turns, the first that keeps PAR3C_GAP from every earlier hole (else the roomiest) */const pg=holes[i-1];let best=null;
      for(let k=0;k<PAR3C_TRIES;k++){const walk=rr(PAR3C_WALK[0],PAR3C_WALK[1]),hh=pg.h+rr(60,150)*DEG*(R()<.5?-1:1),l=k?Math.round(rr(PAR3C_LEN[0],PAR3C_LEN[1])):len,xx=pg.gx+MM.sin(hh)*walk,zz=pg.gz+MM.cos(hh)*walk,gx=xx+MM.sin(hh)*l,gz=zz+MM.cos(hh)*l;
        let gap=pd3(gx,gz,pg);for(let q=0;q<i-1;q++)gap=Math.min(gap,segD(xx,zz,gx,gz,holes[q].ox,holes[q].oz,holes[q].gx,holes[q].gz));if(!best||gap>best.gap)best={gap,hh,xx,zz,l};if(gap>=PAR3C_GAP)break}
      h=best.hh;x=best.xx;z=best.zz;len=best.l}
    const co=MM.cos(h),sn=MM.sin(h);holes.push({i,h,ox:x,oz:z,len,gR:rr(PAR3C_GR[0],PAR3C_GR[1]),water:R()<PAR3C_WATER,nb:R()<.5?2:1,gx:x+sn*len,gz:z+co*len,d:thash(seed,i+1,3131),wind:{x:M.wind.x*co-M.wind.z*sn,z:M.wind.x*sn+M.wind.z*co,s:M.wind.s,a:MM.atan2(M.wind.x*co-M.wind.z*sn,M.wind.x*sn+M.wind.z*co)}})}
  P={holes};P3C.set(k,P);return P}
function holePlanP3(seed,idx,cv){return withMath(cv,()=>holePlanP3_(seed,idx,cv))}function holePlanP3_(seed,idx,cv){const H=courseP3(seed,cv).holes[idx],R=mulberry32(H.d),rr=(a,b)=>a+R()*(b-a),N=makeNoise(mulberry32(H.d^0x5bd1e995)),len=H.len,C=[];for(let t=0;t<len;t+=4)C.push({x:0,z:t,t,h:0});C.push({x:0,z:len,t:len,h:0});
  const g={x:0,z:len,h:0},gR=H.gR,BK=[],PD=[],a0=rr(0,TAU);for(let b=0;b<H.nb;b++){const a=a0+b*rr(1.6,2.6),d=gR+rr(2.5,5);BK.push({x:MM.sin(a)*d,z:len+MM.cos(a)*d,rx:rr(3,5),rz:rr(2.2,3.5),rot:rr(0,Math.PI),depth:rr(.5,.9)})}
  if(H.water){const d=rr(gR+7,gR+15),rz=rr(4.5,7);PD.push({x:rr(-4,4),z:Math.max(rz+14,len-d),rx:rr(8,13),rz,rot:rr(-.3,.3),depth:3,pen:'Y'})}
  const mk=(a,k)=>({x:MM.sin(a)*gR*k,z:len+MM.cos(a)*gR*k,y:0}),pins=[mk(rr(0,TAU),rr(0,PINS.c)),mk(Math.PI+rr(-.3,.3),PINS.t),mk(rr(0,TAU),PINS.t),mk(rr(-.3,.3),PINS.t)];
  return{R,rr,N,len,B:[],step:4,n:C.length-1,C,g,gR,hw:()=>6,at:t=>({x:0,z:clamp(t,0,len),h:0}),perp:(c,o)=>({x:c.x+o,z:c.z}),pin:pins[0],pins,BK,PD,nfb:0,ta:rr(0,TAU),tm:rr(.006,.016),wind:H.wind,arch:{n:'Short hole'},lane:null,gRise:0,tRise:0,gBlend:[-1,5],p3:true}}
/* F-053/F-054: the round's season and green speed; F-055 wear level. Version 4 bakes them into the hole's firmness arrays */
const courseSeason=seed=>(thash(seed,6007)>>>0)%4;
function stimpFor(seed,cv,se){const P=coursePlan(seed,cv),s=STIMP_BASE[biomeOf(seed,cv)]+STIMP_SEASON[se]+(STIMP_WEATHER[P.wea.n]||0)+((thash(seed,4001,se)>>>0)/4294967296*2-1)*STIMP_DAY;return Math.round(clamp(s,STIMP_CLAMP[0],STIMP_CLAMP[1])*10)/10}
function cond4(W,BI,cond,sea,plan){const P=coursePlan(W.seed,W.cv),se=clamp(cond&&cond.season|0,0,3),SE=SEASONS[se];W.season=se;W.wear=clamp(cond&&cond.wear|0,0,3);W.stimp=stimpFor(W.seed,W.cv,se);W.air=BI.alpine?AIR_ALPINE:1;W.style=P.style;W.architect=P.architect;
  const k=BI.roll*SE.roll,b=BI.bf*SE.bf,rain=!!P.wea.rain;W.rk=[k,1,k,k,STIMP_REF/W.stimp/(rain?RAIN.roll:1),k,1,1,1,1];W.bk=[b,1,b,b,1-(1-b)*SE.firm,b,1,1,1,1];
  if(sea){W.sea=sea.lvl;W.levels.push(sea.lvl)}W.pot=plan.BK.filter(b=>b.pot).length;W.stakes=stakesFor(W)}
/* F-048: yellow and red stakes along every water edge, STAKE_GAP apart; the sea is red */
const pondPen=(W,p)=>p>=W.PD.length?'R':(W.PD[p].pen||'R');
function stakesFor(W){const out=[],{cols,rows,ty,pond}=W;for(let j=1;j<rows-1;j++)for(let i=1;i<cols-1;i++){const c=j*cols+i;if(ty[c]===7)continue;let p=-1;for(const d of[1,-1,cols,-cols])if(ty[c+d]===7){p=pond[c+d];break}if(p<0)continue;
    const x=W.ox+(i+.5)*CS,z=W.oz+(j+.5)*CS;if(out.some(q=>MM.hyp(q[0]-x,q[1]-z)<STAKE_GAP))continue;out.push([x,z,pondPen(W,p)])}return out}
const TYPICAL={3:160,4:365,5:495};
function holeDifficulty(seed,idx,par,cv=0){const p=holePlan(seed,idx,par,cv);const A=p.arch||{};return p.len-TYPICAL[par]+25*p.PD.length+8*p.nfb+3*p.wind.s+(A.island?15:0)+(A.gRise?10:0)+(A.cape?10:0)+(cv>=7?diff7(p):0)}
function strokeIndex(seed,pars,cv=0){if(cv>=4&&pars.length===18){/* F-057: odd indexes on the front nine, even on the back, each ranked within its nine */const si=new Array(18);for(const nine of[0,1]){const d=[];for(let i=nine*9;i<nine*9+9;i++)d.push({i,d:holeDifficulty(seed,cv>=CV_ISL?islJ(S,i):i,pars[i],cv)});d.sort((a,b)=>b.d-a.d||a.i-b.i);d.forEach((e,r)=>si[e.i]=2*r+1+nine)}return si}
  const d=pars.map((par,i)=>({i,d:holeDifficulty(seed,cv>=CV_ISL?islJ(S,i):i,par,cv)}));d.sort((a,b)=>b.d-a.d||a.i-b.i);const si=new Array(pars.length);d.forEach((e,r)=>si[e.i]=r+1);return si}
/* a hole's grid: its centreline, ponds, green and lane, plus the out-of-bounds margin (shrunk on huge holes) */
function gridOf(plan){const{C,hw,PD,g,gR,lane}=plan;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;const ext=(x,z,r)=>{x0=Math.min(x0,x-r);x1=Math.max(x1,x+r);z0=Math.min(z0,z-r);z1=Math.max(z1,z+r)};
  for(const c of C)ext(c.x,c.z,hw(c.t)+2);for(const p of PD)ext(p.x,p.z,Math.max(p.rx,p.rz)+4);ext(g.x,g.z,gR+8);if(plan.twin)ext(plan.twin.x,plan.twin.z,plan.twin.r+6);if(plan.path)for(const q of plan.path.pts)ext(q.x,q.z,3);if(lane){ext(lane.ax,lane.az,lane.hw+6);ext(lane.bx,lane.bz,lane.hw+6)}
  let ms=64;while(ms>36&&Math.ceil((x1-x0+2*ms)/CS)*Math.ceil((z1-z0+80)/CS)>46000)ms-=4;return{ox:x0-ms,oz:z0-30,cols:Math.ceil((x1-x0+2*ms)/CS),rows:Math.ceil((z1-z0+80)/CS)}}
function genHole(seed,idx,par,cv=0,setup=0,cond=S){return withMath(cv,()=>{const w=cond&&cond.real?realHole(seed,idx,par,cv,setup,cond):cv>=CV_ISL?islGenHole(seed,idx,par,cv,setup,cond):genHole_(seed,idx,par,cv,setup,cond);w.M=mathFor(cv);w.v10=!!(cond&&cond.v10);w.R=rulesFor(cv,w.v10);w.key=holeKey(seed,idx,cv,setup,cond);if(K.rb.length)for(const h of wRules(w).hooks['hole:setup'])h.fn(w,cond);return w})}const holeKey=(seed,h,cv,setup,c)=>[seed,h,cv,cv>=3?setup|0:0,cv>=4&&c?c.season|0:0,cv>=4&&c?c.wear|0:0,cv>=4&&c?c.kind|0:0,cv>=7&&c?c.twist|0:0].join('/')+(cv>=CV_ISL&&c?'/d'+(c.islDay|0):'')+(c&&c.v10?'/v10':'')+(c&&c.real?'/r'+c.real:''),holeIs=(W,h)=>!!W&&W.key===holeKey(S.seed,h,S.cv,S.setup,S);let CALCV=-1;function genHole_(seed,idx,par,cv=0,setup=0,cond=S){
  const bio=biomeOf(seed,cv),BI=BIOMES[bio],plan=cond&&cond.range?rangePlan(seed,cv):cv>=4&&cond&&cond.kind===1?holePlanP3(seed,idx,cv):holePlan(seed,idx,par,cv),{R,rr,N,len,step,n,C,g,gR,hw,pin,BK,PD,ta,tm,wind}=plan,lane=plan.lane,gB=plan.gBlend||[-1,7],gRise=plan.gRise||0,tRise=plan.tRise||0;
  const ed=(e,x,z)=>{if(e.cr===undefined){e.cr=MM.cos(e.rot);e.sr=MM.sin(e.rot)}const dx=x-e.x,dz=z-e.z,c=e.cr,s=e.sr,u=(dx*c+dz*s)/e.rx,v=(dz*c-dx*s)/e.rz;return Math.sqrt(u*u+v*v)};
  const laneD=lane?(x,z)=>{const ex=lane.bx-lane.ax,ez=lane.bz-lane.az,l2=ex*ex+ez*ez||1,u=clamp(((x-lane.ax)*ex+(z-lane.az)*ez)/l2,0,1);return MM.hyp(x-lane.ax-ex*u,z-lane.az-ez*u)}:null;
  const pondDep=(p,e,q)=>{if(!p.ring)return e<1.5?p.depth*(1-sstep(.45,1.5,e)):0;if(q&&q.t>p.neckT[0]&&q.t<p.neckT[1]&&q.d<4)return 0;return e<1.5?p.depth*sstep(p.ring-.15,p.ring,e)*(1-sstep(1,1.5,e)):0};
  const{ox,oz,cols,rows}=gridOf(plan),s=cols+1;
  const NQ={t:0,d:0},ordZ=Array.from({length:n+1},(_,i)=>i).sort((a,b)=>C[a].z-C[b].z||a-b),zs=ordZ.map(i=>C[i].z);let lastBi=0;
  const near=(x,z)=>{let bi=lastBi;{const c=C[bi],dx=x-c.x,dz=z-c.z;var bd=dx*dx+dz*dz}let lo=0,hi=n+1;while(lo<hi){const m=(lo+hi)>>1;if(zs[m]<z)lo=m+1;else hi=m}
    for(let p=lo;p<=n;p++){const k=ordZ[p],c=C[k],dz=z-c.z;if(dz*dz>bd)break;const dx=x-c.x,d=dx*dx+dz*dz;if(d<bd||(d===bd&&k<bi)){bd=d;bi=k}}
    for(let p=lo-1;p>=0;p--){const k=ordZ[p],c=C[k],dz=z-c.z;if(dz*dz>bd)break;const dx=x-c.x,d=dx*dx+dz*dz;if(d<bd||(d===bd&&k<bi)){bd=d;bi=k}}lastBi=bi;
    let bt=C[bi].t,bdist=Math.sqrt(bd);
    for(let k=bi-1;k<=bi;k++){if(k<0||k+1>n)continue;const a=C[k],b=C[k+1],ex=b.x-a.x,ez=b.z-a.z,l2=ex*ex+ez*ez||1,u=clamp(((x-a.x)*ex+(z-a.z)*ez)/l2,0,1),d=MM.hyp(x-a.x-ex*u,z-a.z-ez*u);if(d<bdist){bdist=d;bt=a.t+(b.t-a.t)*u}}
    NQ.t=bt;NQ.d=bdist;return NQ};
  const IW8=cv>=CV_ISL&&!plan.range?islWorld(seed,idx):null,hb=IW8?IW8.hb:plan.range?()=>0:(x,z)=>N.fbm(x*.0055+3.1,z*.0055+7.7,2)*4.2*BI.hills,hd=IW8?IW8.hd:plan.range?()=>0:(x,z)=>N.fbm(x*.04+11,z*.04+5,3)*1.1*BI.detail;
  const gBase=hb(g.x,g.z)+.6+gRise,tBase=hb(0,0)+.3+tRise,tx=MM.sin(ta)*tm,tz=MM.cos(ta)*tm,island=PD.some(p=>p.ring);
  const height=(x,z,q,noPond)=>{
    const w=hw(q.t),fw=(q.t>-8&&q.t<len)?1-sstep(w-2,w+16,q.d):0,lf=laneD?1-sstep(lane.hw-2,lane.hw+10,laneD(x,z)):0;
    let h=hb(x,z)+hd(x,z)*(1-.85*Math.max(fw,lf))+(plan.crest?crestH(plan,q.t):0);
    const dg=MM.hyp(x-g.x,z-g.z);let gf=1-sstep(gR+gB[0],gR+gB[1],dg);if(plan.twin)gf=Math.max(gf,1-sstep(plan.twin.r+gB[0],plan.twin.r+gB[1],MM.hyp(x-plan.twin.x,z-plan.twin.z)));
    if(gf>0&&!island)h=lerp(h,gBase+(x-g.x)*tx+(z-g.z)*tz+N.fbm(x*.11+2,z*.11+9,2)*.13+(plan.gs?plan.gs.f(x,z):0),gf);
    const dt=Math.max(Math.abs(x)-3,Math.abs(z)-5,0),tf=1-sstep(0,5,dt);if(tf>0)h=lerp(h,tBase,tf);
    for(const b of BK){const e=ed(b,x,z);if(e<1.9)h-=bunkerDep(b,e,x,z)}
    if(!noPond)for(const p of PD)h-=pondDep(p,ed(p,x,z),q);
    if(gf>0&&island)h=lerp(h,gBase+(x-g.x)*tx+(z-g.z)*tz+N.fbm(x*.11+2,z*.11+9,2)*.13+(plan.gs?plan.gs.f(x,z):0),gf);
    return h};
  for(const p of PD){let mn=1e9;const c=MM.cos(p.rot),sn=MM.sin(p.rot);for(let k=0;k<48;k++){const a=k/48*TAU;for(const e of[1,1.25,1.5]){const u=MM.cos(a)*e,v=MM.sin(a)*e,x=p.x+u*p.rx*c-v*p.rz*sn,z=p.z+u*p.rx*sn+v*p.rz*c;mn=Math.min(mn,height(x,z,near(x,z),true))}}
    const hc=p.ring?mn:height(p.x,p.z,near(p.x,p.z),true);p.level=Math.min(hc-.5,mn-.35);p.depth=Math.max(1.5,hc-p.level+2.5)}if(cv>=7)pondLevels7(PD,ed);
  const nv=s*(rows+1),H=new Float32Array(nv),tV=new Float32Array(nv),dV=new Float32Array(nv);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const k=j*s+i,x=ox+i*CS,z=oz+j*CS,q=near(x,z);tV[k]=q.t;dV[k]=q.d;H[k]=height(x,z,q,false)}
  let sea=null;if(cv>=4&&(BI.coast||cv>=CV_ISL)&&!plan.range&&!plan.p3){/* F-059: cells beyond the coastline drop CLIFF_H into the sea; never within reach of the green or the tee */const CPc=coursePlan(seed,cv),Hh=courseHole(seed,cv,idx),c0=MM.cos(Hh.h),s0=MM.sin(Hh.h),SE=new Float32Array(nv);let lm=1e9;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const k=j*s+i,x=ox+i*CS,z=oz+j*CS;let e=seaExcess(CPc,Hh.ox+x*c0+z*s0,Hh.oz-x*s0+z*c0);if(MM.hyp(x-g.x,z-g.z)<gR+22||MM.hyp(x,z)<28)e=Math.min(e,-.01);SE[k]=e;if(e<=0&&e>-20&&H[k]<lm)lm=H[k]}
    if(lm<1e8){const lvl=lm-CLIFF_H;for(let k=0;k<nv;k++)if(SE[k]>0)H[k]=Math.min(H[k],lvl-3-Math.min(6,SE[k]*.06));sea={lvl,SE}}}
  const nc=cols*rows,ty=new Uint8Array(nc),pond=new Int8Array(nc).fill(-1),diag=new Uint8Array(nc),tC=new Float32Array(nc),dC=new Float32Array(nc),PM=cv>=7?pathMask(plan,ox,oz,cols,rows):null,bridge=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i,k=j*s+i,x=ox+(i+.5)*CS,z=oz+(j+.5)*CS;
    const t=(tV[k]+tV[k+1]+tV[k+s]+tV[k+s+1])*.25,d=(dV[k]+dV[k+1]+dV[k+s]+dV[k+s+1])*.25;tC[c]=t;dC[c]=d;
    const h00=H[k],h10=H[k+1],h01=H[k+s],h11=H[k+s+1];diag[c]=Math.abs(h00-h11)<=Math.abs(h10-h01)?0:1;
    const hc=(h00+h10+h01+h11)*.25,w=hw(t),dg=MM.hyp(x-g.x,z-g.z);let T=BI.waste&&d>w+2.5?8:0;
    if(d>w+BI.dm&&N.n2(x*.03+1,z*.03+2)>BI.dt)T=1;
    if(t>-4&&t<len-gR*.6&&d<w)T=2;if(laneD&&laneD(x,z)<lane.hw)T=2;
    if(plan.guard&&T<2&&dg>=gR+TUNE.DRIVE_ROUGH0&&dg<=gR+TUNE.DRIVE_ROUGH1)T=1;if(plan.twin){const d2=MM.hyp(x-plan.twin.x,z-plan.twin.z);if(d2<plan.twin.r+2.6)T=3;if(d2<plan.twin.r)T=4}
    if(dg<gR+2.6)T=3;if(dg<gR)T=4;
    if(Math.abs(x)<3.2&&Math.abs(z)<5.2)T=5;
    for(const b of BK){if(T===4)continue;const e=ed(b,x,z);if(bunkerSand(b,e,x,z))T=b.waste?8:6}
    PD.forEach((p,pi)=>{const e=ed(p,x,z);if(e<1.5&&(!p.ring||e>p.ring-.15)){pond[c]=pi;if(hc<p.level-.05&&pondDep(p,e,{t,d})>0)T=7}});
    if(sea&&(sea.SE[k]+sea.SE[k+1]+sea.SE[k+s]+sea.SE[k+s+1])*.25>-3){pond[c]=PD.length;if(hc<sea.lvl-.05)T=7}
    if(PM&&PM[c]&&T!==4&&T!==5&&T!==6&&T!==3){if(T===7){const pi=pond[c],lv=pi>=0&&pi<PD.length?PD[pi].level:sea?sea.lvl:hc;bridge.push(k,lv)}T=9}
    ty[c]=T}
  for(let q=0;q<bridge.length;q+=2){const k=bridge[q],lv=bridge[q+1]+TUNE.BRIDGE_H;for(const kk of[k,k+1,k+s,k+s+1])if(H[kk]<lv)H[kk]=lv}
  const W={seed,idx,par,cv,bio,len,cols,rows,ox,oz,H,ty,pond,diag,tC,dC,levels:PD.map(p=>p.level),pin,green:{x:g.x,z:g.z,r:gR,h:g.h},C,hw,hb,N,BK,PD,ed,arch:plan.arch,trees:[],tgrid:new Map(),meshes:{},crest:plan.crest||null,post:plan.post||null,gs:plan.gs||null,twin:plan.twin?Object.assign({},plan.twin):null,obs:[],bridge:bridge.length>0,
    rk:bio?firmArr(BI.roll,cv):ONES,bk:bio?firmArr(BI.bf,cv):ONES,pal:BI.pal,fog:BI.fog,sky:BI.sky,hillCols:BI.hillCols,ringCol:BI.ringCol,waterCol:BI.waterCol};
  if(cv>=4)cond4(W,BI,cond,sea,plan);
  if(plan.pins){const ok=p=>{terrainAt(W,p.x,p.z);if(TQ.ty!==4||TQ.ny<MM.cos(PINS.slope))return false;for(let a=0;a<TAU-.01;a+=TAU/6){terrainAt(W,p.x+MM.sin(a)*PINS.edge,p.z+MM.cos(a)*PINS.edge);if(TQ.ty!==4&&TQ.ty!==3)return false}return true};
    W.pins=plan.pins.map((p,i)=>{const q=i&&!ok(p)?{x:plan.pins[0].x,z:plan.pins[0].z,y:0}:{x:p.x,z:p.z,y:0};terrainAt(W,q.x,q.z);q.y=TQ.h;return q});W.setup=clamp(setup|0,0,3);W.pin=W.pins[W.setup];W.flagCol=[[.95,.95,.95],[.95,.8,.15],[.2,.45,.95],[.92,.16,.16]][W.setup]}
  terrainAt(W,W.pin.x,W.pin.z);W.pin.y=TQ.h;W.wind=cv>=CV_ISL?islWindLocal(seed,cv,idx):cv>=7&&cond&&cond.twist===2?gale5(wind):wind;W.swell=cv>=3?coursePlan(seed,cv).swell:0;W.phase=cv>=3?thash(seed,idx+900)/4294967296*TAU:0;W.rain=cv>=3&&!!coursePlan(seed,cv).wea.rain;W.marks=[];{let lo=1e9;for(let q=0;q<H.length;q+=7)if(H[q]<lo)lo=H[q];W.hlow=lo}
  W.laneD=laneD;if(cv>=7){W.obs=obstacles7(W,plan);if(W.twin&&W.twin.pins)W.twin.pin=W.twin.pins[W.setup|0]||W.twin.pins[0];W.hist=courseHistory(seed,cv)}if(bio){plantBiome(W,BI,R,rr,g,gR);return W}
  const cand=[];let psum=0;
  for(let j=2;j<rows-2;j++)for(let i=2;i<cols-2;i++){const c=j*cols+i;if(ty[c]>1)continue;const x=ox+(i+.5)*CS,z=oz+(j+.5)*CS;
    if(dC[c]<hw(tC[c])+9||MM.hyp(x-g.x,z-g.z)<gR+13||MM.hyp(x,z)<14)continue;
    let ok=true;for(const e of BK)if(ed(e,x,z)<1.6)ok=false;for(const e of PD)if(ed(e,x,z)<1.7)ok=false;if(!ok)continue;
    const p=.09*sstep(0,.45,N.n2(x*.017+5,z*.017+1))+.005;cand.push(x,z,p);psum+=p}
  const scale=Math.min(1,620/Math.max(1,psum));
  for(let k=0;k<cand.length;k+=3){if(R()>cand[k+2]*scale)continue;const px=cand[k]+rr(-.8,.8),pz=cand[k+1]+rr(-.8,.8);terrainAt(W,px,pz);const t=makeTree(px,pz,TQ.h-.2,R);W.trees.push(t);
    const key=(((px-ox)/8)|0)+','+(((pz-oz)/8)|0);(W.tgrid.get(key)||W.tgrid.set(key,[]).get(key)).push(t)}
  return W}
function plantBiome(W,BI,R,rr,g,gR){const{cols,rows,ox,oz,ty,dC,tC,hw,N,BK,PD,ed}=W,cand=[];let psum=0;
  for(let j=2;j<rows-2;j++)for(let i=2;i<cols-2;i++){const c=j*cols+i,T=ty[c];if(T>1&&T!==8)continue;const x=ox+(i+.5)*CS,z=oz+(j+.5)*CS;
    if(dC[c]<hw(tC[c])+BI.gap||MM.hyp(x-g.x,z-g.z)<gR+10||MM.hyp(x,z)<12||(W.laneD&&W.laneD(x,z)<12))continue;
    let ok=true;for(const e of BK)if(ed(e,x,z)<1.6)ok=false;for(const e of PD)if(ed(e,x,z)<1.7)ok=false;if(!ok)continue;
    const p=(.09*sstep(0,.45,N.n2(x*.017+5,z*.017+1))+.005)*BI.trees;cand.push(x,z,p);psum+=p}
  const scale=Math.min(1,620*BI.trees/Math.max(1,psum));
  for(let k=0;k<cand.length;k+=3){if(R()>cand[k+2]*scale)continue;const px=cand[k]+rr(-.8,.8),pz=cand[k+1]+rr(-.8,.8);terrainAt(W,px,pz);let u=R(),kind=BI.kinds[0][0];for(const[kk,w]of BI.kinds){if(u<w){kind=kk;break}u-=w}
    const t=makeProp(kind,px,pz,TQ.h-.2,R,BI);W.trees.push(t);const key=(((px-ox)/8)|0)+','+(((pz-oz)/8)|0);(W.tgrid.get(key)||W.tgrid.set(key,[]).get(key)).push(t)}}
function makeProp(kind,x,z,y,R,BI){const rr=(a,b)=>a+R()*(b-a),s=rr(.8,1.4),t={x,z,y,cs:[],boxes:[],kind},trunk=[.36,.24,.14],vary=c=>c.map(v=>v*rr(.88,1.12));
  if(kind==='pine'){t.th=3.2*s;t.tr=.3*s;const b=BI.pine||[.18,.44,.22],c=[b[0]+R()*.05,b[1]+R()*.08,b[2]];t.boxes.push([x,y+t.th/2,z,.26*s,t.th/2,.26*s,trunk]);
    let yy=y+t.th;for(const w of[2.2,1.7,1.2]){const ww=w*s;t.boxes.push([x,yy+ww*.9,z,ww,ww*.9,ww,vary(c)]);t.cs.push({x,y:yy+ww*.9,z,r:ww*1.2});yy+=ww*1.35}}
  else if(kind==='oak'){t.th=3.4*s;t.tr=.36*s;const c=R()<(BI.autumn||0)?(R()<.5?[.85,.55,.18]:[.78,.30,.14]):[.26+R()*.08,.54+R()*.1,.22];t.boxes.push([x,y+t.th/2,z,.34*s,t.th/2,.34*s,trunk]);
    const cy=y+t.th+1.6*s;t.boxes.push([x,cy,z,2.3*s,2*s,2.3*s,c]);t.cs.push({x,y:cy,z,r:2.7*s});
    for(let k=0;k<3;k++){const a=R()*TAU,d=1.7*s,bx=x+MM.sin(a)*d,by=cy+rr(-.6,1.2)*s,bz=z+MM.cos(a)*d,hs=1.5*s;t.boxes.push([bx,by,bz,hs,hs*.9,hs,vary(c)]);t.cs.push({x:bx,y:by,z:bz,r:hs*1.15})}}
  else if(kind==='gorse'){const w=rr(.8,1.4),h=rr(.45,.75);t.th=h*2;t.tr=w*.8;t.boxes.push([x,y+h,z,w,h,w*rr(.8,1.1),vary([.30,.42,.16])]);
    for(let k=0;k<5;k++){const a=R()*TAU,d=w*rr(.3,.8);t.boxes.push([x+MM.sin(a)*d,y+h*2+.05,z+MM.cos(a)*d,.12,.1,.12,[1,.84,.22]])}t.cs.push({x,y:y+h,z,r:w*1.05})}
  else{const h=rr(3,6),r=.32*rr(.9,1.2),c=vary([.27,.50,.30]);t.th=h;t.tr=r+.05;t.boxes.push([x,y+h/2,z,r,h/2,r,c]);t.boxes.push([x,y+h+.08,z,r*.8,.08,r*.8,c]);
    const na=R()<.3?0:R()<.55?1:2;for(let k=0;k<na;k++){const sd=k?-1:(R()<.5?1:-1),ax=R()<.5,ay=y+h*rr(.35,.6),L=rr(.7,1.2),ex=ax?sd:0,ez=ax?0:sd,ah=rr(.9,1.6),ar=r*.75;
      t.boxes.push([x+ex*(r+L/2),ay,z+ez*(r+L/2),ax?L/2:ar,ar,ax?ar:L/2,c]);t.boxes.push([x+ex*(r+L),ay+ah/2,z+ez*(r+L),ar,ah/2,ar,c]);t.cs.push({x:x+ex*(r+L),y:ay+ah/2,z:z+ez*(r+L),r:.55})}}
  return t}
function cellColor(W,c,x,z,out){const T=W.ty[c],S=SURF[T],t=W.tC[c],col=W.pal&&W.pal[T]||S.col;let v=1+S.var*W.N.n2(x*.31+3,z*.31+1);
  if(T===2||T===5)v*=(Math.floor(t/6)&1)?1.06:.95;else if(T===4)v*=((Math.floor(x/3)+Math.floor(z/3))&1)?1.04:.965;else if(T<2)v*=1+.06*W.N.n2(x*.09,z*.09);
  if(T===8)v*=W.N.n2(x*1.7,z*1.7)>.45?.84:1;if(W.shade)v*=W.shade[c];
  out[0]=col[0]*v;out[1]=col[1]*v;out[2]=col[2]*v;out[3]=T;if(W.cv>=4)tint4(W,c,T,x,z,out);if(W.cutK===undefined)W.cutK=W.cv>=4&&W.bio?cutKFor(W.bio,W.season|0):null;if(W.cutK&&T<=4){const q=W.cutK[T];out[0]*=q;out[1]*=q;out[2]*=q}}
/* F-053 palette by season (summer bleached rough, winter dull and frosty until 10:00), F-059 snow above SNOW_LINE, F-055 worn patches blend toward bare earth */
const STRAW=[.66,.60,.36],EARTH=[.52,.43,.30],FROST=[.84,.87,.86],SNOW=[.93,.95,.98];
function tint4(W,c,T,x,z,o){const mix=(q,k)=>{o[0]=lerp(o[0],q[0],k);o[1]=lerp(o[1],q[1],k);o[2]=lerp(o[2],q[2],k)};if(T>5&&T!==8)return;const se=W.season;
  if(se===1&&T<=1)mix(STRAW,.35);else if(se===1&&T!==4)mix(STRAW,.1);else if(se===2&&T<=1)mix([.56,.46,.26],.18);else if(se===3&&T<=5){const l=(o[0]+o[1]+o[2])/3;mix([l,l,l],.22);o[0]*=.95;o[1]*=.95;o[2]*=.95;const fr=W.clock!=null?1-sstep(9,10,W.clock):0;if(fr>0)mix(FROST,.26*fr)}
  if(BIOMES[W.bio].alpine&&T<=1&&W.H){const k=(c/W.cols|0)*(W.cols+1)+c%W.cols;if(W.H[k]>W.hlow+SNOW_LINE)mix(SNOW,.85)}
  if(W.wear&&T<=3&&wearKind(c,T,x,z)===2)mix(EARTH,.4)}
function buildHills(W){if(W.cv>=CV_ISL)return{n:0};const cx=W.ox+W.cols*CS/2,cz=W.oz+W.rows*CS/2,N=W.N,mb=new MB(2*80*30);
  const hc=W.hillCols||[[.42,.52,.58],[.34,.47,.40]],sea=W.cv>=4&&W.sea!=null?seaDirLocal(W):null,alp=W.cv>=4&&BIOMES[W.bio].alpine;for(const[Rr,h0,h1,off,c]of[[1500,60,190,0,hc[0]],[1250,35,120,.5,hc[1]]])for(let i=0;i<80;i++){const a0=(i+off)/80*TAU,a1=(i+1+off)/80*TAU,am=(a0+a1)/2,h=h0+(h1-h0)*Math.min(1,Math.abs(N.n2(i*.31+off*7+2.2,off*3+.7))*1.6),R2=Rr+140;
    if(sea&&MM.cos(am-sea)>-.2)continue;const cc=alp&&h>h0+(h1-h0)*.45?[lerp(c[0],.95,.7),lerp(c[1],.96,.7),lerp(c[2],.98,.7)]:c;mb.tri(cx+MM.cos(a0)*R2,-40,cz+MM.sin(a0)*R2,cx+MM.cos(am)*Rr,h,cz+MM.sin(am)*Rr,cx+MM.cos(a1)*R2,-40,cz+MM.sin(a1)*R2,cc[0],cc[1],cc[2],0)}
  return mb.upload()}
const seaDirLocal=W=>{const P=coursePlan(W.seed,W.cv),H=courseHole(W.seed,W.cv,W.idx),c=MM.cos(H.h),s=MM.sin(H.h),C=P.isl?islNorm(P.isl,H):P.coast,lx=C.nx*c-C.nz*s,lz=C.nx*s+C.nz*c;return MM.atan2(lz,lx)};
function gpuGrid(P,I,tex,tw,th,g,Nn){const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,P,gl.STATIC_DRAW);const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,Nn,gl.STATIC_DRAW);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,I,gl.STATIC_DRAW);
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tw,th,0,gl.RGBA,gl.UNSIGNED_BYTE,tex);
  for(const[k,v]of[[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  return{grid:true,vb,nb,ib,tex:t,n:I.length,g,bytes:P.byteLength+I.byteLength+tex.byteLength+Nn.byteLength}}
// A grid of (nx+1)x(nz+1) shared vertices; cell (i,j) is drawn when keep(i,j); diag(i,j) picks the split; color(i,j,out) fills the cell's texel.
function buildGrid(nx,nz,x0,z0,S,hAt,keep,diag,color){const s=nx+1,nv=s*(nz+1);const P=new Float32Array(nv*3);for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const k=j*s+i;P[k*3]=x0+i*S;P[k*3+1]=hAt(i,j,k);P[k*3+2]=z0+j*S}
  const I=new Uint16Array(nx*nz*6),tex=new Uint8Array(nx*nz*4),col=[0,0,0,15];let o=0;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const c=j*nx+i;col[3]=15;color(i,j,col);tex[c*4]=cq(col[0]);tex[c*4+1]=cq(col[1]);tex[c*4+2]=cq(col[2]);tex[c*4+3]=col[3]*16+8;if(!keep(i,j))continue;const k=j*s+i;
    if(!diag(i,j)){I[o++]=k;I[o++]=k+1;I[o++]=k+s+1;I[o++]=k;I[o++]=k+s+1;I[o++]=k+s}else{I[o++]=k;I[o++]=k+1;I[o++]=k+s;I[o++]=k+1;I[o++]=k+s+1;I[o++]=k+s}}
  const Nn=new Int8Array(nv*4);for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const k=j*s+i,i0=Math.max(0,i-1),i1=Math.min(nx,i+1),j0=Math.max(0,j-1),j1=Math.min(nz,j+1);
    let ax=-(P[(j*s+i1)*3+1]-P[(j*s+i0)*3+1])/((i1-i0)*S),az=-(P[(j1*s+i)*3+1]-P[(j0*s+i)*3+1])/((j1-j0)*S);const l=MM.hyp(ax,1,az);Nn[k*4]=Math.round(ax/l*127);Nn[k*4+1]=Math.round(127/l);Nn[k*4+2]=Math.round(az/l*127)}
  if(S<=CS)aoBake(P,Nn,nx,nz,S);return gpuGrid(P,I.subarray(0,o),tex,nx,nz,[x0,z0,1/(nx*S),1/(nz*S)],Nn)}
function ringSpec(W){const S=40,x0=W.ox-1400,z0=W.oz-1400,nx=Math.ceil((W.cols*CS+2800)/S),nz=Math.ceil((W.rows*CS+2800)/S),ix0=W.ox+20,ix1=W.ox+W.cols*CS-20,iz0=W.oz+20,iz1=W.oz+W.rows*CS-20,rc=W.ringCol||[.27,.44,.20];
  const R={S,x0,z0,nx,nz,rc,h:(x,z)=>W.hb(x,z)-1.6,keep:(i,j)=>{const x=x0+i*S,z=z0+j*S;return!(x>=ix0&&x+S<=ix1&&z>=iz0&&z+S<=iz1)},v:(x,z)=>1+.1*W.N.n2(x*.01,z*.01)};
  if(W.cv>=4&&W.sea!=null){const P=coursePlan(W.seed,W.cv),H=courseHole(W.seed,W.cv,W.idx),c=MM.cos(H.h),s=MM.sin(H.h),wet=(x,z)=>seaExcess(P,H.ox+x*c+z*s,H.oz-x*s+z*c)>0,h0=R.h,wc=W.waterCol||[.2,.45,.7];R.h=(x,z)=>wet(x,z)?W.sea-.05:h0(x,z);R.col=(x,z,o)=>{if(wet(x,z)){o[0]=wc[0]*.9;o[1]=wc[1]*.95;o[2]=wc[2];return true}return false}}
  return R}
function buildRing(W){const R=ringSpec(W);
  if(PT&&(R.nx+1)*(R.nz+1)<65536)return buildGrid(R.nx,R.nz,R.x0,R.z0,R.S,(i,j)=>R.h(R.x0+i*R.S,R.z0+j*R.S),R.keep,()=>0,(i,j,o)=>{if(R.col&&R.col(R.x0+(i+.5)*R.S,R.z0+(j+.5)*R.S,o))return;const v=R.v(R.x0+i*R.S,R.z0+j*R.S);o[0]=R.rc[0]*v;o[1]=R.rc[1]*v;o[2]=R.rc[2]*v});
  const mb=new MB(R.nx*R.nz*60);for(let j=0;j<R.nz;j++)for(let i=0;i<R.nx;i++){if(!R.keep(i,j))continue;const x=R.x0+i*R.S,z=R.z0+j*R.S,S=R.S,h=R.h,v=R.v(x,z),r=R.rc[0]*v,g=R.rc[1]*v,b=R.rc[2]*v;
    mb.tri(x,h(x,z),z,x+S,h(x+S,z),z,x+S,h(x+S,z+S),z+S,r,g,b,0);mb.tri(x,h(x,z),z,x+S,h(x+S,z+S),z+S,x,h(x,z+S),z+S,r,g,b,0)}return mb.upload()}
function buildTerrain(W){const{cols,rows,ox,oz,H}=W,s=cols+1;
  if(PT&&s*(rows+1)<65536)return buildGrid(cols,rows,ox,oz,CS,(i,j,k)=>H[k],()=>true,(i,j)=>W.diag[j*cols+i],(i,j,o)=>cellColor(W,j*cols+i,ox+i*CS+1,oz+j*CS+1,o));
  const T=new MB(cols*rows*60),col=[0,0,0];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i,k=j*s+i,x0=ox+i*CS,z0=oz+j*CS,x1=x0+CS,z1=z0+CS,h00=H[k],h10=H[k+1],h01=H[k+s],h11=H[k+s+1];
    cellColor(W,c,x0+1,z0+1,col);const[r,g,b]=col;
    if(W.diag[c]===0){T.tri(x0,h00,z0,x1,h10,z0,x1,h11,z1,r,g,b,0);T.tri(x0,h00,z0,x1,h11,z1,x0,h01,z1,r,g,b,0)}
    else{T.tri(x0,h00,z0,x1,h10,z0,x0,h01,z1,r,g,b,0);T.tri(x1,h10,z0,x1,h11,z1,x0,h01,z1,r,g,b,0)}}
  return T.upload()}
const CLOUDS={clear:9,breezy:15,overcast:34,drift:.6};
const TEE_PAINT=[[[.13,.18,.32],[.93,.9,.82]],[[.42,.12,.14],[.93,.9,.82]],[[.9,.87,.78],[.2,.24,.2]]];/* navy, burgundy, cream: [body, cap] */
function makeClouds(W){const R=mulberry32(thash(W.seed,W.idx+77)),rr=(a,b)=>a+R()*(b-a),wea=W.wea||WEATHER[0],flat=!!wea.flat,n=flat?CLOUDS.overcast:wea.wind>1.2?CLOUDS.breezy:CLOUDS.clear,L=W.light||[1,1,1];
  const cx=W.ox+W.cols*CS/2,cz=W.oz+W.rows*CS/2,span=Math.max(W.cols,W.rows)*CS*.5+320,wx=W.wind.x||0,wz=W.wind.z||0,ws=MM.hyp(wx,wz),ux=ws>.01?wx/ws:0,uz=ws>.01?wz/ws:1,up=ws*CLOUDS.drift*360,out=[];
  const base=flat?[.70,.72,.76]:[.97,.975,1],lo=flat?[52,66]:[70,96];
  for(let q=0;q<n;q++){const ax=cx+rr(-span,span)-ux*rr(0,up),az=cz+rr(-span,span)-uz*rr(0,up),ay=rr(lo[0],lo[1]),m=rr(.8,1.6)*(flat?1.5:1),k=3+(R()*5|0);
    for(let b=0;b<k;b++){const bx=ax+rr(-9,9)*m,bz=az+rr(-7,7)*m,sx=rr(5,11)*m,sz=rr(4,9)*m,sy=rr(.9,1.8)*m,v=rr(.93,1);out.push([bx,ay+rr(-1,1.5),bz,sx,sy,sz,[base[0]*v*L[0],base[1]*v*L[1],base[2]*v*L[2]]])}}
  return out}
function buildBoxes(list){if(!PI){const mb=new MB(list.length*360+60);for(const b of list)mb.box(b[0],b[1],b[2],b[3],b[4],b[5],b[6],0);return mb.upload()}
  const n=list.length,buf=new ArrayBuffer(Math.max(1,n)*28),f=new Float32Array(buf),u8=new Uint8Array(buf);
  list.forEach((b,i)=>{const o=i*7;for(let k=0;k<6;k++)f[o+k]=b[k];const c=b[6],q=i*28+24;u8[q]=cq(c[0]);u8[q+1]=cq(c[1]);u8[q+2]=cq(c[2]);u8[q+3]=255});
  const gb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,gb);gl.bufferData(gl.ARRAY_BUFFER,u8,gl.STATIC_DRAW);return{inst:true,buf:gb,n,bytes:u8.byteLength}}
function bakeShade(W){const{cols,rows,ox,oz}=W,SU=W.sun||SUN,k=W.wea&&W.wea.flat?SHADE.flat:SHADE.k,sh=new Float32Array(cols*rows).fill(1);if(!W.trees.length||SU[1]<=0)return sh;
  const mx=SHADE.reach,ux=clamp(-SU[0]/SU[1],-mx,mx),uz=clamp(-SU[2]/SU[1],-mx,mx);
  for(const t of W.trees){const cs=t.cs.length?t.cs:[{x:t.x,y:t.y+(t.th||1),z:t.z,r:(t.tr||.5)*2}];for(const c of cs){const h=Math.max(0,c.y-t.y),cx=c.x+ux*h,cz=c.z+uz*h,r=c.r*.95,i0=Math.max(0,((cx-r-ox)/CS)|0),i1=Math.min(cols-1,((cx+r-ox)/CS)|0),j0=Math.max(0,((cz-r-oz)/CS)|0),j1=Math.min(rows-1,((cz+r-oz)/CS)|0);
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d=MM.hyp(ox+i*CS+1-cx,oz+j*CS+1-cz);if(d<r){const v=1-k*(1-sstep(r*.55,r,d)),q=j*cols+i;if(v<sh[q])sh[q]=v}}}}
  return sh}
const SHADE={k:.30,flat:.10,reach:2.2};
function buildMeshes(W){const{cols,rows,ox,oz,H,N}=W,s=cols+1,M={};W.shade=W.dio?W.shade:GFX.shadows?null:bakeShade(W);
  M.terrain=buildTerrain(W);
  let nw=0;for(let c=0;c<cols*rows;c++)if(W.pond[c]>=0)nw++;
  const Wt=new MB(nw*60+60),wc=W.waterCol||[.20,.48,.80];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i,pi=W.pond[c];if(pi<0)continue;const k=j*s+i,L=W.levels[pi];if(Math.min(H[k],H[k+1],H[k+s],H[k+s+1])>L+.02)continue;
    const x0=ox+i*CS,z0=oz+j*CS,x1=x0+CS,z1=z0+CS,wv=(x,z,h)=>{const v=1+.05*N.n2(x*.2,z*.2),sh=1-sstep(.05,1.6,L-h),fm=.65*(1-sstep(.02,FOAM_D,L-h));Wt.v(x,L,z,0,1,0,lerp(lerp(wc[0],.34,sh*.75)*v,.92,fm),lerp(lerp(wc[1],.64,sh*.75)*v,.94,fm),lerp(lerp(wc[2],.62,sh*.6)*v,.93,fm),1)};
    wv(x0,z0,H[k]);wv(x1,z0,H[k+1]);wv(x1,z1,H[k+s+1]);wv(x0,z0,H[k]);wv(x1,z1,H[k+s+1]);wv(x0,z1,H[k+s])}
  M.water=Wt.upload();
  const bx=[];for(const t of W.trees)for(const b of treeBoxes(W,t))bx.push(W.cv>=4&&!b.eg?seasonBox(W,t,b):b);const n4=bx.length;if(W.cv>=4)props4(W,bx);if(W.cv>=7)props7(W,bx);if(W.dio)dioClear(W,bx,n4);
  const w=cols*CS,l=rows*CS;for(let x=ox+1;x<ox+w;x+=14)for(const z of[oz+1,oz+l-1]){terrainAt(W,x,z);bx.push([x,TQ.h+.5,z,.09,.55,.09,[.95,.95,.9]])}
  for(let z=oz+15;z<oz+l-1;z+=14)for(const x of[ox+1,ox+w-1]){terrainAt(W,x,z);bx.push([x,TQ.h+.5,z,.09,.55,.09,[.95,.95,.9]])}
  {/* painted tee markers in a muted club colour, with a contrasting cap; the colour comes from a pure hash so it never touches the course RNG */const T=TEE_PAINT[(thash(W.seed,W.idx+501)>>>0)%TEE_PAINT.length];for(const x of[-2,2]){terrainAt(W,x,0);bx.push([x,TQ.h+.14,0,.18,.14,.18,T[0]]);bx.push([x,TQ.h+.3,0,.19,.025,.19,T[1]])}}
  M.boxes=buildBoxes(bx);if(W.dio){const D=dioBoxes(W);M.dboxes=buildBoxes(D.s);M.lboxes=buildBoxes(D.l)}M.clouds=buildBoxes(makeClouds(W));W.tLoad=S.t;
  const Cu=new MB(30*20);Cu.disc(W.pin.x,W.pin.y+.015,W.pin.z,CUP_R,20,[.04,.05,.03],0);M.cup=Cu.upload();
  const F=new MB(800),fc=W.flagCol||[.92,.16,.16],fv=(x,y)=>F.v(x,y,0,0,0,1,fc[0],fc[1],fc[2],2+(x/.92)*.98);
  F.box(0,1.15,0,.035,1.15,.035,[.95,.95,.95],0);F.box(0,2.32,0,.06,.06,.06,[1,.85,.2],0);
  fv(.04,2.25);fv(.92,2.25);fv(.92,1.72);fv(.04,2.25);fv(.92,1.72);fv(.04,1.72);if(W.cv>=3)flagPattern(F,W.setup|0);
  M.flag=F.upload();M.hills=buildHills(W);M.ring=buildRing(W);W.meshes=M}
/* autumn turns the broadleaf canopies; winter thins their colour (presentation only) */
function seasonBox(W,t,b){if(t.kind!=='oak'||b[6]===undefined||b[4]>b[3]*1.5)return b;const se=W.season;if(se!==2&&se!==3)return b;const h=(thash(Math.round(b[0]*10),Math.round(b[2]*10),7)>>>0)/4294967296,c=b.slice();
  c[6]=se===2?(h<.35?[.86,.52,.16]:h<.6?[.80,.30,.14]:h<.8?[.84,.70,.22]:b[6]):[b[6][0]*.8+.08,b[6][1]*.72+.06,b[6][2]*.8+.06];return c}
/* ---- F-059: a landmark for every biome at the property's edge. Placed from the whole routing (both nines and the par-3 course, so it clears every hole's grid) with a hash of its own — the course's dice are untouched — so it appears once the back nine has routed in idle time. Its own mesh, turned the same way from every hole. Surf and gulls on the coast. Cosmetic, never in play ---- */
const LM_C=new Map(),LM_NAMES=['ruined tower','windmill','mesa','old oak','chalet','lighthouse'],LM_SEE=900,LM_BACK=[110,120,300,100,120,0],LM_JIT=60,LM_STEP=20,LM_K=[1.5,1.4,1,1.6,1.4,1.3],LM_SHORE=16;
const holeFrame=W=>W.real?W.frame:W.arch&&W.arch.n==='Short hole'?courseP3(W.seed,W.cv).holes[W.idx]:courseHole(W.seed,W.cv,W.idx);
function landmarkOf(seed,cv){return withMath(cv,()=>landmarkOf_(seed,cv))}function landmarkOf_(seed,cv){if(cv>=CV_ISL)return islandOf(seed).lm;const k=seed+'/'+cv;if(LM_C.has(k))return LM_C.get(k);if(cv<4)return null;const P=coursePlan(seed,cv);if(P.holes.length<18)return null;
  const bio=biomeOf(seed,cv)-1,hs=[],G=[],Q=courseP3(seed,cv);for(let i=0;i<18;i++){const H=courseHole(seed,cv,i);hs.push(H);G.push([H,gridOf(holePlan(seed,i,PAR18_4[i],cv,cv<5))])}for(let i=0;i<9;i++)G.push([Q.holes[i],gridOf(holePlanP3(seed,i,cv))]);
  const B=lmBoxes(bio,0),K=LM_K[bio],clear=(x,z,a)=>{const c=MM.cos(a),s=MM.sin(a);return B.every(b=>{const r=MM.hyp(b[3],b[5])*K+6,wx=x+(c*b[0]+s*b[2])*K,wz=z+(c*b[2]-s*b[0])*K;return G.every(([H,g])=>{const[lx,lz]=fromWorld(H,wx,wz);return lx<g.ox-r||lx>g.ox+g.cols*CS+r||lz<g.oz-r||lz>g.oz+g.rows*CS+r})})};
  let cx=0,cz=0,L=null;for(const H of hs){const[gx,gz]=toWorld(H,H.g.x,H.g.z);cx+=(H.ox+gx)/36;cz+=(H.oz+gz)/36}
  if(P.coast){/* the lighthouse: on a sea stack straight out from the middle of the property, just clear of every hole */const nx=P.coast.nx,nz=P.coast.nz,a=MM.atan2(-nx,-nz);let d=0;while(d<3000&&seaExcess(P,cx+nx*d,cz+nz*d)<0)d+=4;for(let e=d+LM_SHORE;e<d+1500&&!L;e+=LM_STEP){const x=cx+nx*e,z=cz+nz*e;if(clear(x,z,a))L={x,z,a,hole:-1}}}
  else{/* beyond the green of the front-nine hole that runs furthest out, facing back up it (so nine-hole rounds see it too) */const j=(thash(seed,8182)>>>0)%LM_JIT,cand=hs.slice(0,9).map((H,i)=>{const[gx,gz]=toWorld(H,H.g.x,H.g.z),l=MM.hyp(gx-H.ox,gz-H.oz)||1,ux=(gx-H.ox)/l,uz=(gz-H.oz)/l;return{i,gx,gz,ux,uz,o:(gx-cx)*ux+(gz-cz)*uz}}).sort((p,q)=>q.o-p.o||p.i-q.i);
    for(const c of cand.slice(0,4)){const a=MM.atan2(-c.ux,-c.uz);for(let d=LM_BACK[bio]+j;d<LM_BACK[bio]+j+700&&!L;d+=LM_STEP){const x=c.gx+c.ux*d,z=c.gz+c.uz*d;if(clear(x,z,a))L={x,z,a,hole:c.i}}if(L)break}}
  if(!L)L={x:cx,z:cz,a:0,hole:-1,none:true};L.bio=bio;L.name=LM_NAMES[bio];LM_C.set(k,L);return L}
/* landmark-local boxes, +z facing the course; gy(x,z) = the ground under a local point, relative to the base, in local units */
function lmBoxes(bio,se,gy=()=>0){const S1=[.56,.54,.5],D=[.2,.18,.16],W1=[.92,.9,.86],R1=[.8,.16,.12],G1=[.6,.62,.65],B=[];const b=(x,y,z,hx,hy,hz,c)=>B.push([x,y,z,hx,hy,hz,c]);
  if(bio===0){b(0,2,0,3.2,6,3.2,S1);b(0,11,0,3,3,3,S1);b(-1.2,15.5,0,1.8,1.5,3,S1);b(1.6,16.2,-1.4,1.4,2.2,1.6,S1);b(0,1.5,3.22,.7,1.5,.05,D);b(0,10,3.02,.4,.7,.05,D);b(4.5,.6,2,1.2,.6,1,S1);b(-4,.4,-3,.9,.4,1.3,S1)}
  else if(bio===1){b(0,3,0,3,7,3,W1);b(0,11.5,0,2.3,1.5,2.3,W1);b(0,13.8,0,2.6,.8,2.8,[.32,.22,.18]);b(0,13,3,.45,.45,.5,D);b(0,13,3.5,.5,6.2,.08,[.78,.7,.55]);b(0,13,3.5,6.2,.5,.08,[.78,.7,.55]);b(0,1.4,3.02,.6,1.4,.05,D)}
  else if(bio===2){b(0,9,0,60,21,35,[.72,.42,.28]);b(10,34,-5,42,6,26,[.76,.47,.31]);b(-25,26,10,20,6,15,[.68,.4,.27]);b(40,14,20,12,20,10,[.7,.44,.3])}
  else if(bio===3){const c=se===2?[.78,.46,.16]:se===3?[.42,.35,.27]:[.24,.45,.2],c2=c.map(v=>v*.86),k=se===3?.6:1,T=[.36,.24,.14];b(0,4,0,1.6,8,1.6,T);b(2.6,10.5,0,2.4,.7,.7,T);b(-2.4,11,.8,2.2,.6,.6,T);
    b(0,14.5,0,10*k,3*k,9*k,c);b(0,18.5,0,8*k,2.5*k,7.5*k,c2);b(0,21.5,0,5*k,1.8*k,5*k,c);b(7.5*k,13.5,4*k,4*k,2.5*k,4*k,c2);b(-7.5*k,14,-3*k,4.5*k,3*k,4*k,c);b(2*k,13,-7.5*k,4*k,2*k,3*k,c2)}
  else if(bio===4){const P=[.35,.2,.15];b(0,1,0,6,5,4.5,[.5,.33,.2]);b(0,3.4,4.9,6.2,.15,.6,[.4,.26,.16]);b(0,6.6,0,6.8,.6,5.2,P);b(0,7.6,0,5.2,.5,5.2,P);b(0,8.5,0,3.6,.5,5.2,P);b(0,9.3,0,2,.4,5.2,P);b(2.5,4,4.52,.8,.7,.05,[.95,.85,.55]);b(-2.5,4,4.52,.8,.7,.05,[.95,.85,.55]);
    /* the cable car climbs away from the course: a straight cable from the roof to a top station on the ground, pylons standing on the ground below it */
    const n=5,sp=26,e=-sp*n,ge=gy(0,e),top=Math.max(ge,4)+9,cy=t=>lerp(10,top,t/(sp*n));for(let i=1;i<n;i++){const z=-sp*i,h=cy(sp*i),g=gy(0,z)-2;if(h>g+3){b(0,(h+g)/2,z,.35,(h-g)/2,.35,G1);b(0,h,z,1.6,.2,.3,G1)}}
    for(let t=6;t<sp*n;t+=12)b(0,cy(t)+.1,-t,.08,.08,6.1,[.2,.2,.22]);for(const t of[1.5,3.5])b(0,cy(sp*t)-2.3,-sp*t,1.1,1.3,1.5,R1);b(0,(top+ge-3)/2+.5,e-5,4.5,(top-ge+3)/2+.5,4.5,[.46,.3,.2]);b(0,top+1.3,e-5,5.2,.4,5.2,P)}
  else{b(0,-5,0,6,5,5.5,[.42,.4,.38]);b(1.8,-3,-2.2,4.2,4,4,[.36,.34,.32]);b(0,1.2,0,3,1.2,3,S1);for(let k=0;k<6;k++){const w=2.3-.12*k;b(0,5.6+3.2*k,0,w,1.6,w,k%2?R1:[.95,.95,.93])}b(0,24.6,0,2.5,.2,2.5,D);b(0,25.8,0,1.2,1,1.2,[1,.92,.55]);b(0,27.2,0,1.4,.4,1.4,[.6,.12,.1])}return B}
/* the landmark's mesh for this hole: null = the routing isn't finished yet, 0 = none from here */
function lmMesh(W){if(W.cv<4||W.real||(W.arch&&W.arch.n==='Range'))return 0;const L=landmarkOf(W.seed,W.cv);if(!L)return null;if(L.none)return 0;
  const H=holeFrame(W),[lx,lz]=fromWorld(H,L.x,L.z);if(Math.min(MM.hyp(lx,lz),MM.hyp(lx-W.green.x,lz-W.green.z))>LM_SEE+(L.bio===2?500:0))return 0;
  const R=ringSpec(W),K=LM_K[L.bio],a=L.a-H.h,c=MM.cos(a),s=MM.sin(a),rh=(x,z)=>{/* the ring as drawn: bilinear on its lattice */const u=(x-R.x0)/R.S,v=(z-R.z0)/R.S,i=Math.floor(u),j=Math.floor(v),X=R.x0+i*R.S,Z=R.z0+j*R.S;return lerp(lerp(R.h(X,Z),R.h(X+R.S,Z),u-i),lerp(R.h(X,Z+R.S),R.h(X+R.S,Z+R.S),u-i),v-j)};
  let y0=rh(lx,lz);if(L.bio===5&&W.sea!=null)y0=Math.max(y0,W.sea+CLIFF_H);
  const B=lmBoxes(L.bio,W.season,(px,pz)=>(rh(lx+(c*px+s*pz)*K,lz+(c*pz-s*px)*K)-y0)/K),m=new MB(B.length*360+10);for(const e of B)m.box(e[0],e[1],e[2],e[3],e[4],e[5],e[6],0);
  const o=m.upload();o.x=M4.trs(lx,y0,lz,K,a);return o}
function lmDraw(M){if(M.lm===0)return;if(!M.lm){if(S.t<(M.lmT||0))return;M.lmT=S.t+.3;const o=lmMesh(W);if(o===null)return;M.lm=o;if(!o)return}useProg(PS,A);draw(M.lm,M.lm.x)}
function seaFoam(W,bx){if(W.cv<4||W.sea==null)return;const{cols,rows,ty,ox,oz}=W,si=W.PD.length;for(let j=1;j<rows-1;j++)for(let i=1;i<cols-1;i++){const c=j*cols+i;if(ty[c]!==7||W.pond[c]!==si)continue;if(ty[c-1]!==7||ty[c+1]!==7||ty[c-cols]!==7||ty[c+cols]!==7)bx.push([ox+(i+.5)*CS,W.sea+.05,oz+(j+.5)*CS,1.05,.04,1.05,[.93,.96,1]])}}
function props4(W,bx){seaFoam(W,bx);islClueProps(W,bx);if(W.arch&&W.arch.n==='Range'){for(const f of RANGE_FLAGS){const x=flagX(f),d=f+RANGE_MAT;terrainAt(W,x,d);bx.push([x,TQ.h+1.3,d,.04,1.3,.04,[.95,.95,.95]]);bx.push([x+.32,TQ.h+2.3,d,.3,.2,.02,f%100?[.95,.3,.2]:[.95,.85,.2]])}for(let f=50;f<=300;f+=50)for(const sx of[-34,34]){const d=f+RANGE_MAT;terrainAt(W,sx,d);bx.push([sx,TQ.h+1.4,d,.08,.7,1,[.93,.93,.88]]);bx.push([sx,TQ.h+.35,d-.7,.06,.35,.06,[.35,.26,.18]]);bx.push([sx,TQ.h+.35,d+.7,.06,.35,.06,[.35,.26,.18]])}}
  for(const[x,z,k]of W.stakes||[]){terrainAt(W,x,z);const col=k==='Y'?[.96,.84,.12]:[.9,.16,.12];bx.push([x,TQ.h+.36,z,.045,.36,.045,col]);bx.push([x,TQ.h+.74,z,.05,.03,.05,SETS.cb&&k==='Y'?[.06,.06,.06]:[.95,.95,.92]])}
  if(W.wear){const{cols,rows,ty,tC,ox,oz}=W;for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i,T=ty[c];if(T!==2&&T!==5)continue;const t=tC[c];if(!(W.par>3&&t>=DIVOT_ZONE[0]-2&&t<=DIVOT_ZONE[1]+2)&&!(W.par===5&&t>=W.len-132&&t<=W.len-68)&&!(W.par===3&&T===5))continue;
      for(let q=0;q<4;q++){const x=ox+i*CS+(q&1)+.25,z=oz+j*CS+(q>>1)+.25;terrainAt(W,x,z);if(wearKind(TQ.cell,TQ.ty,x,z)===1)bx.push([x,TQ.h+.012,z,.17,.02,.11,[.30,.24,.15]])}}}
  const P=coursePlan(W.seed,W.cv);if(P.club&&!W.real&&!(W.arch&&W.arch.n==='Short hole')&&!W.dio&&(W.cv>=CV_ISL?W.idx<36&&(W.idx%9===0||W.idx%9===8):S.n>=9&&(W.idx===0||W.idx===8||W.idx===9||W.idx===17))){const H=courseHole(W.seed,W.cv,W.idx),[lx,lz]=fromWorld(H,P.club.x,P.club.z);if(lx>W.ox+8&&lx<W.ox+W.cols*CS-8&&lz>W.oz+8&&lz<W.oz+W.rows*CS-8){terrainAt(W,lx,lz);const y=TQ.h,a=P.club.h-H.h,ca=MM.cos(a),sa=MM.sin(a),R=(u,v)=>[lx+u*ca+v*sa,lz-u*sa+v*ca];
      for(const[u,v,hx,hy,hz,col,yy]of[[0,0,7,2.2,4.5,[.86,.82,.72],2.2],[0,0,7.6,.35,5.1,[.46,.22,.18],4.6],[0,0,5.4,.35,3.6,[.50,.25,.2],5.3],[0,-4.6,1.2,1.1,.12,[.28,.2,.14],1.1],[-4,-4.55,1,.7,.1,[.55,.7,.85],2.4],[4,-4.55,1,.7,.1,[.55,.7,.85],2.4]]){const[px,pz]=R(u,v);bx.push([px,y+yy,pz,hx,hy,hz,col])}}}}
function freeMeshes(W){for(const m of Object.values(W.meshes)){if(m.buf)gl.deleteBuffer(m.buf);if(m.vb)gl.deleteBuffer(m.vb);if(m.nb)gl.deleteBuffer(m.nb);if(m.ib)gl.deleteBuffer(m.ib);if(m.tex)gl.deleteTexture(m.tex)}W.meshes={}}
