/* ===== v6 M1 · The island (course version 8): F-119 an island is a seed, F-120 set routings, F-121 fast travel. Every number is Brief v6's, by the same name. The layout is a pure function of the seed, routed whole before the first tee; a routing's conditions are a pure function of the seed and the date, and the island's ground never depends on the day ===== */
const CV_ISL=8,CVX=9;
const ISL_R=1450,ISL_WOBBLE=.18,ISL_HARM=[2,3,5],CLUB_SHORE=45,PRACTICE_OFF=140,LOOP_SPAN=150,LOOP_JIT=6,LOOP_REACH=1250,ROUTE_TRIES_8=24,LOOP_BRANCH=4,LOOP_NODES=300,HOME_TOL=120,CLUB_TRIES=24,ISL_CLEAR=60,ISL_CLEAR_MIN=45,CLUB_ZONE=300,LANE_R0=300,LANE_M=20,HOME_OFF=70,COAST_IN_8=25,ISLAND_HIDDEN=4,HIDE_CLEAR=110,CLUE_D=160,ISL_LOD=20,LM_CLEAR=90;
const PARS_A=PAR18_4,PARS_B=[4,4,3,5,4,3,5,4,4,4,5,3,4,4,4,4,3,5],HIDDEN_PARS=[3,3,3,4],ISL_PARS=PARS_A.concat(PARS_B,HIDDEN_PARS),ISL_N=ISL_PARS.length,HIDDEN_KINDS=['behind the landmark','over the ridge','in the woods','on the beach'];
const FT_T=1.5,FT_KEY='i',ARRIVE_T=3,ISLAND_YEAR=28,ISL_WEAR=[1,1,1,1,2,2,3],WALK_V=1.4,CART_V=5.5;
const ISL={dayFix:null,seed:0,ms:{}};
let ISL_DAY=0;
const islDayNow=()=>{if(ISL.dayFix!=null)return ISL.dayFix;const d=new Date();return clamp(Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(2026,0,1))/864e5),0,65535)};
const islDate=day=>new Date(2026,0,1+(day|0)),islWd=day=>(islDate(day).getDay()+6)%7;
const islKind=k=>(k|0)>=2?(k&7):0,islBase=k=>{const t=k&7;return t===6?k>>3:[0,0,0,9,18,27][t]|0};
const islJ=(c,i)=>{const k=c&&c.kind|0;return k<2?i:(k&7)===6?k>>3:islBase(k)+i};
const islPars=(n,k)=>{const j0=islJ({kind:k},0);return ISL_PARS.slice(j0,j0+n)};
const islRoutingName=(k,n)=>{const t=k&7;if(t===6){const j=k>>3;return j>=36?'Hidden hole · '+HIDDEN_KINDS[j-36]:(j<18?'A':'B')+' '+(j%18+1)}return(t<4?'Routing A':'Routing B')+' · '+(n===18?'all 18':t===2||t===4?'front nine':'back nine')};
const islMeta=seed=>{const R=mulberry32(thash(seed,8102));return{style:Math.floor(R()*3),architect:ARCHITECT_NAMES[Math.floor(R()*ARCHITECT_NAMES.length)],prevailing:R()*TAU}};
const ISLC=new Map();
function islandOf(seed){let I=ISLC.get(seed);if(!I){I=withMath(CV_ISL,()=>islandOf_(seed));ISLC.set(seed,I)}return I}
function islandOf_(seed){const t0=performance.now(),R=mulberry32(thash(seed,8101)),rr=(a,b)=>a+R()*(b-a),M=islMeta(seed),bio=biomeOf(seed,CV_ISL),BI=BIOMES[bio];
  const amp=ISL_HARM.map(()=>rr(.4,1)),as=amp[0]+amp[1]+amp[2],A=amp.map(a=>a/as*ISL_WOBBLE),ph=ISL_HARM.map(()=>rr(0,TAU));
  const rAt=a=>ISL_R*(1+A[0]*MM.sin(ISL_HARM[0]*a+ph[0])+A[1]*MM.sin(ISL_HARM[1]*a+ph[1])+A[2]*MM.sin(ISL_HARM[2]*a+ph[2])),sea=(x,z)=>MM.hyp(x,z)-rAt(MM.atan2(x,z));
  const CR=25,C0=-(ISL_R*(1+ISL_WOBBLE)+100),CN=Math.ceil(-2*C0/CR)+1,SR=new Float32Array(CN*CN);for(let j=0;j<CN;j++)for(let i=0;i<CN;i++)SR[j*CN+i]=sea(C0+i*CR,C0+j*CR);
  const seaQ=(x,z)=>{const u=(x-C0)/CR,v=(z-C0)/CR,i=Math.floor(u),j=Math.floor(v);if(i<0||j<0||i>=CN-1||j>=CN-1)return 999;const fu=u-i,fv=v-j,k=j*CN+i;return(SR[k]*(1-fu)+SR[k+1]*fu)*(1-fv)+(SR[k+CN]*(1-fu)+SR[k+CN+1]*fu)*fv};
  const NI=makeNoise(mulberry32(thash(seed,8111))),hbW=(x,z)=>NI.fbm(x*.0055+3.1,z*.0055+7.7,2)*4.2*BI.hills,hdW=(x,z)=>NI.fbm(x*.04+11,z*.04+5,3)*1.1*BI.detail;
  const coastD=(x0,z0,an)=>{let r=0;while(r<3000&&sea(x0+MM.sin(an)*r,z0+MM.cos(an)*r)<-COAST_IN_8)r+=20;return r};let ca=0,cb=-1;const off=rr(0,TAU);
  for(let i=0;i<CLUB_TRIES;i++){const an=off+i/CLUB_TRIES*TAU,r0=rAt(an)-CLUB_SHORE,cx=MM.sin(an)*r0,cz=MM.cos(an)*r0;let m=1e9;for(let q=0;q<8;q++)m=Math.min(m,coastD(cx,cz,an+Math.PI+(-LOOP_SPAN/2+LOOP_SPAN/8*(q+.5))*DEG));if(m>cb){cb=m;ca=an}}
  const rc=rAt(ca),hIn=ca+Math.PI,club={x:MM.sin(ca)*(rc-CLUB_SHORE),z:MM.cos(ca)*(rc-CLUB_SHORE),h:hIn};
  const pa=ca+PRACTICE_OFF/rc,pr=rAt(pa)-CLUB_SHORE-20,practice={x:MM.sin(pa)*pr,z:MM.cos(pa)*pr,h:pa+Math.PI};
  const GS=ISL_CLEAR,G=new Map(),addS=(x,z,j)=>{const k=Math.floor(x/GS)+','+Math.floor(z/GS);let a=G.get(k);if(!a)G.set(k,a=[]);a.push(x,z,j)},LP=[];
  const near=(x,z,skip)=>{let b2=1e18;const i0=Math.floor(x/GS),j0=Math.floor(z/GS);for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const a=G.get((i0+di)+','+(j0+dj));if(!a)continue;for(let q=0;q<a.length;q+=3){if(skip(a[q+2]))continue;const dx=a[q]-x,dz=a[q+1]-z,d2=dx*dx+dz*dz;if(d2<b2)b2=d2}}
    for(const Q of LP){if(skip(Q.j))continue;for(let q=0;q<Q.length;q+=3){const dx=Q[q]-x,dz=Q[q+1]-z,d2=dx*dx+dz*dz;if(d2<b2)b2=d2}}return Math.sqrt(b2)};
  const samp=(p,ox,oz,h)=>{const c=MM.cos(h),s=MM.sin(h),o=[];for(let k=0;k<p.C.length;k+=5){const q=p.C[k];o.push(ox+q.x*c+q.z*s,oz-q.x*s+q.z*c,0)}o.push(ox+p.g.x*c+p.g.z*s,oz-p.g.x*s+p.g.z*c,1);return o};
  let CLR=ISL_CLEAR;const HARD=1000,pen=(p,ox,oz,h,j,prevJ,la0,la1)=>{const Q=samp(p,ox,oz,h),n=Q.length/3,c0=la0==null?0:MM.cos(la0),s0=la0==null?0:MM.sin(la0),c1=la0==null?0:MM.cos(la1),s1=la0==null?0:MM.sin(la1);let m=-1e9,v=0,w=0;
    for(let k=0;k<n;k++){const x=Q[k*3],z=Q[k*3+1],gr=Q[k*3+2];m=Math.max(m,seaQ(x,z)+COAST_IN_8+(gr?p.gR+15:0));const px=x-club.x,pz=z-club.z,d2=px*px+pz*pz;if(d2<CLUB_ZONE*CLUB_ZONE)continue;
      const early=k<n*.25,d=near(x,z,jj=>jj===j||early&&jj===prevJ);if(d<CLR)v=Math.max(v,CLR-d);
      if(la0!=null&&d2>=LANE_R0*LANE_R0){const lm=Math.min(px*c0-pz*s0,pz*s1-px*c1);if(lm<LANE_M)w=Math.max(w,LANE_M-lm)}}
    return(m>0?HARD+20*m:m>-45?-50:0)+(v>0?HARD+20*v:0)+(w>0?HARD+20*w:0)};
  const RT=[],frames=[],frameOf=(j,par,h,ox,oz,p,loop)=>{const c=MM.cos(h),s=MM.sin(h);return{i:j,par,h,ox,oz,g:p.g,gR:p.gR,len:p.len,arch:p.arch,C:p.C,PD:p.PD,hw:p.hw,wind:{x:0,z:0,s:0,a:0},loop,gx:ox+p.g.x*c+p.g.z*s,gz:oz-p.g.x*s+p.g.z*c}};
  for(let L=0;L<4;L++){const a0=hIn+(-LOOP_SPAN/2+LOOP_SPAN/4*L)*DEG,a1=a0+LOOP_SPAN/4*DEG,am=(a0+a1)/2,ao=(a0+am)/2,ab=(am+a1)/2,P9=[];for(let k=0;k<9;k++)P9.push(holePlan(seed,L*9+k,ISL_PARS[L*9+k],CV_ISL));
    const reach=Math.max(300,Math.min(LOOP_REACH,coastD(club.x,club.z,ao)-150,coastD(club.x,club.z,ab)-150,coastD(club.x,club.z,am)-150)),home={x:club.x+MM.sin(ab)*HOME_OFF,z:club.z+MM.cos(ab)*HOME_OFF};
    const lane=k=>k<4?[a0,am]:k===4?[a0,a1]:[am,a1],Ls=P9.map(p=>MM.hyp(p.g.x,p.g.z)),RA=[];let r=CLUB_OFF;for(let k=0;k<4;k++){r+=(k?60:0)+Ls[k]*.92;RA[k]=Math.min(r,reach)}r=HOME_OFF;for(let k=7;k>=5;k--){r+=Ls[k+1]*.92+60;RA[k]=Math.min(r,reach)}RA[4]=Math.min(reach,Math.max(RA[3],RA[5])+Ls[4]*.5);
    const AIM=[];for(let k=0;k<8;k++){const an=k<4?ao:k===4?am:ab;AIM.push({x:club.x+MM.sin(an)*RA[k],z:club.z+MM.cos(an)*RA[k]})}AIM.push(home);
    const R2=mulberry32(thash(seed,8103+L)),r2=(a,b)=>a+R2()*(b-a),F9=[];let nodes=0,bestL=null,lanes=true;LP.length=0;
    const cands=k=>{const j=L*9+k,p=P9[k],Lg=Ls[k],ga=MM.atan2(p.g.x,p.g.z),W9=AIM[k],[la0,la1]=lanes?lane(k):[null,null],out=[],try1=(ox,oz,h)=>{const ex=ox+MM.sin(h+ga)*Lg,ez=oz+MM.cos(h+ga)*Lg,pn=pen(p,ox,oz,h,j,j-1,la0,la1);out.push({h,ox,oz,pn,d:MM.hyp(ex-W9.x,ez-W9.z)})};
      if(k===0){const ox=club.x+MM.sin(ao)*CLUB_OFF,oz=club.z+MM.cos(ao)*CLUB_OFF,h0=MM.atan2(W9.x-ox,W9.z-oz)-ga;for(let t=0;t<ROUTE_TRIES_8;t++)try1(ox,oz,h0+r2(-LOOP_JIT,LOOP_JIT)*DEG);if(!out.some(c=>c.pn<HARD))for(let t=0;t<ROUTE_TRIES_8*2;t++){const ta=r2(a0,a1),td=CLUB_OFF+r2(0,60),tx=club.x+MM.sin(ta)*td,tz=club.z+MM.cos(ta)*td;try1(tx,tz,r2(a0-20*DEG,a1+20*DEG)-ga)}}
      else{const prev=F9[k-1],walk=r2(40,80),w=(h,wk)=>try1(prev.gx+MM.sin(h)*wk,prev.gz+MM.cos(h)*wk,h),ta=MM.atan2(W9.x-prev.gx,W9.z-prev.gz)-ga;for(let t=0;t<ROUTE_TRIES_8;t++)w(ta+r2(-70,70)*DEG,walk);if(!out.some(c=>c.pn<HARD))for(let t=0;t<ROUTE_TRIES_8;t++)w(r2(0,TAU),r2(40,160))}
      return out.sort((a,b)=>(a.pn>=HARD)-(b.pn>=HARD)||a.d+a.pn-b.d-b.pn)};
    const put=(k,c)=>{const j=L*9+k,F=frameOf(j,ISL_PARS[j],c.h,c.ox,c.oz,P9[k],L);F9.push(F);const Q=samp(P9[k],F.ox,F.oz,F.h);Q.j=j;LP.push(Q);return F};
    const note=hm=>{let sc=2*hm;for(const F of F9)sc+=Math.max(0,F.pn);if(!bestL||sc<bestL.sc)bestL={sc,F9:F9.slice(),hm}};
    const dfs=k=>{if(nodes++>(lanes?LOOP_NODES:LOOP_NODES*3))return false;const C=cands(k).filter(c=>c.pn<HARD).slice(0,LOOP_BRANCH);for(const c of C){const F=put(k,c);F.pn=c.pn;
        if(k===8){const hm=MM.hyp(F.gx-home.x,F.gz-home.z);note(hm);if(hm<HOME_TOL)return true}else if(dfs(k+1))return true;F9.pop();LP.pop();if(nodes>(lanes?LOOP_NODES:LOOP_NODES*3))break}return false};
    if(!dfs(0)&&!bestL){lanes=false;nodes=0;F9.length=0;LP.length=0;if(!dfs(0)&&!bestL){CLR=ISL_CLEAR_MIN;nodes=0;F9.length=0;LP.length=0;dfs(0)}CLR=ISL_CLEAR}if(!bestL){F9.length=0;LP.length=0;CLR=ISL_CLEAR_MIN;for(let k=0;k<9;k++){const c=cands(k).sort((a,b)=>a.pn-b.pn)[0],F=put(k,c);F.pn=c.pn}CLR=ISL_CLEAR;note(MM.hyp(F9[8].gx-home.x,F9[8].gz-home.z));bestL.forced=true}RT.push({nodes,hm:Math.round(bestL.hm),sc:Math.round(bestL.sc),forced:!!bestL.forced});LP.length=0;for(const F of bestL.F9){frames.push(F);const Q=samp(P9[F.i-L*9],F.ox,F.oz,F.h);for(let q=0;q<Q.length;q+=3)addS(Q[q],Q[q+1],F.i)}}
  const RS=30,R0=-(ISL_R*(1+ISL_WOBBLE)+60),RN=Math.ceil(-2*R0/RS)+1,DR=new Float32Array(RN*RN).fill(1e9);
  for(const a of G.values())for(let q=0;q<a.length;q+=3){const x=a[q],z=a[q+1],i0=Math.max(0,Math.floor((x-240-R0)/RS)),i1=Math.min(RN-1,Math.ceil((x+240-R0)/RS)),j0=Math.max(0,Math.floor((z-240-R0)/RS)),j1=Math.min(RN-1,Math.ceil((z+240-R0)/RS));
    for(let jj=j0;jj<=j1;jj++)for(let ii=i0;ii<=i1;ii++){const d=MM.hyp(R0+ii*RS-x,R0+jj*RS-z),kk=jj*RN+ii;if(d<DR[kk])DR[kk]=d}}
  const dr=(x,z)=>{const i=Math.round((x-R0)/RS),j=Math.round((z-R0)/RS);return i<0||j<0||i>=RN||j>=RN?1e9:DR[j*RN+i]-22};
  const lb=bio-1,LB=lmBoxes(lb,0),LK=LM_K[lb],foot=Math.max(...LB.map(b=>MM.hyp(b[0],b[2])+MM.hyp(b[3],b[5])))*LK,jit=(thash(seed,8182)>>>0)%LM_JIT;let lm=null;
  for(const F of frames.slice().sort((a,b)=>MM.hyp(b.gx-club.x,b.gz-club.z)-MM.hyp(a.gx-club.x,a.gz-club.z)||a.i-b.i).slice(0,8)){const l=MM.hyp(F.gx-F.ox,F.gz-F.oz)||1,ux=(F.gx-F.ox)/l,uz=(F.gz-F.oz)/l,a=MM.atan2(-ux,-uz);
    for(let d=LM_BACK[lb]+jit;d<LM_BACK[lb]+jit+300&&!lm;d+=LM_STEP){const x=F.gx+ux*d,z=F.gz+uz*d,e=sea(x,z);if(lb===5?e<LM_SHORE:e+foot+20>0)continue;if(dr(x,z)<foot+LM_CLEAR)continue;lm={x,z,a,hole:F.i,bio:lb,name:LM_NAMES[lb]}}if(lm)break}
  if(!lm)lm={x:0,z:0,a:0,hole:-1,none:true,bio:lb,name:LM_NAMES[lb]};
  const ends=[];frames.forEach(F=>{ends.push({j:F.i,at:'tee',x:F.ox,z:F.oz},{j:F.i,at:'green',x:F.gx,z:F.gz})});
  const clueOf=(x,z)=>{let b=null;for(const e of ends){const d=MM.hyp(e.x-x,e.z-z);if(!b||d<b.d)b={j:e.j,at:e.at,x:e.x,z:e.z,d}}return b};
  const hid=[],H=[],clearOf=(Q,clr)=>{for(let q=0;q<Q.length;q+=3){const x=Q[q],z=Q[q+1];if(sea(x,z)+COAST_IN_8>0||dr(x,z)<clr)return false;for(const o of H)if(MM.hyp(x-o.x,z-o.z)<ISL_CLEAR*2)return false}return true};
  const place=(k,cands)=>{const j=36+k,par=HIDDEN_PARS[k],p=holePlan(seed,j,par,CV_ISL);
    for(const[clr,cl]of[[HIDE_CLEAR,true],[HIDE_CLEAR,false],[ISL_CLEAR,false]])for(const c of cands){const Q=samp(p,c.x,c.z,c.h),cu=clueOf(c.x,c.z);if(cl&&cu.d>CLUE_D&&!c.lmk)continue;if(!clearOf(Q,clr))continue;
      const F=frameOf(j,par,c.h,c.x,c.z,p,-1);F.hid=k;F.clue=cu;hid.push(F);for(let q=0;q<Q.length;q+=3)H.push({x:Q[q],z:Q[q+1]});return F}return null};
  const band=[];for(const e of ends)for(const r of[115,135,155])for(let i=0;i<16;i++){const a=i/16*TAU,x=e.x+MM.sin(a)*r,z=e.z+MM.cos(a)*r;if(sea(x,z)<-60&&dr(x,z)>=HIDE_CLEAR-10)band.push({x,z,a,e})}
  const pick=f=>{const o=[];for(const c of band){const s=f(c);for(const dh of[-.5,0,.5])o.push({x:c.x,z:c.z,h:c.a+dh,s})}return o.sort((a,b)=>b.s-a.s||a.x-b.x||a.z-b.z)};
  if(!lm.none){const F=frames[lm.hole],va=MM.atan2(lm.x-F.gx,lm.z-F.gz),cs=[];for(const r of[60,90,120,150])for(let i=0;i<16;i++){const a=i/16*TAU,s=MM.cos(a-va);if(s>.2)cs.push({x:lm.x+MM.sin(a)*r,z:lm.z+MM.cos(a)*r,h:a,s})}cs.sort((a,b)=>b.s-a.s);
    const H0=place(0,cs.map(c=>Object.assign(c,{lmk:1})));if(H0)H0.clue={j:F.i,at:'green',x:F.gx,z:F.gz,d:MM.hyp(F.gx-H0.ox,F.gz-H0.oz),lm:true}}
  place(1,pick(c=>hbW(c.x,c.z)));
  place(2,pick(c=>NI.n2(c.x*.003+50,c.z*.003+50)));
  {const cs=[];for(let i=0;i<192;i++){const a=i/192*TAU,r=rAt(a)-70,x=MM.sin(a)*r,z=MM.cos(a)*r,t=a+Math.PI/2,cu=clueOf(x,z);for(const h of[t,t+Math.PI])cs.push({x,z,h,s:-cu.d})}cs.sort((a,b)=>b.s-a.s);place(3,cs)}
  for(let k=0;k<ISLAND_HIDDEN;k++){let F=hid.find(f=>f.hid===k);if(!F){const p=holePlan(seed,36+k,HIDDEN_PARS[k],CV_ISL);F=frameOf(36+k,HIDDEN_PARS[k],practice.h,practice.x+MM.sin(practice.h)*60*(k+1),practice.z+MM.cos(practice.h)*60*(k+1),p,-1);F.hid=k;F.clue=clueOf(F.ox,F.oz);F.forced=true}frames.push(F)}
  const paths=[],path=(a,b,kind,j)=>paths.push({kind,j,pts:[[a.x,a.z],[b.x,b.z]],len:MM.hyp(a.x-b.x,a.z-b.z)});
  for(let L=0;L<4;L++){path(club,{x:frames[L*9].ox,z:frames[L*9].oz},'club',L*9);for(let k=0;k<8;k++){const a=frames[L*9+k],b=frames[L*9+k+1];path({x:a.gx,z:a.gz},{x:b.ox,z:b.oz},'link',L*9+k+1)}path({x:frames[L*9+8].gx,z:frames[L*9+8].gz},club,'home',L*9+8)}
  for(let k=0;k<ISLAND_HIDDEN;k++){const F=frames[36+k];path(F.clue,{x:F.ox,z:F.oz},'clue',36+k)}
  const e=ISL_R*(1+ISL_WOBBLE)+40;
  return{seed,bio,A,ph,rAt,sea,NI,hbW,hdW,club,practice,hIn,frames,lm,paths,style:M.style,architect:M.architect,prevailing:M.prevailing,bounds:{x0:-e,x1:e,z0:-e,z1:e},rt:RT,ms:performance.now()-t0}}
const ISLD=new Map();
function islDayOf(seed,day){const k=seed+'/'+day;let D=ISLD.get(k);if(D)return D;D=withMath(CV_ISL,()=>{const I=islandOf(seed),R=mulberry32(thash(seed,day,8201)),BI=BIOMES[I.bio];let u=R(),wi=0;for(let i=0;i<WEATHER3.length;i++){if(u<WEATHER3[i].p){wi=i;break}u-=WEATHER3[i].p}const wea=WEATHER3[wi];
    const ws=R()*R()*8*BI.wind*wea.wind,wa=I.prevailing+(R()+R()+R()-1.5)*1.6,wd=islWd(day);
    return{day,wea,wind:{x:MM.sin(wa)*ws,z:MM.cos(wa)*ws,s:ws,a:wa},swell:WIND.swell*(wea.rain?RAIN.swell:1),season:islSeason(seed,day),setup:PINS.day[wd],wear:ISL_WEAR[wd],wd}});ISLD.set(k,D);return D}
const islSeason=(seed,day)=>Math.floor((((day|0)+((thash(seed,8301)>>>0)%ISLAND_YEAR))%ISLAND_YEAR)/(ISLAND_YEAR/4));
function islPlan(seed,cv){const day=ISL_DAY|0,key=seed+'/'+cv+'/'+day;let P=CPLAN[key];if(P)return P;const I=islandOf(seed),D=islDayOf(seed,day);
  P={seed,cv,wea:D.wea,wind:D.wind,swell:D.swell,holes:I.frames,R:null,rr:null,style:I.style,architect:I.architect,coast:{isl:true},isl:I,club:I.club,day};CPLAN[key]=P;return P}
const islWindLocal=(seed,cv,j)=>{const P=coursePlan(seed,cv),F=P.holes[j],c=MM.cos(F.h),s=MM.sin(F.h),w=P.wind,x=w.x*c-w.z*s,z=w.x*s+w.z*c;return{x,z,s:w.s,a:MM.atan2(x,z)}};
const islWorld=(seed,j)=>{const I=islandOf(seed),F=I.frames[j],c=MM.cos(F.h),s=MM.sin(F.h);return{hb:(x,z)=>I.hbW(F.ox+x*c+z*s,F.oz-x*s+z*c),hd:(x,z)=>I.hdW(F.ox+x*c+z*s,F.oz-x*s+z*c)}};
const islNorm=(I,F)=>{const[x,z]=toWorld(F,F.g.x/2,F.g.z/2),l=MM.hyp(x,z)||1;return{nx:x/l,nz:z/l}};
function islGenHole(seed,idx,par,cv,setup,cond){const d0=ISL_DAY;if(cond&&cond.islDay!=null)ISL_DAY=cond.islDay|0;try{return genHole_(seed,islJ(cond,idx),par,cv,setup,cond)}finally{ISL_DAY=d0}}
function islCond(seed,day){const D=islDayOf(seed,day);return{season:D.season,setup:D.setup,wear:D.wear,twist:0}}
function islRoundStart(){if(S.cv>=CV_ISL){if(S.islDay==null)S.islDay=islDayNow();ISL_DAY=S.islDay|0;ISL.seed=S.seed}}
function islPrep(seed,kind,day){const c=islCond(seed,day);S.seed=seed;S.over=false;S.setup=c.setup;S.season=c.season;S.wear=c.wear;S.casual=S.casualOn?1:0;S.kind=kind;S.twist=0;S.islDay=day;S.forceCv=CVX;S.tourRound=null;S.fmtNext={format:0,twist:0}}
function islHdr8(w,seed,n,hcp,cv,H){const k=H.kind|0;w.w(H.golfer?9:8,4);w.w(seed,30);w.w(n===1?3:HOLESC.indexOf(n),2);w.w(hcp==null?31:clamp(hcp,0,27),5);w.w(cv,5);w.w(k&7,3);w.w(clamp(H.islDay|0,0,65535),16);if((k&7)===6)w.w(k>>3,6);if(H.golfer)golfWrite(w,H.golfer)}
function decodeRound8(r,g9){const seed=r.r(30),ni=r.r(2),n=ni===3?1:HOLESC[ni],hv=r.r(5),hcp=hv===31?null:hv,cv=r.r(5);if(!n||seed<1||cv<CV_ISL||cv>CVX&&cv!==CV_NOW)return null;const k=r.r(3),day=r.r(16),id=k===6?r.r(6):0,V10=cv===CV_NOW,GF=g9?golfRead(r):null;if(g9&&(!GF||!V10))return null;
  if(V10&&k<2){if(n===1)return null}else if(k<2||k>6||(k===6)!==(n===1)||(k===6&&id>=ISL_N)||(n===18&&k!==2&&k!==4))return null;const d=decodeRound6(r,seed,n,hcp,V10?(k>=2?CVX:CV):cv,7);if(!d)return null;d.kind=k===6?6|id<<3:k;d.islDay=day;d.ver=g9?9:8;if(V10)d.v10=true;if(GF)d.golfer=GF;return d}
const islHRGet=()=>lsGet('voxellinks.isl.hr',{}),islHR=(seed,j)=>islHRGet()[seed+'.'+j]||null;
function islHRAdd(seed,j,s,m,day,code){const R=islHRGet(),k=seed+'.'+j,o=R[k],mv=m==null?1e9:m;if(o&&(o.s<s||o.s===s&&(o.m==null?1e9:o.m)<=mv))return false;R[k]={s,m:m==null?null:Math.round(m*10)/10,day,code:code||null,t:Date.now()};lsSet('voxellinks.isl.hr',R);return true}
const islShown=(seed,j)=>j<36||j<ISL_N&&(islFoundMask(seed)>>(j-36)&1)===1;
const islHoleName=j=>j>=36?'Hidden '+(j-35):(j<18?'A':'B')+' '+(j%18+1);
const holeTitle6=i=>(S.cv>=CV_ISL&&S.kind>=2?islHoleName(islJ(S,i)):'Hole '+(i+1))+' · Par '+(W?W.par:S.pars[i]);
function islRoundDone(code){if(S.cv<CV_ISL||S.kind<2||S.islDone||S.lab||S.replay||S.golfer)return[];S.islDone=true;const cz=casualStats();if(cz.mull)return[];const out=[];
  S.strokes.forEach((st,h)=>{if(st==null)return;const j=islJ(S,h),m=S.islMg&&S.islMg[h]!=null?S.islMg[h]:null;if(islHRAdd(S.seed,j,st,m,S.islDay,(S.kind&7)===6?code:null))out.push(islHoleName(j))});return out}
function islMesh(I){const t0=performance.now(),S0=ISL_LOD,b=I.bounds,nx=Math.ceil((b.x1-b.x0)/S0),nz=Math.ceil((b.z1-b.z0)/S0),BI=BIOMES[I.bio],pal=BI.pal||{},col=t=>pal[t]||SURF[t].col,lvl=-(4.2*BI.hills+2),wc=BI.waterCol||[.2,.45,.7];
  const vx=i=>b.x0+i*S0,vz=j=>b.z0+j*S0,H=new Float32Array((nx+1)*(nz+1));
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=vx(i),z=vz(j),e=I.sea(x,z);let h=I.hbW(x,z)+I.hdW(x,z)*.4;if(e>-60)h=lerp(h,lvl+.6,sstep(-60,0,e));if(e>0)h=lvl-1.5-Math.min(10,e*.04);H[j*(nx+1)+i]=h}
  const T=new Uint8Array(nx*nz);for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=vx(i)+S0/2,z=vz(j)+S0/2,e=I.sea(x,z);T[j*nx+i]=e>0?7:e>-28?6:I.NI.n2(x*.01+3,z*.01+9)>.25?1:0}
  const mark=(x,z,r,t)=>{const i0=Math.max(0,Math.floor((x-r-b.x0)/S0)),i1=Math.min(nx-1,Math.floor((x+r-b.x0)/S0)),j0=Math.max(0,Math.floor((z-r-b.z0)/S0)),j1=Math.min(nz-1,Math.floor((z+r-b.z0)/S0));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=j*nx+i;if(T[c]===7||T[c]===4||T[c]===5)continue;if(MM.hyp(vx(i)+S0/2-x,vz(j)+S0/2-z)<=r+S0*.36)T[c]=t}};
  for(const F of I.frames){if(!islShown(I.seed,F.i))continue;for(let k=0;k<F.C.length;k+=2){const q=F.C[k];if(q.t<-4||q.t>F.len-F.gR*.6)continue;const[x,z]=toWorld(F,q.x,q.z);mark(x,z,F.hw(q.t)*.8,2)}mark(F.gx,F.gz,F.gR+2,4);mark(F.ox,F.oz,5,5)}
  let land=0;for(let c=0;c<T.length;c++)if(T[c]!==7)land++;const mb=new MB((land*6+(nz+1)*6+4000)*10);
  for(let j=0;j<nz;j++){let run=-1;for(let i=0;i<=nx;i++){const t=i<nx?T[j*nx+i]:-1;if(t===7){if(run<0)run=i;continue}
      if(run>=0){const x0=vx(run),x1=vx(i),z0=vz(j),z1=vz(j+1);mb.tri(x0,lvl,z0,x1,lvl,z0,x1,lvl,z1,wc[0],wc[1],wc[2],0);mb.tri(x0,lvl,z0,x1,lvl,z1,x0,lvl,z1,wc[0],wc[1],wc[2],0);run=-1}
      if(i===nx)break;const k=j*(nx+1)+i,a=H[k],b1=H[k+1],c1=H[k+nx+2],d=H[k+nx+1],x0=vx(i),x1=vx(i+1),z0=vz(j),z1=vz(j+1),cc=col(t),v=1+.07*I.NI.n2(x0*.05+1,z0*.05+2);
      mb.tri(x0,a,z0,x1,b1,z0,x1,c1,z1,cc[0]*v,cc[1]*v,cc[2]*v,0);mb.tri(x0,a,z0,x1,c1,z1,x0,d,z1,cc[0]*v,cc[1]*v,cc[2]*v,0)}}
  const E=9000;for(const[x0,z0,x1,z1]of[[-E,-E,E,b.z0],[-E,b.z1,E,E],[-E,b.z0,b.x0,b.z1],[b.x1,b.z0,E,b.z1]]){mb.tri(x0,lvl,z0,x1,lvl,z0,x1,lvl,z1,wc[0],wc[1],wc[2],0);mb.tri(x0,lvl,z0,x1,lvl,z1,x0,lvl,z1,wc[0],wc[1],wc[2],0)}
  const gy=(x,z)=>{const i=clamp(Math.round((x-b.x0)/S0),0,nx),j=clamp(Math.round((z-b.z0)/S0),0,nz);return H[j*(nx+1)+i]};
  {const C=I.club,y=gy(C.x,C.z),c=MM.cos(C.h),s=MM.sin(C.h);for(const[u,v,hx,hy,hz,cl]of[[0,0,9,3,5,[.86,.82,.72]],[0,0,9.6,.5,5.6,[.46,.22,.18]]])mb.box(C.x+u*c+v*s,y+hy+(cl[0]<.5?5.4:0),C.z-u*s+v*c,hx,hy,hz,cl,0)}
  if(!I.lm.none){const L=I.lm,K=LM_K[L.bio],y=gy(L.x,L.z),c=MM.cos(L.a),s=MM.sin(L.a);for(const e of lmBoxes(L.bio,0))mb.box(L.x+(c*e[0]+s*e[2])*K,y+e[1]*K,L.z+(c*e[2]-s*e[0])*K,e[3]*K,e[4]*K,e[5]*K,e[6],0)}
  for(const F of I.frames){if(!islShown(I.seed,F.i))continue;const y=gy(F.gx,F.gz);mb.box(F.gx,y+3,F.gz,.25,3,.25,[.95,.95,.95],0);mb.box(F.gx+1.4,y+5.2,F.gz,1.2,.7,.1,[.92,.16,.16],0)}
  return{mesh:mb.upload(),lvl,gy,verts:(nx+1)*(nz+1),tris:mb.nv/3,ms:performance.now()-t0}}
const ISLV={on:false,W:null,M:null,fl:null,focus:null,cam:{x:0,y:200,z:0,tx:0,ty:0,tz:1,fov:55*DEG,fogK:.00032},t0:0};
function islView(I){if(ISLV.W&&ISLV.W.seed===I.seed)return ISLV.W;if(ISLV.M&&ISLV.M.mesh.buf)gl.deleteBuffer(ISLV.M.mesh.buf);const M=islMesh(I),BI=BIOMES[I.bio];ISLV.M=M;ISL.ms.mesh=M.ms;
  ISLV.W={dio:true,isl:true,seed:I.seed,idx:0,cv:0,meshes:{terrain:M.mesh,boxes:{n:0},lm:0},sun:SUN,light:[1,1,1],sky:BI.sky||[.28,.5,.9],fog:BI.fog||FOG,fogMul:1,pin:{x:0,y:-999,z:0},wind:{x:0,z:0,s:0,a:0},PD:[],levels:[],hlow:M.lvl,clock:null,rain:false};return ISLV.W}
function islRender(){const V=ISLV;islCamStep(performance.now());const g0=[GFX.level,GFX.shadows,GFX.post,GFX.bloom,GFX.refl],c0=Object.assign({},cam),w0=W,sy=HUDL.sy;
  Object.assign(cam,V.cam);GFX.level=0;GFX.shadows=GFX.post=GFX.bloom=GFX.refl=false;HUDL.sy=0;W=V.W;try{render(S.t)}finally{W=w0;[GFX.level,GFX.shadows,GFX.post,GFX.bloom,GFX.refl]=g0;Object.assign(cam,c0);HUDL.sy=sy}}
function islCamStep(now){const V=ISLV,C=V.cam;if(V.fl){const F=V.fl,u=Math.min(1,(now-F.t0)/(F.dur*1000)),e=rmOn()?1:sstep(0,1,u),l3=(p,q)=>[lerp(p[0],q[0],e),lerp(p[1],q[1],e),lerp(p[2],q[2],e)],E=l3(F.a.eye,F.b.eye),T=l3(F.a.tgt,F.b.tgt);
    E[1]+=F.peak*4*e*(1-e);[C.x,C.y,C.z]=E;[C.tx,C.ty,C.tz]=T;if(u>=1||rmOn()){V.fl=null;V.focus=F.b.tgt;V.t0=now;if(F.done)F.done()}return}
  const f=V.focus||[0,0,0],t=rmOn()?0:(now-V.t0)/1000,a=(V.focusA||0)+t*.035;C.x=f[0]-MM.sin(a)*380;C.z=f[2]-MM.cos(a)*380;C.y=f[1]+210;C.tx=f[0];C.ty=f[1];C.tz=f[2]}
function islFly(a,b,dur,peak,done){ISLV.fl={t0:performance.now(),dur,a,b,peak,done}}
const islEyeAt=(I,x,z,up)=>[x,(ISLV.M?ISLV.M.gy(x,z):I.hbW(x,z))+up,z];
const IMAP={open:false,from:null,hover:-1,sc:1,cx:0,cy:0};
function islMapOpen(from){const I=islandOf(ISL.seed);IMAP.open=true;IMAP.from=from;const el=$('islMap');el.classList.remove('hide');$('islName').textContent=islName(I.seed);$('islToday').innerHTML=islTodayLine(I.seed);islCards();islMapDraw();document.body.classList.add('isl-map')}
function islMapClose(back){IMAP.open=false;$('islMap').classList.add('hide');$('islTip').classList.add('hide');document.body.classList.remove('isl-map');if(IMAP.from==='title'&&back!==false)islLeave()}
function islLeave(){ISLV.on=false;ISLV.fl=null;document.body.classList.remove('isl-fly');if(S.mode==='title'){$('title').classList.remove('hide');refreshTitle()}}
const islName=seed=>{const bio=biomeOf(seed,CV_ISL),R=mulberry32(thash(seed,7777,bio)),A=NAME_A[bio]||NAME_A[0],Bn=NAME_B[bio]||NAME_B[0],h={name:A[Math.floor(R()*A.length)]+' '+Bn[Math.floor(R()*Bn.length)]};return h.name.replace(/ (Links|Golf Club|Club|Golf Links|Course|Golf Course)$/,'')+' Island'};
function islTodayLine(seed,day=islDayNow()){const D=islDayOf(seed,day),I=islandOf(seed),w=D.wind,dirs=['north','north-east','east','south-east','south','south-west','west','north-west'],from=dirs[((Math.round((MM.atan2(-w.x,-w.z)/TAU)*8)%8)+8)%8];
  return esc(islDate(day).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}))+' · '+SEASONS[D.season].n+' · '+D.wea.n.toLowerCase()+' · wind '+Math.round(w.s*3.6)+' km/h from the '+from+' · '+PINS.names[D.setup]+' · '+BIOMES[I.bio].n+', '+esc(I.architect)}
function islNineWind(seed,j0,n,day=islDayNow()){const I=islandOf(seed),w=islDayOf(seed,day).wind,al=j=>{const F=I.frames[j],dx=F.gx-F.ox,dz=F.gz-F.oz,l=MM.hyp(dx,dz)||1;return(w.x*dx+w.z*dz)/l},m=(a,b)=>{let t=0;for(let j=a;j<=b;j++)t+=al(j);return t/(b-a+1)},lab=v=>v>1?'downwind':v<-1?'into the wind':'across the wind',o=lab(m(j0,j0+3)),h=lab(m(j0+5,j0+8));return o===h?o+' all the way':'out '+o+', home '+h}
const islBestKey=(seed,n,k)=>CV_NOW+'.'+seed+'.'+n+'.k'+k;
function islCards(){const I=islandOf(ISL.seed),el=$('islCards'),B=bookGet().bests||{},inR=S.mode!=='title'&&S.cv>=CV_ISL&&S.kind>=2&&(S.kind&7)!==6&&!S.over;let h='<div class="islRt"><b>Routing A</b> <small>· dark tees</small></div>';
  for(const[k,n,lab]of[[2,9,'Front nine'],[3,9,'Back nine'],[2,18,'All 18'],[4,9,'Front nine'],[5,9,'Back nine'],[4,18,'All 18']]){if(k===4&&n===9)h+='<div class="islRt"><b>Routing B</b> <small>· cream tees</small></div>';const j0=islBase(k),pars=ISL_PARS.slice(j0,j0+n),par=pars.reduce((a,b)=>a+b,0),len=I.frames.slice(j0,j0+n).reduce((a,F)=>a+F.len,0),b=B[islBestKey(ISL.seed,n,k)];
    h+='<button class="islNine" data-k="'+k+'" data-n="'+n+'"'+(inR?' disabled':'')+'><b>'+lab+'</b> · par '+par+' · '+fmtD(Math.round(len/10)*10)+'<br><small>'+islNineWind(ISL.seed,j0,n)+(b?' · your best '+b.s:'')+'</small></button>'}
  const R=islHRGet();let held=0;for(let j=0;j<36;j++)if(R[ISL.seed+'.'+j])held++;
  h+='<p class="sub" style="margin:8px 0 0">Hole records: '+held+' of '+(islShown(ISL.seed,20)?36:18)+(inR?' · travel opens when the routing ends':' · click any tee to play it for its record')+'</p>'+islPassHtml(ISL.seed);el.innerHTML=h;
  el.querySelectorAll('.islNine').forEach(b=>b.onclick=()=>{AU.play('ui');islPlay(+b.dataset.k,+b.dataset.n)})}
function islMapDraw(){const cv2=$('islC');if(!cv2||!cv2.getContext)return;const t0=performance.now(),I=islandOf(ISL.seed),dpr=Math.min(devicePixelRatio||1,2),wpx=cv2.clientWidth||600,hpx=cv2.clientHeight||600;cv2.width=wpx*dpr;cv2.height=hpx*dpr;const g=cv2.getContext('2d');if(!g)return;g.setTransform(dpr,0,0,dpr,0,0);
  const b=I.bounds,sc=Math.min(wpx/(b.x1-b.x0),hpx/(b.z1-b.z0))*.98,cx=wpx/2,cy=hpx/2,X=x=>cx+x*sc,Y=z=>cy-z*sc,BI=BIOMES[I.bio],pal=BI.pal||{},rgb=(c,a=1)=>'rgba('+(c[0]*255|0)+','+(c[1]*255|0)+','+(c[2]*255|0)+','+a+')',col=t=>rgb(pal[t]||SURF[t].col);
  IMAP.sc=sc;IMAP.cx=cx;IMAP.cy=cy;g.fillStyle=rgb(BI.waterCol||[.2,.45,.7]);g.fillRect(0,0,wpx,hpx);
  const coast=()=>{g.beginPath();for(let k=0;k<=180;k++){const a=k/180*TAU,r=I.rAt(a);k?g.lineTo(X(MM.sin(a)*r),Y(MM.cos(a)*r)):g.moveTo(X(MM.sin(a)*r),Y(MM.cos(a)*r))}g.closePath()};
  coast();g.fillStyle=col(6);g.fill();g.save();g.beginPath();for(let k=0;k<=180;k++){const a=k/180*TAU,r=I.rAt(a)-26;k?g.lineTo(X(MM.sin(a)*r),Y(MM.cos(a)*r)):g.moveTo(X(MM.sin(a)*r),Y(MM.cos(a)*r))}g.closePath();g.fillStyle=col(0);g.fill();g.restore();
  g.setLineDash([4,4]);g.lineWidth=1.5;g.strokeStyle=TK('c200',.85);for(const p of I.paths){if(!islShown(I.seed,p.j))continue;g.beginPath();g.moveTo(X(p.pts[0][0]),Y(p.pts[0][1]));g.lineTo(X(p.pts[1][0]),Y(p.pts[1][1]));g.stroke()}g.setLineDash([]);
  g.lineCap='round';g.lineJoin='round';
  for(const F of I.frames){if(!islShown(I.seed,F.i))continue;const hot=IMAP.hover===F.i;g.beginPath();for(let k=0;k<F.C.length;k+=3){const q=F.C[k],[x,z]=toWorld(F,q.x,q.z);k?g.lineTo(X(x),Y(z)):g.moveTo(X(x),Y(z))}g.lineTo(X(F.gx),Y(F.gz));g.strokeStyle=hot?TK('gold300',.95):col(2);g.lineWidth=Math.max(3,F.hw(F.len*.5)*1.6*sc);g.stroke();
    g.fillStyle=col(4);g.beginPath();g.arc(X(F.gx),Y(F.gz),Math.max(3,F.gR*sc*1.2),0,TAU);g.fill()}
  g.font='600 11px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
  for(const F of I.frames){if(!islShown(I.seed,F.i))continue;const hot=IMAP.hover===F.i,lx=X(F.ox)+MM.sin(F.h)*12,ly=Y(F.oz)-MM.cos(F.h)*12;g.fillStyle=TK('white');g.beginPath();g.arc(X(F.ox),Y(F.oz),2.5,0,TAU);g.fill();g.fillStyle=hot||F.i>=36?TK('gold300'):F.i>=18?TK('c100'):TK('g950');g.beginPath();g.arc(lx,ly,hot?9:7.5,0,TAU);g.fill();if(F.i>=18&&!hot){g.strokeStyle=TK('g950');g.lineWidth=1.2;g.stroke()}g.fillStyle=hot||F.i>=18?TK('g950'):TK('white');g.fillText(F.i>=36?'H'+(F.i-35):String(F.i%18+1),lx,ly+.5);F.lx=lx;F.ly=ly}
  const C=I.club;g.fillStyle=TK('c100');g.strokeStyle=TK('red600');g.lineWidth=2;g.beginPath();g.rect(X(C.x)-8,Y(C.z)-6,16,12);g.fill();g.stroke();g.fillStyle=TK('white');g.font='600 12px system-ui,sans-serif';g.fillText('Clubhouse',X(C.x),Y(C.z)-16);
  const Pg=I.practice;g.save();g.translate(X(Pg.x),Y(Pg.z));g.rotate(-Pg.h+Math.PI);g.fillStyle=col(2);g.fillRect(-10*sc*2,-60*sc,20*sc*2,120*sc);g.restore();
  if(!I.lm.none){g.fillStyle=TK('c200');g.beginPath();g.moveTo(X(I.lm.x),Y(I.lm.z)-9);g.lineTo(X(I.lm.x)-7,Y(I.lm.z)+6);g.lineTo(X(I.lm.x)+7,Y(I.lm.z)+6);g.closePath();g.fill();g.fillStyle=TK('white',.9);g.font='11px system-ui,sans-serif';g.fillText('the '+I.lm.name,X(I.lm.x),Y(I.lm.z)+16)}
  if(S.mode!=='title'&&W&&S.cv>=CV_ISL&&S.seed===ISL.seed&&W.idx<ISL_N){const F=I.frames[W.idx],[x,z]=toWorld(F,PB.x,PB.z);g.fillStyle=TK('white');g.strokeStyle=TK('red500');g.lineWidth=3;g.beginPath();g.arc(X(x),Y(z),6,0,TAU);g.fill();g.stroke()}
  ISL.ms.map=performance.now()-t0}
function islHit(e){const cv2=$('islC'),r=cv2.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,I=islandOf(ISL.seed);let best=-1,bd=13;for(const F of I.frames){if(!islShown(I.seed,F.i)||F.lx==null)continue;const d=Math.min(MM.hyp(F.lx-mx,F.ly-my),MM.hyp(IMAP.cx+F.ox*IMAP.sc-mx,IMAP.cy-F.oz*IMAP.sc-my));if(d<bd){bd=d;best=F.i}}return{j:best,mx,my}}
function islTip(j,mx,my){const el=$('islTip');if(j<0){el.classList.add('hide');return}const I=islandOf(ISL.seed),F=I.frames[j],r=islHR(ISL.seed,j),inR=S.mode!=='title'&&S.cv>=CV_ISL&&(S.kind&7)!==6&&S.kind>=2&&!S.over;
  el.innerHTML='<b>'+islHoleName(j)+'</b> · par '+F.par+' · '+fmtD(Math.round(F.len))+(F.arch?' · '+esc(F.arch.n):'')+'<br>'+(r?'Your record: '+r.s+(r.m!=null?' · closest call '+fmtD(r.m):''):'No record yet')+'<br><small>'+(inR?'Travel opens when the routing ends':'Click to fly there and play it')+'</small>';
  el.style.left=Math.min(mx+16,($('islC').clientWidth||600)-200)+'px';el.style.top=(my+12)+'px';el.classList.remove('hide')}
function islMapWire(){const cv2=$('islC');if(!cv2||cv2.dataset.w)return;cv2.dataset.w=1;
  cv2.addEventListener('mousemove',e=>{const h=islHit(e);if(h.j!==IMAP.hover){IMAP.hover=h.j;islMapDraw()}islTip(h.j,h.mx,h.my)});cv2.addEventListener('mouseleave',()=>{IMAP.hover=-1;islTip(-1);islMapDraw()});
  cv2.addEventListener('click',e=>{const h=islHit(e);if(h.j<0)return;AU.play('ui');islTravel(h.j)});$('islClose').onclick=()=>{AU.play('ui');islMapClose()};
  addEventListener('keydown',e=>{if(!IMAP.open)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();islMapClose();return}if(e.key&&e.key.toLowerCase()===FT_KEY){e.preventDefault();e.stopImmediatePropagation();islMapClose();return}if(e.key===' '||e.key==='Enter'){e.stopImmediatePropagation()}},true);
  addEventListener('resize',()=>{if(IMAP.open)islMapDraw()})}
function islOpen(seed){seed=Math.max(1,seed|0);ISL.seed=seed;const t0=performance.now(),I=islandOf(seed);ISL.ms.layout=I.ms;ISL.ms.open=performance.now()-t0;lsSet('voxellinks.isl.last',seed);
  if(typeof sheetClose==='function')sheetClose();$('title').classList.add('hide');ISLV.on=true;islView(I);islMapWire();document.body.classList.add('isl-fly');
  const C=I.club,out=[MM.sin(I.hIn+Math.PI),MM.cos(I.hIn+Math.PI)],cen=[C.x+MM.sin(I.hIn)*420,C.z+MM.cos(I.hIn)*420];ISLV.focusA=I.hIn;
  islFly({eye:[C.x+out[0]*900,300,C.z+out[1]*900],tgt:[C.x,0,C.z]},{eye:islEyeAt(I,C.x+out[0]*260,C.z+out[1]*260,150),tgt:[cen[0],I.hbW(cen[0],cen[1]),cen[1]]},ARRIVE_T,0,()=>{ISLV.focus=[cen[0],I.hbW(cen[0],cen[1]),cen[1]];islMapOpen('title')})}
function islPlay(kind,n){const seed=ISL.seed;islMapClose(false);ISLV.on=false;ISLV.fl=null;document.body.classList.remove('isl-fly');$('card').classList.add('hide');islPrep(seed,kind,islDayNow());startRound(n,null,null,oppArg())}
function islTravel(j){const I=islandOf(ISL.seed);if(!islShown(ISL.seed,j))return;if(S.mode!=='title'&&S.cv>=CV_ISL&&S.kind>=2&&(S.kind&7)!==6&&!S.over){hint('Travel opens when the routing ends',2.5);return}
  const F=I.frames[j],dx=MM.sin(F.h),dz=MM.cos(F.h);let a;
  if(ISLV.on)a={eye:[ISLV.cam.x,ISLV.cam.y,ISLV.cam.z],tgt:[ISLV.cam.tx,ISLV.cam.ty,ISLV.cam.tz]};
  else if(W&&W.cv>=CV_ISL&&W.seed===ISL.seed&&W.idx<ISL_N){const H=I.frames[W.idx],e=toWorld(H,cam.x,cam.z),t=toWorld(H,cam.tx,cam.tz);a={eye:[e[0],cam.y,e[1]],tgt:[t[0],cam.ty,t[1]]}}
  else{const C=I.club;a={eye:islEyeAt(I,C.x,C.z,120),tgt:[C.x+MM.sin(I.hIn)*300,0,C.z+MM.cos(I.hIn)*300]}}
  islMapClose(false);$('card').classList.add('hide');islView(I);ISLV.on=true;document.body.classList.add('isl-fly');$('title').classList.add('hide');
  const b={eye:islEyeAt(I,F.ox-dx*16,F.oz-dz*16,5),tgt:[F.ox+dx*50,I.hbW(F.ox+dx*50,F.oz+dz*50)+1,F.oz+dz*50]},d=MM.hyp(b.eye[0]-a.eye[0],b.eye[2]-a.eye[2]);
  islFly(a,b,FT_T,Math.max(40,d*.16),()=>islFree(j))}
function islFree(j){const seed=ISL.seed;ISLV.on=false;document.body.classList.remove('isl-fly');islPrep(seed,6|j<<3,islDayNow());S.ftArrive=true;startRound(1,null,null,oppArg())}
function islKey(){if(IMAP.open){islMapClose();return true}if(!tryOn())return false;if(S.mode!=='title'&&W&&S.cv>=CV_ISL){ISL.seed=S.seed;islMapWire();islMapOpen('round');return true}return false}
function islCard(code){if(S.cv<CV_ISL||S.kind<2||S.carDone&&S.carDone.po)return;const news=islRoundDone(code),free=(S.kind&7)===6,j=free?S.kind>>3:-1,body=$('cardBody');$('btnNew').classList.add('hide');
  let h='<div class="sotr islCardRow"><b>'+esc(islName(S.seed))+'</b> · '+esc(islRoutingName(S.kind,S.n))+(news.length?' · <span style="color:var(--good)">new hole record'+(news.length>1?'s':'')+': '+news.map(esc).join(', ')+'</span>':'');
  if(free){const r=islHR(S.seed,j);h+=r?' · record '+r.s:''}h+='<div class="row" style="margin:8px 0 0"><button id="islBack" class="big">Island map</button>'+(!free?'<button id="islShareC" class="sec">Island link</button>':'')+(free?'<button id="islAgain" class="sec">Play it again</button>'+islClueBtn(j):'')+'</div></div>';
  const box=document.createElement('div');box.innerHTML=h;if(typeof body.prepend==='function')body.prepend(box);else body.appendChild(box);$('islBack').onclick=()=>{AU.play('ui');islFromCard()};{const cq=$('islClueC');if(cq)cq.onclick=()=>{AU.play('ui');islWalk(+cq.dataset.k)}}{const sc=$('islShareC');if(sc)sc.onclick=()=>{AU.play('ui');islShare(S.seed,S.n===9&&!S.golfer?code:null)}}const ag=$('islAgain');if(ag)ag.onclick=()=>{AU.play('ui');$('card').classList.add('hide');S.over=false;islFree(j)}}
function islFromCard(){const I=islandOf(S.seed);ISL.seed=S.seed;$('card').classList.add('hide');const F=W&&W.idx<ISL_N?I.frames[W.idx]:null;if(W)freeMeshes(W);W=null;$('hud').classList.remove('on');$('bottom').classList.remove('on');$('tools').classList.remove('on');S.mode='title';S.over=false;
  islView(I);ISLV.on=true;islMapWire();document.body.classList.add('isl-fly');ISLV.fl=null;ISLV.t0=performance.now();const f=F?[F.gx,I.hbW(F.gx,F.gz),F.gz]:[I.club.x,0,I.club.z];ISLV.focus=f;islMapOpen('title')}
function islPanel(){const el=$('pIsland');if(!el)return;const inp=$('islSeed');if(!inp.value)inp.value=lsGet('voxellinks.isl.last',0)||Math.max(1,(+seedIn.value|0)||1);const seed=Math.max(1,+inp.value|0),I=islandOf(seed),B=bookGet().bests||{},R=islHRGet();let held=0;for(let j=0;j<36;j++)if(R[seed+'.'+j])held++;
  $('islLine').innerHTML='<b>'+esc(islName(seed))+'</b> · '+BIOMES[I.bio].n+' · the '+esc(I.lm.name)+' · '+esc(I.architect)+'<br>'+islTodayLine(seed);
  let h='';for(const[k,n,lab]of[[2,9,'A · front nine'],[3,9,'A · back nine'],[2,18,'A · all 18'],[4,9,'B · front nine'],[5,9,'B · back nine'],[4,18,'B · all 18']]){const b=B[islBestKey(seed,n,k)];h+='<button class="sec islGo" data-k="'+k+'" data-n="'+n+'">'+lab+(b?' · best '+b.s:'')+'</button>'}
  $('islNinesP').innerHTML=h+'<button class="sec" id="islShare" onclick="AU.play(\'ui\');islShare(+document.getElementById(\'islSeed\').value||1,null)">Island link</button>';$('islRecP').textContent='Hole records on this island: '+held+' of 36 · free play keeps the island\u2019s clock (now '+islClockText()+', '+SEASONS[islSeason(seed,islDayNow())].n.toLowerCase()+'); hidden holes found: '+islFoundN(seed)+' of '+ISLAND_HIDDEN;
  el.querySelectorAll('.islGo').forEach(b=>b.onclick=()=>{AU.play('ui');ISL.seed=seed;if(typeof sheetClose==='function')sheetClose();islPlay(+b.dataset.k,+b.dataset.n)})}
function islWirePanel(){const inp=$('islSeed');if(!inp||inp.dataset.w)return;inp.dataset.w=1;inp.onchange=()=>islPanel();$('islRnd').onclick=()=>{AU.play('ui');inp.value=1+Math.floor(Math.random()*899999);islPanel()};$('islOpen').onclick=()=>{AU.play('ui');islOpen(+inp.value|0)}}
