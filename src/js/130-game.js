/* ================= game ================= */
const S={mode:'title',opp:0,cv:CV,swing:'click',sw:null,seed:1,n:9,pars:[],hi:0,strokes:[],stroke:0,club:0,sg:false,sgi:1,bag:DEFAULT_BAG.slice(),ball:0,setup:0,season:0,wear:0,casual:0,meter:0,kind:0,seat:0,look:0,mis:0,shape:0,traj:1,yaw:0,pitch:.34,ov:false,ph:0,pow:1,acc:0,mark:0,previewPow:1,ff:1,t:0,frameNow:0,shotEnd:-9,holedT:-9,wait:0,msgT:0,hintT:0,drag:null,over:false,log:[],pend:null,ghost:null,gEv:[]};
const TOUCH='ontouchstart'in window,ZC=.08,txt=(id,s)=>{const e=$(id);if(e.textContent!==s)e.textContent=s};
const relS=d=>d===0?'E':d>0?'+'+d:''+d,relC=d=>d<0?'under':d>0?'over':'even';
function msg(a,b='',d=2.4){$('msg').innerHTML=a+(b?'<small>'+b+'</small>':'');$('msg').classList.add('on');S.msgT=S.t+d}
function hint(s,d=2){$('hint').textContent=s;$('hint').classList.add('on');S.hintT=S.t+d}
function scoreName(d,strokes){if(strokes===1)return['ACE!','great'];const N={'-3':['Albatross','great'],'-2':['Eagle','great'],'-1':['Birdie','good'],'0':['Par','ui'],'1':['Bogey','bad'],'2':['Double bogey','bad'],'3':['Triple bogey','bad']};return N[d]||[relS(d),'bad']}
function bestKey(){return'voxellinks.'+(S.cv?'c'+S.cv+'.':'')+(S.kind?'k'+S.kind+'.':'')+S.seed+'.'+S.n}
function getBest(){try{const v=VS.getItem(bestKey());return v==null?null:+v}catch(e){return null}}
function setBest(v){try{const b=getBest();if(b==null||v<b)VS.setItem(bestKey(),v)}catch(e){}}
function saveRound(){if(S.scen||S.range||S.bug||S.tuned)return;try{VS.setItem('voxellinks.round',JSON.stringify({seed:S.seed,n:S.n,log:S.log,ghost:S.ghost?S.ghost.code:null,house:S.ghost&&S.ghost.house||0,gk:gkPack(S.gk),cv:S.cv,v10:S.v10?1:0,tourRound:S.tourRound,carRound:S.carRound,bag:S.bag,ball:S.ball,setup:S.setup,season:S.season,wear:S.wear,casual:S.casual,kind:S.kind,islDay:S.islDay,meter:S.meter,look:S.look,format:S.format|0,twist:S.twist|0,hand:S.hand|0,golfer:S.golfer||null,bk:S.bagKeep||null,weekly:S.weekly||null,swing:S.swingSave||null,hs:S.hs&&!S.hs.watch?{P:S.hs.P.map(p=>({name:p.name,hcp:p.hcp,seat:p.seat,look:p.look,log:p.log})),cur:S.hs.cur,order:S.hs.order}:null}))}catch(e){}}
function loadSave(){try{const v=JSON.parse(VS.getItem('voxellinks.round'));return v&&v.seed&&(HOLESC.includes(v.n)||v.n===1&&((v.cv|0)>=CV_ISL||v.kind>=2))&&Array.isArray(v.log)?v:null}catch(e){return null}}
function clearSave(){if(S.bug)return;try{VS.removeItem('voxellinks.round')}catch(e){}}
function total(){let s=0,p=0;for(let i=0;i<S.strokes.length;i++)if(S.strokes[i]!=null){s+=S.strokes[i];p+=S.pars[i]}return[s,p]}
const CADDIE={wind:.02,rise:1.5};
function playsLike(){const d=MM.hyp(W.pin.x-B.x,W.pin.z-B.z);if(!W.cv||W.cv<2||d<1)return d;const dx=(W.pin.x-B.x)/d,dz=(W.pin.z-B.z)/d,wa=(W.wind.x||0)*dx+(W.wind.z||0)*dz;return Math.max(1,d*(1-caddieWind(S.traj)*wa*gWindK())+CADDIE.rise*(W.pin.y-B.y))/(W.air&&W.air<1?airCarry():1)}
let AIRK=0;function airCarry(){if(AIRK)return AIRK;const sv=W,fly=a=>{W={flat:2,rk:ONES,bk:ONES,wind:CALM,cv:4,swell:0,air:a,pin:{x:1e6,z:1e6,y:0},tgrid:new Map(),ox:-1e9,oz:-1e9,cols:1e9,rows:1e9};return withBall(SB,()=>{place(0,0);EXACT=true;strike(CLUB_SET[13],1,0,0,0,1);let n=0;while(SB.st==='air'&&n++<4000){stepAir(DT);if(n>5&&SB.y<=BALL_R+1e-6)break}EXACT=false;return SB.z})};try{AIRK=fly(AIR_ALPINE)/fly(1)}finally{W=sv}return AIRK}
function autoClub(){autoClub0();cadAfterClub()}function autoClub0(){terrainAt(W,B.x,B.z);const d=MM.hyp(W.pin.x-B.x,W.pin.z-B.z),last=CLUBS.length-1;S.sg=false;if(TQ.ty===4||(TQ.ty===3&&d<20)){S.club=last;return}
  if(W.cv>=3&&d<=SG.range){S.sg=true;S.sgi=sgDefault(TQ.ty,d);return}const de=playsLike();S.club=0;for(let i=last-1;i>=0;i--)if(ownTotal(CLUBS[i])>=de*1.02){S.club=i;break}}
function aimPin(){const c=curClub(),d=MM.hyp(W.pin.x-B.x,W.pin.z-B.z);let tx=W.pin.x,tz=W.pin.z;if(!c.putter&&d>ownTotalT(c,S.traj)*1.05){const t=lineTarget(ownTotalT(c,S.traj));if(t){tx=t.x;tz=t.z}}S.yaw=MM.atan2(tx-B.x,tz-B.z);S.autoAim=true;if(S.gentle){gentleAim();if(S.gentleSafe)return}
  if(!c.putter&&B===PB&&S.mode==='aim'){const ta=S.yaw;for(let i=0;i<3;i++){const P=predictShot(true,true);if(!P||P.carryD<5)break;const ca=MM.atan2(P.carry[0]-B.x,P.carry[1]-B.z),err=((ca-ta+Math.PI)%TAU+TAU)%TAU-Math.PI;if(Math.abs(err)<.002)break;S.yaw-=err*.9}}}
function lieText(){if(!W||W.cv<2||curClub().putter)return'';const st=stanceAt(PB.x,PB.z,S.yaw),sd=Math.round(st.side/DEG),al=Math.round(st.along/DEG);let t='';if(W.cv>=3){const ls=withBall(PB,()=>lieState());if(ls.plug)t+=' · plugged';else if(ls.sit)t+=' · sitting down';else if(TQ.ty<=1)t+=' · sitting up'}if(Math.abs(sd)>=2)t+=' · ball '+(sd>0?'above':'below')+' feet '+Math.abs(sd)+'°';if(Math.abs(al)>=2)t+=' · '+(al>0?'uphill':'downhill')+' '+Math.abs(al)+'°';return t}
function windNote(k0){if(!W||!W.swell||W.wind.s<.5)return'';const f=windAt(k0+SWING_TICKS);return f<1-W.swell*.4?'lull':f>1+W.swell*.4?'gust':''}
function windDrift(t){return W&&W.swell?t+W.swell*WIND.period/TAU*(MM.cos(W.phase)-MM.cos(TAU*t/WIND.period+W.phase)):t}
const windC=$('windC'),wctx=windC.getContext('2d');
function drawWindTrace(){const on=W&&W.cv>=3&&W.swell>0&&W.wind.s>=.5&&S.mode!=='title';windC.classList.toggle('hide',!on);if(!on)return;const g=wctx,w=90,h=26,t0=curTick()*DT,sw=W.swell,f=t=>1+sw*MM.sin(TAU*(t0+t)/WIND.period+W.phase),y=v=>h/2-(v-1)/sw*(h/2-3);
  g.clearRect(0,0,w,h);g.fillStyle=TK('g300',.3);for(let x=0;x<w;x++){if(f(x/w*WIND.ahead)<1-sw*.4)g.fillRect(x,0,1,h)}g.strokeStyle=TK('white',.25);g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
  g.strokeStyle=TK('white');g.lineWidth=1.5;g.beginPath();for(let x=0;x<=w;x++){const v=y(f(x/w*WIND.ahead));x?g.lineTo(x,v):g.moveTo(x,v)}g.stroke();const xc=SWING_TICKS*DT/WIND.ahead*w;g.fillStyle=TK('gold300');g.fillRect(xc-1,0,2,h);g.fillStyle=TK('white',.7);g.fillRect(0,0,1,h)}
function windText(){const w=W.wind;if(w.s<.5)return'Calm';const note=S.windNote&&S.windNote.txt&&S.t<S.windNote.t?' · '+S.windNote.txt:'';const rel=((w.a-(S.mode==='aim'?S.yaw:0)-Math.PI)%TAU+TAU)%TAU,q=Math.round(rel/(Math.PI/4))%8,names=['into','into, from the left','from the left','helping, from the left','helping','helping, from the right','from the right','into, from the right'];return Math.round(w.s*3.6)+' km/h '+names[q]+note}
/* ---- handicap and match play ---- */
function histGet(){try{const v=JSON.parse(VS.getItem('voxellinks.hist'));return Array.isArray(v)?v:[]}catch(e){return[]}}
function histAdd(n,d){try{const h=histGet();h.push({n,d});VS.setItem('voxellinks.hist',JSON.stringify(h.slice(-5)))}catch(e){}}
function myHandicap(){const x=myIndex();if(x!=null)return clamp(Math.round(x),0,27);const h=histGet();if(!h.length)return null;return clamp(Math.round(h.reduce((a,e)=>a+e.d*9/e.n,0)/h.length),0,27)}
function setupMatch(recvOverride){const g=S.ghost;if(!g||S.carRound||S.cup){S.match=null;return}const n=S.n,si=strokeIndex(S.seed,S.pars,S.cv),me=S.cv>=4?myIndex()??myHandicap()??(S.v10?GHOST_START_HCP:null):myHandicap(),gh=g.data.hcp;
  const sl=S.cv>=4&&n>=9?rate9(S.seed,0,S.pars,S.setup|0,S.season|0,S.wear|0,S.cv).slope/113:1;let recv=recvOverride!=null?recvOverride:(me!=null&&gh!=null?Math.round(Math.max(0,me-gh)*sl*n/(S.v10?18:9)):0);recv=clamp(recv,0,2*n);
  const given=new Array(n).fill(0);for(let k=0;k<recv;k++){const lap=Math.floor(k/n),rank=k%n+1;const h=si.indexOf(rank);if(h>=0&&lap<2)given[h]++}
  S.match={si,given,recv,me,gh}}
function ghostHoleScore(h){const L=ghostLog(h);return holeDone(L,S.pars[h])?holeStrokes(L,S.pars[h]):null}
function matchState(){const m=S.match;if(!m)return null;let up=0,played=0,decided=null;const n=S.n,res=[];
  for(let h=0;h<n;h++){const mine=S.strokes[h];if(mine==null){res.push(null);continue}const gs=ghostHoleScore(h);const net=mine-m.given[h];let r=gs==null?1:net<gs?1:net>gs?-1:0;
    if(decided)r=0;up+=r;played++;res.push(r);const rem=n-played;if(!decided&&(Math.abs(up)>rem||rem===0)){decided={up,rem,at:h,text:up===0?'Match halved':(up>0?'Won ':'Lost ')+(rem===0?(Math.abs(up)+' up'):(Math.abs(up)+'&'+rem))}}}
  const rem=n-played;return{up,played,rem,res,decided,dormie:!decided&&up!==0&&Math.abs(up)===rem&&rem>0,status:up===0?'All square':Math.abs(up)+(up>0?' UP':' DOWN')}}
function matchLine(){const ms=matchState();if(!ms)return'';if(ms.decided)return ms.decided.text+(S.hi>ms.decided.at?' · bye':'');return ms.status+(ms.rem<S.n?' · '+ms.rem+' to play':'')+(ms.dormie?' · dormie':'')}
function needHint(){const g=S.ghost,m=S.match;if(!g||!m)return;const ms=matchState();if(ms.decided)return;const gs=ghostHoleScore(S.hi);if(gs==null||g.k<(g.steps?g.steps.length:g.L.length)||GB.st!=='holed')return;
  const net=S.stroke+1-m.given[S.hi];if(net<gs)hint(gName()+' in for '+gs+' · hole this to win the hole',3);else if(net===gs)hint(gName()+' in for '+gs+' · hole this for a half',3);else if(!S.lostShown){S.lostShown=true;hint('Hole lost · playing for the card',3)}}
/* ---- house ghosts ---- */
const TIERS=[null,{n:'Caddie',ms:60,ms4:26,aim:.015,judge:.15,read:1,plan:0,putPlan:0,lay:0,wind:false,line:false,hcp:12,tsd:null},{n:'Member',ms:40,ms4:24,aim:.008,judge:.12,read:1,plan:2,putPlan:1,lay:.5,wind:false,line:true,hcp:6,tsd:1.5},{n:'Pro',ms:24,ms4:15,aim:.004,judge:.08,read:.5,plan:3,putPlan:2,lay:1,wind:true,line:true,hcp:0,tsd:.5}];
const PLANB=newBall(),CALM={x:0,z:0,s:0,a:0},znorm=R=>(R()+R()+R()-1.5)*2;
function planSim(c,pow,yaw,traj,acc,real){MM=W.M||NM;const bx=B.x,bz=B.z,bp=B.plug,bl=B.lf,sw=W.wind;if(!real)W.wind=CALM;
  const r=withBall(PLANB,()=>{place(bx,bz);if(W.cv>=4){PLANB.plug=bp;PLANB.lf=bl}PLANB.rng=mulberry32(99991);EXACT=true;strike(c,pow,acc,yaw,0,traj);EXACT=false;let n=0,treeD=null;while((PLANB.st==='air'||PLANB.st==='roll')&&n++<6000){stepOne();if(treeD==null&&PLANB.tree)treeD=MM.hyp(PLANB.x-bx,PLANB.z-bz)}const st=PLANB.st;terrainAt(W,PLANB.x,PLANB.z);return{x:PLANB.x,z:PLANB.z,st,ty:TQ.ty,treeD}});
  W.wind=sw;return r}
function lineTarget(reach){let best=null,bt=-1;for(const c of W.C){const d=MM.hyp(c.x-B.x,c.z-B.z);if(d<=reach&&c.t>bt){bt=c.t;best=c}}return best}
function steer(c,pow,yaw,traj,tx,tz,iters,real,k){let ci=c;for(let i=0;i<iters;i++){const r=planSim(CLUBS[ci],pow,yaw,traj,0,real);if(r.st==='holed')break;const dr=MM.hyp(r.x-B.x,r.z-B.z)||.01;
    yaw+=MM.atan2(tx-B.x,tz-B.z)-MM.atan2(r.x-B.x,r.z-B.z);pow=pow*MM.pow(MM.hyp(tx-B.x,tz-B.z)/dr,k);if(pow>1.02&&ci>0&&ci<7){ci--;pow=1}pow=clamp(pow,.05,1)}return{ci,pow,yaw}}
function waterNear(x,z,r){const n=Math.ceil(r/CS),i0=Math.floor((x-W.ox)/CS),j0=Math.floor((z-W.oz)/CS);for(let j=j0-n;j<=j0+n;j++)for(let i=i0-n;i<=i0+n;i++){if(i<0||j<0||i>=W.cols||j>=W.rows)continue;if(W.ty[j*W.cols+i]===7&&MM.hyp(W.ox+(i+.5)*CS-x,W.oz+(j+.5)*CS-z)<=r)return true}return false}
/* F-064 styles in the bot: aggressive never lays up on risk holes and attacks from 10% beyond reach; cautious takes a club more, keeps it low into wind and lays up near water; streaky putts by form */
const STREAK_BOT=.12,streakF=T=>T.style===3?clamp(1+STREAK_BOT*(T.form||0),.4,1.6):1;
function botPlan(T,R){terrainAt(W,B.x,B.z);const ty=TQ.ty,px=W.pin.x,pz=W.pin.z,dist=MM.hyp(px-B.x,pz-B.z),zj=znorm(R),sf=streakF(T),plan=T.p0>0&&R()<T.p0?0:T.plan;
  if(ty===4||(ty===3&&dist<20)){const c=PUTTER,L=(dist+.5)*(1+T.judge*sf*zj),ux=(px-B.x)/(dist||1),uz=(pz-B.z)/(dist||1),tx=B.x+ux*L,tz=B.z+uz*L;
    const pi=W.cv>=4?CLUBS.length-1:7,y0=MM.atan2(ux,uz),r=steer(pi,clamp(Math.sqrt(L/c.total)/PUTT[ty],.05,1),y0,1,tx,tz,T.putPlan,true,.5);return{c:pi,t:1,y:y0+(r.yaw-y0)*(1+T.read*sf*znorm(R)),p:r.pow}}
  const wedge=CLUBS.length-2;let ci=wedge;if(ty!==6){ci=0;for(let i=wedge;i>=0;i--)if(CLUBS[i].total>=dist){ci=i;break}if(T.style===2&&ci>0&&-(W.wind.x*(px-B.x)+W.wind.z*(pz-B.z))/(dist||1)>3)ci--}
  let traj=1,pow=1,yaw=0;
  const aimAt=()=>{const c=CLUBS[ci],reach=c.totalT[traj],tg=dist<=reach*(T.style===1?1.1:1.04)||!botLine(T,R)?botGreen(px,pz):(lineTarget(reach)||botGreen(px,pz)),j=1+T.judge*zj,tx=B.x+(tg.x-B.x)*j,tz=B.z+(tg.z-B.z)*j;
    yaw=MM.atan2(tx-B.x,tz-B.z);if(T.wind){const hw=-(W.wind.x*MM.sin(yaw)+W.wind.z*MM.cos(yaw));traj=hw>4?0:1}if(T.style===2&&W.cv>=4){const hw=-(W.wind.x*MM.sin(yaw)+W.wind.z*MM.cos(yaw));if(hw>3)traj=ci<=2?4:0}
    pow=clamp(MM.pow(MM.hyp(tx-B.x,tz-B.z)/c.totalT[traj],1/1.35),.15,1);const r=steer(ci,pow,yaw,traj,tx,tz,plan,T.wind,1/1.35);ci=r.ci;pow=Math.max(.15,r.pow);yaw=r.yaw};
  aimAt();if(ty===6){const pe=potEscape();if(pe){const r=steer(ci,.5,MM.atan2(pe.x-B.x,pe.z-B.z),1,pe.x,pe.z,2,T.wind,1/1.35);ci=r.ci;pow=Math.max(.15,r.pow);yaw=r.yaw;traj=1}}
  const safe=BOT_SAFE&&W.cv>=6;if((T.lay>0||safe)&&(ci<=1||safe)&&ty!==6&&(safe||!(T.style===1&&W.arch&&RISK_ARCH.test(W.arch.n)))){for(let step=0;step<(safe?6:2);step++){let bad=false;for(const a of[0,-.7,.7]){const r=planSim(CLUBS[ci],pow,yaw,traj,a,T.wind);if(r.st==='water'||r.st==='oob'||r.ty===6||T.style===2&&waterNear(r.x,r.z,20))bad=true}
      if(!bad||(!safe&&R()>=T.lay)||ci>=CLUBS.length-2)break;ci++;aimAt()}}
  if(W.cv>=6&&ty!==6){const wet=()=>{const r=planSim(CLUBS[ci],pow,yaw,traj,0,T.wind);return r.st==='water'||r.st==='oob'};if(wet()){const s0=[ci,pow,yaw,traj];let ok=false;for(let n=0;n<BOT_UP&&ci>0&&!ok;n++){ci--;aimAt();ok=!wet()}if(!ok)[ci,pow,yaw,traj]=s0}}
  if(W.cv>=4&&ty!==6){const r=planSim(CLUBS[ci],pow,yaw,traj,0,T.wind);if(r.treeD!=null&&r.treeD<CANOPY_WARN){const c=CLUBS[ci],reach=c.totalT[3],tg=dist<=reach?{x:px,z:pz}:(lineTarget(reach)||{x:px,z:pz});yaw=MM.atan2(tg.x-B.x,tg.z-B.z);traj=3;pow=clamp(MM.pow(MM.hyp(tg.x-B.x,tg.z-B.z)/reach,1/1.35),.3,1)}}
  return{c:ci,t:traj,y:yaw,p:pow}}
const ELITE={n:'Elite',ms:16,ms4:4.5,aim:.0012,judge:.035,read:.2,tsd:.3};
/* the physics bot for a skill. Classic tours (elite unset) keep v3's blend. Career and cup bots (elite) stand on BOT_K, which maps a FIELD_SCORE skill to a place on the tier ladder so the ghost shoots what the model says (measured in M3), and their habits switch at staggered points so the ladder has no cliff */
const BOT_K=[[-3,-1.2],[-2,-.7],[-1,-.1],[0,1],[2,2.8],[4,5.7],[6,9.9],[8,11.4],[10,12],[12,13.3],[14,13.8],[16,14.1],[18,14.4],[20,14.6]];
const botPos=k=>{const T=BOT_K;k=clamp(k,T[0][0],T[T.length-1][0]);for(let i=1;i<T.length;i++)if(k<=T[i][0]){const[a,p]=T[i-1],[b,q]=T[i];return p+(q-p)*(k-a)/(b-a||1)}return T[T.length-1][1]};
function tierPos(s){const P=TIERS[3],M=TIERS[2],C=TIERS[1];
  if(s<0){const t=clamp(-s/3,0,1),mix=(x,y)=>lerp(x,y,t);return{ms:mix(P.ms,ELITE.ms),ms4:mix(P.ms4,ELITE.ms4),aim:mix(P.aim,ELITE.aim),judge:mix(P.judge,ELITE.judge),read:mix(P.read,ELITE.read),plan:3,putPlan:2,lay:1,wind:true,line:true,tsd:mix(P.tsd,ELITE.tsd)}}
  if(s<=6){const t=s/6,mix=(x,y)=>lerp(x,y,t);return{ms:mix(P.ms,M.ms),ms4:mix(P.ms4,M.ms4),aim:mix(P.aim,M.aim),judge:mix(P.judge,M.judge),read:mix(P.read,M.read),plan:t<.5?3:2,putPlan:t<.5?2:1,lay:mix(1,.5),wind:t<.5,line:true,tsd:mix(P.tsd,M.tsd)}}
  const t=clamp((s-6)/10,0,1),mix=(x,y)=>lerp(x,y,t);return{ms:mix(M.ms,C.ms),ms4:mix(M.ms4,C.ms4),aim:mix(M.aim,C.aim),judge:mix(M.judge,C.judge),read:mix(M.read,C.read),plan:t<.4?2:1,p0:clamp((t-.4)/.6,0,1),putPlan:t<.6?1:0,lay:mix(.5,0),wind:false,line:t<.8,tsd:t<.5?mix(1.5,3):null}}
function tierFor(skill,name,id,elite){if(elite)return Object.assign(tierPos(botPos(skill)),{n:name,id,hcp:clamp(Math.round(skill),0,27),skill});
  const k=clamp(skill,-2,20),a=k<=6?TIERS[3]:TIERS[2],b=k<=6?TIERS[2]:TIERS[1],t=k<=6?clamp((k-0)/6,0,1):clamp((k-6)/10,0,1),near=t<.5?a:b,mix=(x,y)=>lerp(x,y,t);
  return{n:name,id,ms:mix(a.ms,b.ms),ms4:mix(a.ms4,b.ms4),aim:mix(a.aim,b.aim),judge:mix(a.judge,b.judge),read:mix(a.read,b.read),plan:near.plan,putPlan:near.putPlan,lay:near.lay,wind:near.wind,line:near.line,tsd:near.tsd,hcp:clamp(Math.round(k),0,27),skill:skill}}
function botHole6(h,T,R0){MM=W.M||NM;const par=S.pars[h],L=[];
  withBall(GB,()=>{for(let g=0;g<40;g++){const R=mulberry32((R0()*4294967296)>>>0),P=holePath(L,W.pin);if(P.T.holed||P.T.n>=capFor(par,W.cv))break;place(P.pos[0],P.pos[1]);GB.plug=P.plug;GB.lf=P.lf;
      if(S.season===3&&P.lf!==2&&P.T.n>0){terrainAt(W,GB.x,GB.z);if((TQ.ty===2||TQ.ty===3)&&wearAt(GB.x,GB.z)){const d=placeSpot(GB.x,GB.z);L.push({kind:3,dx:d[0],dz:d[1]});continue}}
      {const ub=botBunker(L);if(ub){L.push(ub);continue}}BOT_SAFE=W.cv>=6&&botPens(L)>=2;/* version 4 timing (ms4) keeps each tier at its v3 level now that timing also costs contact */const sh=botPlan(T,R),c=CLUBS[sh.c],pt=c.putter,ms=T.ms4*(pt?streakF(T):1),yq=qYaw(sh.y+T.aim*znorm(R)),pq=qPow(clamp(sh.p+ms/(pt?2000:(W.cv>=9||W.v10)?1150*BOT_POW9:1150)*znorm(R),.05,1)),zn=znorm(R);let aq,mq=0;
      if(pt)aq=qAcc(clamp(ms/51.75*zn,-1.6,1.6));else{const raw=ms/34.5*zn/zoneK(GB,c,uYaw(yq));aq=qAcc(clamp(raw,-1,1));mq=qMis(Math.sign(raw)*clamp((Math.abs(raw)-1)/MISHIT_SPAN,0,1))}
      let k0=0;if(W.swell){const lull=((((1.5*Math.PI-W.phase)/TAU)*WIND.ticks)%WIND.ticks+WIND.ticks)%WIND.ticks;k0=T.tsd==null?Math.floor(R()*WIND.ticks):Math.round(lull-SWING_TICKS+znorm(R)*T.tsd/DT);k0=((k0%WIND.ticks)+WIND.ticks)%WIND.ticks}
      const e={kind:0,c:c.id,s:0,t:sh.t,y:yq,p:pq,a:aq,m:mq,r:0,x:0,z:0,k:k0,g:false,pv:false,mu:false},t=holeTally(L.concat([e]))[L.length],start=P.pos.slice();
      GB.rng=mulberry32(shotSeed(S.seed,h,t.no,t.att));GB.k0=k0;GB.ballType=0;strike(c,uPow(pq),uAcc(aq),uYaw(yq),0,sh.t,uMis(mq));settle();const st=GB.st;
      if(st==='holed'){e.r=1;e.x=qPos(W.pin.x);e.z=qPos(W.pin.z)}else if(st==='oob'){e.r=3;e.x=qPos(start[0]);e.z=qPos(start[1])}
      else if(st==='water'){const opts=reliefOptions(reliefCtx('water',[GB.dx,GB.dz],start)),b=W.cv>=6?botRelief(opts,L,start):opts.reduce((a,o)=>o.exp<a.exp-1e-9?o:a);e.r=2;e.o=b.o;if(b.o===1||b.o===2){e.ox=qPos(b.spot[0]);e.oz=qPos(b.spot[1])}e.x=qPos(b.fin[0]);e.z=qPos(b.fin[1])}
      else{e.r=0;e.x=qPos(GB.x);e.z=qPos(GB.z);e.g=!!GB.plug}L.push(e)}place(0,0)});return L}
function botHole(h,ti){MM=W.M||NM;const T=typeof ti==='number'?TIERS[ti]:ti,tid=typeof ti==='number'?ti:(T.id|0),R=mulberry32((Math.imul(S.seed,-1640531535)^Math.imul(h+1,40503)^Math.imul(tid,97))|0),par=S.pars[h],L=[];if(S.cv>=4)return botHole6(h,T,R);
  withBall(GB,()=>{let x=0,z=0;for(let g=0;g<31;g++){place(x,z);if(holeStrokes(L)>=par*3)break;
      const sh=botPlan(T,R),pt=CLUBS[sh.c].putter,yq=qYaw(sh.y+T.aim*znorm(R)),pq=qPow(clamp(sh.p+T.ms/(pt?2000:1150)*znorm(R),.05,1)),aq=qAcc(clamp(T.ms/(pt?51.75:34.5)*znorm(R),-1.6,1.6));
      let k0=0;if(W.swell){const lull=((((1.5*Math.PI-W.phase)/TAU)*WIND.ticks)%WIND.ticks+WIND.ticks)%WIND.ticks;k0=T.tsd==null?Math.floor(R()*WIND.ticks):Math.round(lull-SWING_TICKS+znorm(R)*T.tsd/DT);k0=((k0%WIND.ticks)+WIND.ticks)%WIND.ticks}
      GB.rng=mulberry32(shotSeed(S.seed,h,ghostStrokeNo(L,L.length)));GB.k0=k0;GB.ballType=0;GB.plug=L.length?!!L[L.length-1].g:false;strike(CLUBS[sh.c],uPow(pq),uAcc(aq),uYaw(yq),0,sh.t);settle();
      const[px,pz,r]=resolvedPos(),e={c:CLUBS[sh.c].id,s:0,t:sh.t,y:yq,p:pq,a:aq,r,x:qPos(px),z:qPos(pz),k:k0,g:!!GB.plug};L.push(e);if(r===1)break;x=uPos(e.x);z=uPos(e.z)}place(0,0)});
  return L}
function ghostLog(h){const g=S.ghost;if(!g)return[];if(g.house&&!g.data.log[h]){const sv=W;if(!holeIs(W,h))W=genHole(S.seed,h,S.pars[h],S.cv,S.setup,S);g.data.log[h]=withBag(botBag(g.house),()=>botHole(h,g.house));W=sv}return g.data.log[h]||[]}
const gName=()=>S.ghost&&S.ghost.name||'Ghost',gNamed=()=>S.ghost&&S.ghost.house&&S.ghost.house.skill!=null,gRef=()=>S.ghost&&S.ghost.house?(gNamed()?'':'the ')+S.ghost.name:'the ghost',gRefC=()=>S.ghost&&S.ghost.house?(gNamed()?'':'The ')+S.ghost.name:'The ghost';
/* ---- ghost ---- */
const resCode=st=>st==='holed'?1:st==='water'?2:st==='oob'?3:0;
function dropPoint(){MM=W.M||NM;let x=B.dx,z=B.dz,pi=-1,bd=1e9;W.PD.forEach((p,i)=>{const e=W.ed(p,x,z);if(e<bd){bd=e;pi=i}});if(pi>=0&&W.PD[pi].ring){const d=W.PD[pi].drop;return[d.x,d.z]}
  if(pi>=0){const p=W.PD[pi];let dx=x-p.x,dz=z-p.z,l=MM.hyp(dx,dz)||1;dx/=l;dz/=l;for(let k=0;k<24;k++){terrainAt(W,x,z);if(W.ed(p,x,z)>1.55&&TQ.ty!==7&&TQ.h>p.level+.15&&!oob(W,x,z))break;x+=dx*1.5;z+=dz*1.5}}return[x,z]}
function resolvedPos(){const r=resCode(B.st);if(r===1)return[W.pin.x,W.pin.z,r];if(r===2){const[x,z]=dropPointLive();return[x,z,r]}if(r===3)return[B.sx,B.sz,r];return[B.x,B.z,r]}
function ghostStrokeNo(L,k){let pen=0;for(let i=0;i<k;i++)if(L[i].r===2||L[i].r===3)pen++;return k+1+pen}
function ghostReset(h){const g=S.ghost;if(!g)return;if(S.cv>=4)return ghostReset6(h);g.k=0;g.L=ghostLog(h);withBall(GB,()=>place(0,0));GB.st=g.L.length?'rest':'holed';if(g.house){g.verified[h]=true;return}
  g.verified[h]=withBall(GB,()=>{let x=0,z=0,ok=true;for(let k=0;k<g.L.length;k++){const s=g.L[k];place(x,z);GB.rng=mulberry32(shotSeed(S.seed,h,ghostStrokeNo(g.L,k)));GB.k0=s.k||0;GB.ballType=g.data.ball||0;GB.plug=k?!!g.L[k-1].g:false;strike(clubById(s.c),uPow(s.p),uAcc(s.a),uYaw(s.y),s.s,s.t);settle();
      const[px,pz,r]=resolvedPos();if(r!==s.r||(r===2?!dropPointOK(s):MM.hyp(px-uPos(s.x),pz-uPos(s.z))>1))ok=false;x=uPos(s.x);z=uPos(s.z)}place(0,0);return ok});GB.st=g.L.length?'rest':'holed'}
function ghostFire(){const g=S.ghost;if(g&&S.cv>=4)return ghostFire6();if(!g||g.k>=g.L.length||GB.st==='holed')return;const s=g.L[g.k];S.gYaw=uYaw(s.y);S.gPow=uPow(s.p);withBall(GB,()=>{GB.rng=mulberry32(shotSeed(S.seed,S.hi,ghostStrokeNo(g.L,g.k)));GB.k0=s.k||0;GB.ballType=g.data.ball||0;GB.plug=g.k?!!g.L[g.k-1].g:false;strike(clubById(s.c),uPow(s.p),uAcc(s.a),uYaw(s.y),s.s,s.t)});g.k++}
function ghostSettleShot(){if(S.cv>=4)return ghostSettle6();const g=S.ghost,s=g.L[g.k-1];if(!s)return;if(s.r===1){GB.st='holed';S.gEv.push('cup')}else withBall(GB,()=>place(uPos(s.x),uPos(s.z)))}
function ghostHd(){const g=S.ghost;return g.house?{seed:S.seed,ball:0,seat:0,casual:0,season:S.season,hand:S.hand|0}:g.data}
function ghostReset6(h){const g=S.ghost;g.k=0;g.L=ghostLog(h);const R=holeReplay(g.L,h,ghostHd()),P=R.path;g.verified[h]=g.house?true:R.ok;
  g.steps=R.steps.map((st,i)=>{const nx=R.steps[i+1];return{o:st.o,seed:st.seed,mis:st.mis,next:nx?nx.o.start:null,after:nx?null:P.T.holed?'holed':P.pos}});withBall(GB,()=>place(0,0));GB.st=g.steps.length?'rest':'holed'}
function ghostFire6(){const g=S.ghost;if(!g.steps||g.k>=g.steps.length||GB.st==='holed')return;const st=g.steps[g.k],e=st.o.e;S.gYaw=uYaw(e.y);S.gPow=uPow(e.p);S.gStep=st;
  withBall(GB,()=>{place(st.o.start[0],st.o.start[1]);GB.plug=st.o.plug;GB.lf=st.o.lf;GB.rng=mulberry32(st.seed);GB.k0=e.k||0;GB.ballType=ghostHd().ball|0;GB.hand=ghostHd().hand|0;strike(clubById(e.c),uPow(e.p),uAcc(e.a),uYaw(e.y),e.s,e.t,st.mis)});g.k++}
function ghostSettle6(){const g=S.ghost,st=g.steps&&g.steps[g.k-1];if(!st)return;const to=st.next||st.after;bcRival(st,to);ghostSettleKeep3();if(to==='holed'){GB.st='holed';S.gEv.push('cup')}else if(to)withBall(GB,()=>place(to[0],to[1]));if(st.o.e.r===2||st.o.e.kind===1)S.gEv.push('splash')}
function ghostResume(n){const g=S.ghost;if(!g||!g.steps)return;g.k=Math.min(n,g.steps.length);if(g.k){const st=g.steps[g.k-1],to=st.next||st.after;if(to==='holed')GB.st='holed';else if(to)withBall(GB,()=>place(to[0],to[1]))}}
function ghostHoleStrokes(h,played){const L=ghostLog(h);if(played==null)return holeStrokes(L);if(S.cv>=4){const g=S.ghost;if(!played||!g.steps)return 0;const T=holeTally(L,ghostHd().seat|0);let i=g.steps[Math.min(played,g.steps.length)-1].o.k;while(i+1<L.length&&L[i+1].kind!==0)i++;return T[i].n}let s=0;for(let i=0;i<Math.min(played,L.length);i++)s+=1+(L[i].r===2||L[i].r===3?1:0);return s}
/* ---- shot lab ---- */
function shotList(){if(S.cv>=4)return shotList6();const out=[];for(let h=0;h<S.n;h++){const L=S.log[h]||[];if(!L.length)continue;const pin=holePlan(S.seed,h,S.pars[h],S.cv).pin;let x=0,z=0,stroke=0;
    for(const e of L){stroke++;const ex=uPos(e.x),ez=uPos(e.z);out.push({h,stroke,c:e.c,sx:x,sz:z,ex,ez,r:e.r,d0:MM.hyp(pin.x-x,pin.z-z),d1:MM.hyp(pin.x-ex,pin.z-ez)});if(e.r===2||e.r===3)stroke++;x=ex;z=ez}}return out}
function shotList6(){const out=[];for(let h=0;h<S.n;h++){const L=S.log[h]||[];if(!L.length)continue;const I=holeInfo(h),P=holePath(L,I.pin,S.seat|0);
    for(const o of P){const e=o.e;if(e.kind!==0)continue;out.push({h,k:o.k,stroke:o.t.no,c:e.c,sx:o.start[0],sz:o.start[1],ex:o.end[0],ez:o.end[1],r:e.r,plug:o.plug,lf:o.lf,d0:MM.hyp(I.pin.x-o.start[0],I.pin.z-o.start[1]),d1:MM.hyp(I.pin.x-o.end[0],I.pin.z-o.end[1]),mu:!!e.mu,pv:!!e.pv})}}return out}
function labStart(spec,from){if(from==='title'){S.cv=spec.cv||0;S.v10=!!spec.v10;useCalib(S.v10?CV_NOW:S.cv);S.setup=spec.setup|0;S.ball=spec.ball|0;if(spec.bag)setBag(spec.bag);if(S.cv>=4){S.season=spec.season|0;S.wear=spec.wear|0;S.kind=spec.kind|0}}S.labSaved={ghost:S.ghost,match:S.match,from};S.ghost=null;S.match=null;S.lab={spec,attempts:0,best:null,bestX:0,bestZ:0,results:[],chal:from==='title'};
  if(S.mode==='title'){S.n=spec.n;S.pars=parsFor(spec.n,S.cv,S.kind);S.strokes=new Array(spec.n).fill(null);S.log=[];$('title').classList.add('hide');$('hud').classList.add('on');$('bottom').classList.add('on');$('tools').classList.add('on');AU.init()}
  $('card').classList.add('hide');$('labList').classList.add('hide');S.over=false;$('ghostT').style.display='none';$('matchT').style.display='none';$('btnBack').classList.remove('hide');$('btnChal').classList.toggle('hide',S.lab.chal||!!S.v10);
  loadHole(spec.hole,true);labPlace();terrainAt(W,spec.sx,spec.sz);const d=Math.round(MM.hyp(W.pin.x-spec.sx,W.pin.z-spec.sz));
  if(from==='title')guideStart();msg(S.lab.chal?'Shot challenge':'Shot lab',d+' m to the pin from the '+SURF[TQ.ty].n.toLowerCase()+' · original '+labScoreText(labScore(spec.ex,spec.ez,spec.holed?1:0)),3.5);updateHud(true)}
function labPlace(){const sp=S.lab.spec;B=PB;place(sp.sx,sp.sz);if(S.cv>=4){PB.plug=!!sp.plug;PB.lf=sp.lf|0}S.stroke=sp.stroke-1;S.ph=0;S.mark=0;S.mode='aim';S.shape=0;S.traj=1;aimPin();if(sp.club!=null)selectClubId(sp.club);else autoClub();snapCam()}
function labScore(x,z,r){return r===1?0:(r===2||r===3)?Infinity:MM.hyp(W.pin.x-x,W.pin.z-z)}
function labScoreText(d){return d===0?'holed':d===Infinity?'a miss':d.toFixed(1)+' m'}
function labResolve(){const L=S.lab,r=resCode(B.st),[px,pz]=r===1?[W.pin.x,W.pin.z]:r===2?dropPoint():r===3?[B.sx,B.sz]:[B.x,B.z],d=labScore(B.x,B.z,r);L.attempts++;L.results.push(d);
  if(L.best==null||d<L.best){L.best=d;L.bestX=r===1?W.pin.x:B.x;L.bestZ=r===1?W.pin.z:B.z}
  if(r===1)AU.play('cup');else if(r===2)AU.play('splash');
  hint('Attempt '+L.attempts+': '+(r===1?'Holed!':r===2?'In the water':r===3?'Out of bounds':d.toFixed(1)+' m')+(L.best!=null&&L.attempts>1?' · best '+labScoreText(L.best):''),3);
  if(L.chal&&L.attempts>=3){S.wait=1.4;S.mode='holed';return}
  S.wait=1.2;S.next=()=>{labPlace();updateHud(true)};S.mode='wait'}
function labResult(){const L=S.lab,sp=L.spec,theirs=labScore(sp.ex,sp.ez,sp.holed?1:0),mine=L.best,win=mine<theirs?1:mine>theirs?-1:0;AU.play(win>0?'great':win<0?'bad':'ui');
  $('resName').textContent=win>0?'You win':win<0?'They win':'Draw';$('resName').className=win>0?'even':win<0?'under':'over';$('resSub').textContent='Your best: '+labScoreText(mine)+' · their shot: '+labScoreText(theirs);
  $('resTotal').textContent='Attempts: '+L.results.map(labScoreText).join(' · ');$('resMatch').style.display='none';$('btnCont').textContent='Done';$('result').classList.remove('hide');S.over=true;S.mode='result'}
function labExit(){const sv=S.labSaved;S.lab=null;S.ghost=sv.ghost;S.match=sv.match;$('btnBack').classList.add('hide');$('btnChal').classList.add('hide');$('result').classList.add('hide');S.over=false;
  if(sv.from==='card'){$('ghostT').style.display=S.ghost?'block':'none';$('matchT').style.display=S.match?'block':'none';S.mode='result';showCard()}else $('btnMenu').onclick()}
function showLabList(){const rows=shotList(),sgs=shotsSG(S.log);let h='<table><tr><th>Hole</th><th>Stroke</th><th>Club</th><th>To pin</th><th>Finished</th><th>SG</th><th></th></tr>';
  rows.forEach((e,i)=>{h+='<tr><td>'+(e.h+1)+'</td><td>'+e.stroke+'</td><td>'+clubById(e.c).s+'</td><td>'+Math.round(e.d0)+' m</td><td>'+(e.r===1?'holed':e.r===2?'water':e.r===3?'OOB':e.d1<20?e.d1.toFixed(1)+' m':Math.round(e.d1)+' m')+'</td><td class="'+(sgs[i]&&sgs[i].sg>=0?'even':'under')+'">'+(sgs[i]?sgS(sgs[i].sg):'')+'</td><td><button class="sec" data-retry="'+i+'" style="padding:4px 10px;font-size:13px">Retry</button></td></tr>'});
  h+='</table>';$('labBody').innerHTML=h;$('labList').classList.remove('hide');S.over=true;
  $('labBody').querySelectorAll('button[data-retry]').forEach(b=>b.onclick=()=>{const e=rows[+b.dataset.retry];labStart({seed:S.seed,n:S.n,hole:e.h,stroke:e.stroke,sx:e.sx,sz:e.sz,ex:e.ex,ez:e.ez,holed:e.r===1,club:e.c,plug:e.plug,lf:e.lf,cv:S.cv,v10:S.v10,season:S.season,wear:S.wear,kind:S.kind},'card')})}
/* ---- strokes gained (F-023) ---- */
const expected=(d,ty)=>ty===4?2-MM.exp(-d/6):2.1+1.9*(1-MM.exp(-d/170))+(ty===0?.15:ty===1?.3:ty===6?.35:ty===8?.2:0);
function holeInfo(h){const k=S.seed+'/'+S.cv+'/'+(S.kind?'k'+S.kind+'/':'')+h;if(!S.hinfo)S.hinfo={};if(S.hinfo[k])return S.hinfo[k];const w=holeIs(W,h)?W:genHole(S.seed,h,S.pars[h],S.cv,S.setup,S);
  return S.hinfo[k]={ty:w.ty,cols:w.cols,rows:w.rows,ox:w.ox,oz:w.oz,pin:{x:w.pin.x,z:w.pin.z},par:w.par}}
const lieAt=(I,x,z)=>I.ty[clamp(Math.floor((z-I.oz)/CS),0,I.rows-1)*I.cols+clamp(Math.floor((x-I.ox)/CS),0,I.cols-1)];
function shotsSG6(log){const out=[];for(let h=0;h<S.n;h++){const L=log[h]||[];if(!L.length)continue;const I=holeInfo(h),par=S.pars[h],P=holePath(L,I.pin,S.seat|0);let strokes=0,first=true;
    for(let i=0;i<P.length;i++){const o=P[i],e=o.e;if(e.kind!==0||!o.t.counts)continue;let pen=e.r===2||e.r===3?1:0,end=o.end,j=i+1;while(j<P.length&&P[j].e.kind!==0){if(P[j].e.kind===1){pen+=P[j].t.add;end=P[j].end}j++}
      const x=o.start[0],z=o.start[1],ty0=lieAt(I,x,z),d0=MM.hyp(I.pin.x-x,I.pin.z-z),holed=e.r===1||(j>=P.length&&P.T.holed&&P[P.length-1].e.kind===2),ty1=holed?4:lieAt(I,end[0],end[1]),d1=holed?0:MM.hyp(I.pin.x-end[0],I.pin.z-end[1]);
      strokes+=1+pen;const sg=expected(d0,ty0)-(holed?0:expected(d1,ty1))-1-pen,cat=ty0===4?'putt':first&&par>3?'tee':d0<=40?'short':'app';
      out.push({h,k:o.k,c:e.c,sg,cat,d0,d1,holed,pen,ty0,ty1,strokes,par,sx:x,sz:z,ex:end[0],ez:end[1],tee:first,long:first&&par>3&&e.c<=1&&!pen&&ty1<=2?MM.hyp(end[0],end[1]):0});first=false}
    if(P.length&&P[P.length-1].e.kind===2&&out.length&&out[out.length-1].h===h){const q=out[out.length-1];q.gimme=true}}return out}
function shotsSG(log){if(S.cv>=4)return shotsSG6(log);const out=[];for(let h=0;h<S.n;h++){const L=log[h]||[];if(!L.length)continue;const I=holeInfo(h),par=S.pars[h];let x=0,z=0,strokes=0;
    for(let k=0;k<L.length;k++){const e=L[k],ty0=lieAt(I,x,z),d0=MM.hyp(I.pin.x-x,I.pin.z-z),ex=uPos(e.x),ez=uPos(e.z),holed=e.r===1,pen=e.r===2||e.r===3?1:0,ty1=holed?4:lieAt(I,ex,ez),d1=holed?0:MM.hyp(I.pin.x-ex,I.pin.z-ez);
      strokes+=1+pen;const sg=expected(d0,ty0)-(holed?0:expected(d1,ty1))-1-pen,cat=ty0===4?'putt':k===0&&par>3?'tee':d0<=40?'short':'app';
      out.push({h,k,c:e.c,sg,cat,d0,d1,holed,pen,ty0,ty1,strokes,par,sx:x,sz:z,ex,ez,tee:k===0,long:k===0&&par>3&&e.c<=1&&!pen&&ty1<=2?MM.hyp(ex,ez):0});x=ex;z=ez}}return out}
function roundStats(log){const sh=shotsSG(log),st={fir:0,firN:0,gir:0,girN:0,putts:0,pen:0,longest:0,sg:{tee:0,app:0,short:0,putt:0},total:0,best:null};const girHole={};
  for(const q of sh){st.sg[q.cat]+=q.sg;st.total+=q.sg;if(q.ty0===4)st.putts++;st.pen+=q.pen;if(q.long>st.longest)st.longest=q.long;
    if(q.tee&&q.par>3){st.firN++;if(!q.pen&&(q.ty1===2||q.ty1===4||q.holed))st.fir++}if(q.strokes<=q.par-2&&(q.ty1===4||q.holed))girHole[q.h]=1;if(!st.best||q.sg>=st.best.sg)st.best=q}
  st.girN=new Set(sh.map(q=>q.h)).size;st.gir=Object.keys(girHole).length;st.shots=sh;return st}
const sgS=v=>(v>=0?'+':'')+v.toFixed(2),mS=d=>d<20?d.toFixed(1)+' m':Math.round(d)+' m';
function bestLine(q){return clubById(q.c).n+' from '+mS(q.d0)+(q.holed?' — holed':' to '+mS(q.d1))+' ('+sgS(q.sg)+')'}
/* ---- green read (F-021) ---- */
const PP={key:'',pts:[]};
function puttPath(pow){const key=PB.x.toFixed(2)+','+PB.z.toFixed(2)+','+S.yaw.toFixed(4)+','+pow.toFixed(3)+gPredK();if(PP.key===key)return PP.pts;PP.key=key;const P=[];
  withBall(PLANB,()=>{place(PB.x,PB.z);PLANB.rng=mulberry32(1);EXACT=true;PLANB.G=gNum();strike(PUTTER,pow,0,S.yaw,0,1);EXACT=false;P.push(PLANB.x,PLANB.z);let n=0;while(PLANB.st==='roll'&&n++<4000){stepOne();P.push(PLANB.x,PLANB.z)}});
  let tot=0;for(let i=2;i<P.length;i+=2)tot+=MM.hyp(P[i]-P[i-2],P[i+1]-P[i-1]);const show=Math.max(1.2,tot*.35),pts=[];let acc=0,next=.4;
  for(let i=2;i<P.length&&acc<show;i+=2){const seg=MM.hyp(P[i]-P[i-2],P[i+1]-P[i-1]);while(acc+seg>=next&&next<=show){const f=(next-acc)/(seg||1);pts.push(lerp(P[i-2],P[i],f),lerp(P[i-1],P[i+1],f));next+=.4}acc+=seg}
  PP.pts=pts;return pts}
function readPow(){const c=PUTTER;if(S.ph>0)return S.previewPow;terrainAt(W,PB.x,PB.z);return clamp(Math.sqrt((MM.hyp(W.pin.x-PB.x,W.pin.z-PB.z)+.5)/c.total)/PUTT[TQ.ty],.05,1)}
/* ---- replays (F-023 Watch) ---- */
function watchShot(owner,h,k){const L=owner==='me'?S.log[h]:ghostLog(h),e=L[k];if(!e)return;let sx=k?uPos(L[k-1].x):0,sz=k?uPos(L[k-1].z):0,sn=S.cv>=4?0:ghostStrokeNo(L,k),v6=null;if(S.cv>=4){const I=holeInfo(h),o=holePath(L,I.pin,owner==='me'?S.seat|0:0)[k];v6=o;sx=o.start[0];sz=o.start[1];sn=o.t.no}
  S.replay={ghost:S.ghost,match:S.match,hi:S.hi,name:owner==='me'?'Your':gName()+"'s"};S.ghost=null;S.match=null;$('ghostT').style.display='none';$('matchT').style.display='none';$('card').classList.add('hide');S.over=false;loadHole(h,true);
  B=PB;place(sx,sz);selectClubId(e.c);S.shape=e.s;S.traj=e.t;S.yaw=uYaw(e.y);S.stroke=sn-1;snapCam();const c=clubById(e.c),ball=owner==='me'?S.ball:(S.replay.ghost&&S.replay.ghost.data.ball)||0;if(S.reel)S.reel.pre=preSim(c,uPow(e.p),uAcc(e.a),uYaw(e.y),e.s,e.t,shotSeed(S.seed,h,sn,v6?v6.t.att:0),e.k||0,v6?v6.plug:k>0?!!L[k-1].g:false,v6?v6.lf:0,v6?uMis(e.m|0):0,owner==='me'?gAt(S.golfer,L,h,k):null);
  beginSwing({pow:uPow(e.p),onContact:()=>{B=PB;PB.rng=mulberry32(shotSeed(S.seed,h,sn,v6?v6.t.att:0));PB.k0=e.k||0;PB.ballType=ball;PB.plug=v6?v6.plug:k>0?!!L[k-1].g:false;if(v6)PB.lf=v6.lf;PB.G=owner==='me'?gAt(S.golfer,L,h,k):null;strike(c,uPow(e.p),uAcc(e.a),uYaw(e.y),e.s,e.t,v6?uMis(e.m|0):0);S.mode='shot';S.ff=1;S.shotEnd=S.t;S.shotCam=S.reel&&S.reel.pre?Object.assign(shotCamFor(S.reel.pre,c),{follow:true,t0:S.t}):{follow:true,t0:S.t};AU.play(c.putter?'putt':'hit',.8)}});
  if(!S.reel)msg('Replay',S.replay.name+' shot · hole '+(h+1)+' · '+c.n,2.5);updateHud(true)}
function replayEnd(){if(S.replay.clip)return clipEnd();if(S.replay.reel&&S.reel)return reelEnd();if(S.replay.watch!=null)return hsWatchEnd();const st=B.st;if(st==='holed'){AU.play('cup');S.holedT=S.t}else if(st==='water')AU.play('splash');S.wait=1.8;S.mode='wait';S.next=()=>{const r=S.replay;S.replay=null;if(r.fromBook){$('btnMenu').click();chTab(r.fromBook===true?'pBook':r.fromBook);return}S.ghost=r.ghost;S.match=r.match;S.hi=r.hi;$('ghostT').style.display=S.ghost?'block':'none';$('matchT').style.display=S.match?'block':'none';showCard(true)}}
/* ---- property map (F-030): the whole routed course, north up ---- */
function drawPropertyMap(){const cvs=$('pmapC'),n=S.n,holes=[];for(let i=0;i<n;i++)holes.push(S.kind===1&&S.cv>=4?(()=>{const H=courseP3(S.seed,S.cv).holes[i],p=holePlanP3(S.seed,i,S.cv);return{ox:H.ox,oz:H.oz,h:H.h,C:p.C,PD:p.PD,g:p.g,gR:p.gR,par:3}})():courseHole(S.seed,S.cv,S.cv>=CV_ISL?islJ(S,i):i));
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;const pts=[];for(const H of holes){for(const c of H.C){const[wx,wz]=toWorld(H,c.x,c.z);pts.push(wx,wz)}for(const p of H.PD){const[wx,wz]=toWorld(H,p.x,p.z);pts.push(wx-p.rx,wz-p.rx,wx+p.rx,wz+p.rx)}}
  const LM=S.cv>=4?landmarkOf(S.seed,S.cv):null,lmOn=LM&&!LM.none&&holes.some(H=>{const[lx,lz]=fromWorld(H,LM.x,LM.z);return MM.hyp(lx,lz)<LM_SEE});  for(let i=0;i<pts.length;i+=2){x0=Math.min(x0,pts[i]);x1=Math.max(x1,pts[i]);z0=Math.min(z0,pts[i+1]);z1=Math.max(z1,pts[i+1])}x0-=60;x1+=60;z0-=60;z1+=60;
  const Wd=Math.min(innerWidth*.94-ybWidth(),1100),Hd=Math.min(innerHeight*.78,760),sc=Math.min(Wd/(x1-x0),Hd/(z1-z0)),w=Math.ceil((x1-x0)*sc),h=Math.ceil((z1-z0)*sc),d=Math.min(devicePixelRatio||1,2);
  cvs.width=w*d;cvs.height=h*d;cvs.style.width=w+'px';cvs.style.height=h+'px';const g=cvs.getContext('2d');g.setTransform(d,0,0,d,0,0);
  const X=x=>w-(x-x0)*sc,Z=z=>h-(z-z0)*sc,pal=W.pal||{},col=t=>{const c=pal[t]||SURF[t].col;return`rgb(${c[0]*255|0},${c[1]*255|0},${c[2]*255|0})`};
  g.fillStyle=col(0);g.fillRect(0,0,w,h);const P=coursePlan(S.seed,S.cv);
  if(P.coast){g.fillStyle=TK('map-water',.95);for(let py=0;py<h;py+=5)for(let px=0;px<w;px+=5)if(seaExcess(P,x0+(w-px-2.5)/sc,z0+(h-py-2.5)/sc)>0)g.fillRect(px,py,5,5)}
  if(lmOn){/* the landmark: a marker where it stands, or an arrow at the edge pointing to it */let lx=X(LM.x),lz=Z(LM.z);const out=lx<14||lx>w-14||lz<14||lz>h-14,a=MM.atan2(lx-w/2,lz-h/2),t='the '+LM.name+(out?' '+fmtD(Math.round(MM.hyp(LM.x-(x0+x1)/2,LM.z-(z0+z1)/2)/10)*10):'');lx=clamp(lx,14,w-14);lz=clamp(lz,14,h-14);g.save();g.translate(lx,lz);if(out)g.rotate(-a+Math.PI);
    g.fillStyle=TK('k900');g.beginPath();g.moveTo(0,-9);g.lineTo(7,5);g.lineTo(-7,5);g.closePath();g.fill();g.strokeStyle=TK('white');g.lineWidth=1.5;g.stroke();g.restore();g.font='italic 12px system-ui,sans-serif';const tw=g.measureText(t).width;g.textAlign='center';g.textBaseline='middle';g.fillStyle=TK('white',.92);g.fillText(t,clamp(lx,tw/2+6,w-tw/2-6),lz>h-30?lz-16:lz+16)}
  if(P.club){const cx=X(P.club.x),cz=Z(P.club.z);g.fillStyle=TK('gold700');g.fillRect(cx-7,cz-7,14,14);g.strokeStyle=TK('white');g.lineWidth=1.5;g.strokeRect(cx-7,cz-7,14,14)}
  holes.forEach((H,i)=>{const cur=i===S.hi;g.lineCap='round';g.lineJoin='round';
    g.strokeStyle=col(2);g.lineWidth=Math.max(2,(H.par===3?22:30)*sc);g.beginPath();H.C.forEach((c,k)=>{const[wx,wz]=toWorld(H,c.x,c.z);k?g.lineTo(X(wx),Z(wz)):g.moveTo(X(wx),Z(wz))});g.stroke();
    for(const p of H.PD){const[wx,wz]=toWorld(H,p.x,p.z);g.save();g.translate(X(wx),Z(wz));g.rotate(-(p.rot-H.h));g.fillStyle=TK('map-water',.9);g.beginPath();g.ellipse(0,0,p.rx*sc,p.rz*sc,0,0,TAU);g.fill();if(p.ring){g.fillStyle=col(4);g.beginPath();g.arc(0,0,p.rx*p.ring*sc,0,TAU);g.fill()}g.restore()}
    const[gx,gz]=toWorld(H,H.g.x,H.g.z);g.fillStyle=col(4);g.beginPath();g.arc(X(gx),Z(gz),H.gR*sc,0,TAU);g.fill();
    if(cur){g.strokeStyle=TK('gold300');g.lineWidth=2;g.beginPath();g.arc(X(gx),Z(gz),H.gR*sc+4,0,TAU);g.stroke()}
    g.fillStyle=cur?TK('gold300'):TK('white',.85);g.font='bold '+Math.max(11,Math.min(16,3.2*sc*4))+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';const[tx,tz]=toWorld(H,0,-10);g.lineWidth=3;g.strokeStyle=TK('black',.45);g.strokeText(String(i+1),X(tx),Z(tz));g.fillText(String(i+1),X(tx),Z(tz))});
  const H=holes[S.hi],[bx,bz]=toWorld(H,PB.x,PB.z);g.fillStyle=TK('white');g.beginPath();g.arc(X(bx),Z(bz),3.5,0,TAU);g.fill();g.strokeStyle=TK('black');g.lineWidth=1;g.stroke();
  if(P.wind.s>.3){g.save();g.translate(w-34,34);g.rotate(-P.wind.a);g.fillStyle=TK('white',.9);g.beginPath();g.moveTo(0,-16);g.lineTo(9,4);g.lineTo(3,4);g.lineTo(3,16);g.lineTo(-3,16);g.lineTo(-3,4);g.lineTo(-9,4);g.closePath();g.fill();g.restore()}
  g.fillStyle=TK('white',.8);g.font='11px system-ui,sans-serif';g.textAlign='left';g.fillText('N ↑',10,14);
  $('pmapT').textContent=BIOMES[W.bio].n+(W.cv>=4?' · '+SEASONS[W.season].n+' · '+ARCH_STYLES[W.style].n+', '+W.architect:'')+' · '+P.wea.n+(P.wind.s>.3?' · wind '+Math.round(P.wind.s*3.6)+' km/h from '+['N','NW','W','SW','S','SE','E','NE'][Math.round(((P.wind.a+Math.PI)%TAU+TAU)%TAU/(Math.PI/4))%8]:' · calm')+(W.clock!=null?' · '+String(Math.floor(W.clock)).padStart(2,'0')+':'+String(Math.round((W.clock%1)*60)).padStart(2,'0'):'')+' · hole '+(S.hi+1)+' of '+S.n+' · V to close'}
function toggleMap(){if(!W||S.over)return;if(S.cv<2){S.ov=!S.ov;return}S.zoom=false;S.mapOpen=!S.mapOpen;$('pmap').classList.toggle('hide',!S.mapOpen);if(S.mapOpen){ybDraw();drawPropertyMap()}}
function closeMap(){S.mapOpen=false;S.zoom=false;$('pmap').classList.add('hide')}
function openZoom(){if(!W||S.over||S.mode!=='aim'||S.ph!==0)return;S.mapOpen=false;S.zoom=true;S.zoomKey='';$('pmap').classList.remove('hide');$('yb').classList.add('hide');AU.play('ui');drawZoomMap()}
function drawZoomMap(){const cvs=$('pmapC'),c=curClub(),P=c.putter?null:predictShot(false),Ps=c.putter?null:predictShot(true),dPin=MM.hyp(W.pin.x-PB.x,W.pin.z-PB.z),reach=c.putter?c.total:c.totalT[S.traj];
  const R=c.putter?clamp(Math.max(dPin*1.7,10),10,60):clamp(Math.max(reach*1.2,Math.min(dPin*1.12,reach*2.2),50),50,480),ring=R<40?5:50,Wd=Math.min(innerWidth*.94,900),Hd=Math.min(innerHeight*.78,760),sc=Math.min(Hd/(1.55*R),Wd/(2*R)),w=Math.ceil(2*R*sc),h=Math.ceil(1.55*R*sc),d=Math.min(devicePixelRatio||1,2);
  cvs.width=w*d;cvs.height=h*d;cvs.style.width=w+'px';cvs.style.height=h+'px';const g=cvs.getContext('2d');g.setTransform(d,0,0,d,0,0);const cx=w/2,cy=h*.8,sn=MM.sin(S.yaw),cs=MM.cos(S.yaw),Bx=PB.x,Bz=PB.z;
  ZM4={cx,cy,sc,cs,sn,Bx,Bz};const pt=(x,z)=>{const X=x-Bx,Z=z-Bz;return[cx+sc*(-cs*X+sn*Z),cy-sc*(sn*X+cs*Z)]};
  g.fillStyle=TK('map-bg');g.fillRect(0,0,w,h);g.save();g.transform(-sc*cs,-sc*sn,sc*sn,-sc*cs,cx+sc*(cs*Bx-sn*Bz),cy+sc*(sn*Bx+cs*Bz));g.imageSmoothingEnabled=false;if(mapImg)g.drawImage(mapImg,W.ox,W.oz,W.cols*CS,W.rows*CS);g.restore();
  g.lineCap='round';g.lineJoin='round';const line=(pts,col,wd,dash)=>{if(!pts||pts.length<4)return;g.strokeStyle=col;g.lineWidth=wd;g.setLineDash(dash||[]);g.beginPath();for(let i=0;i<pts.length;i+=2){const[x,y]=pt(pts[i],pts[i+1]);i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.setLineDash([])};
  const dot=(x,z,r,fill,stroke)=>{const[X,Y]=pt(x,z);g.fillStyle=fill;g.beginPath();g.arc(X,Y,r,0,TAU);g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke()}};
  const label=(x,z,t,col,dx,dy,al='center')=>{t=unitsText(t);const[X,Y]=pt(x,z);g.font='bold 12px system-ui,sans-serif';g.textAlign=al;g.textBaseline='middle';g.lineWidth=3;g.strokeStyle=TK('black',.6);g.strokeText(t,X+dx,Y+dy);g.fillStyle=col;g.fillText(t,X+dx,Y+dy)};
  // rings every 50 m
  g.strokeStyle=TK('white',.12);g.lineWidth=1;for(let r=ring;r<R*1.4;r+=ring){g.beginPath();g.arc(cx,cy,r*sc,0,TAU);g.stroke()}
  if(c.putter){terrainAt(W,Bx,Bz);const onG=TQ.ty===4||TQ.ty===3,pts=onG?puttPath(readPow()):null;if(pts&&pts.length>=4){for(let i=0;i<pts.length;i+=2)dot(pts[i],pts[i+1],2.2,TK('white',.9));label(pts[pts.length-2],pts[pts.length-1],'read',"#fff",10,0,'left')}else{const L=c.total*S.previewPow*S.previewPow;line([Bx,Bz,Bx+sn*L,Bz+cs*L],TK('white',.8),2,[4,4])}}
  else{if(P){const Lm=Math.max(5,P.carryD-3);line([Bx,Bz,Bx+sn*Lm,Bz+cs*Lm],TK('white',.8),2,[6,5]);const[cX,cY]=pt(P.carry[0],P.carry[1]),bl=Math.max(1.2,P.carryD*SG.band[0])*sc,bw=Math.max(.9,P.carryD*MM.tan(SG.band[1]))*sc;g.strokeStyle=TK('gold300');g.lineWidth=2;g.beginPath();g.ellipse(cX,cY,bw,bl,0,0,TAU);g.stroke();terrainAt(W,P.rest[0],P.rest[1]);const sf=P.st==='water'?'water':P.st==='oob'?'out of bounds':SURF[TQ.ty].n.toLowerCase();
      dot(P.rest[0],P.rest[1],4.5,P.st==='water'?TK('blue300'):P.st==='oob'?TK('red300'):TK('gold300'),TK('black'));label(P.carry[0],P.carry[1],'carry '+Math.round(P.carryD)+' m',TK('white'),-11,0,'right');label(P.rest[0],P.rest[1],Math.round(P.totalD)+' m · '+sf,TK('gold300'),9,0,'left')}}
  if(W.obs)for(const o of W.obs){if(MM.hyp(o.x-Bx,o.z-Bz)>R*1.5)continue;const[X,Y]=pt(o.x,o.z),hit=o.kind==='face'&&P&&P.face;g.fillStyle=hit?TK('red500'):o.kind==='rock'?TK('map-rock'):o.kind==='face'?TK('map-face'):TK('map-stone');const r=Math.max(2,(o.k==='sph'?o.r:Math.max(o.hx,o.hz))*sc);g.beginPath();g.arc(X,Y,r,0,TAU);g.fill()}if(S.ghost&&GB.st!=='holed')dot(GB.x,GB.z,4,S.ghost.best?TK('gold300',.95):TK('blue300',.95),TK('black'));
  {const[X,Y]=pt(W.pin.x,W.pin.z);g.strokeStyle=TK('white');g.lineWidth=2;g.beginPath();g.moveTo(X,Y);g.lineTo(X,Y-14);g.stroke();g.fillStyle=TK('red500');g.beginPath();g.moveTo(X,Y-14);g.lineTo(X+9,Y-10);g.lineTo(X,Y-6);g.closePath();g.fill();label(W.pin.x,W.pin.z,Math.round(dPin)+' m',TK('white'),0,12)}
  dot(Bx,Bz,4.5,TK('white'),TK('black'));
  if(W.wind.s>.3){const a=-(W.wind.a-S.yaw);g.save();g.translate(w-30,30);g.rotate(a);g.fillStyle=TK('white',.9);g.beginPath();g.moveTo(0,-14);g.lineTo(8,4);g.lineTo(3,4);g.lineTo(3,14);g.lineTo(-3,14);g.lineTo(-3,4);g.lineTo(-8,4);g.closePath();g.fill();g.restore()}
  g.fillStyle=TK('white',.7);g.fillRect(14,h-16,ring*sc,2);g.font='11px system-ui,sans-serif';g.textAlign='left';g.textBaseline='bottom';g.fillText(fmtD(ring),14,h-20);
  $('pmapT').textContent=c.putter?'Putter · drag to aim · tap to close':c.n+(c.sg?'':(S.shape?' · '+SHAPE[S.shape].n:'')+(S.traj!==1?' · '+TRAJ[S.traj].n:''))+(c.sg?' at '+Math.round((P?P.pow:1)*100)+'% ('+checkText(S.sgi)+'): ':' · full swing, pure strike: ')+(P?'carry '+Math.round(P.carryD)+' m, finish '+Math.round(P.totalD)+' m':'')+' · '+windText()+' · drag or ←→ to aim, Q/E '+(c.sg?'shot':'club')+(c.sg?'':', A/D shape')+' · tap to close'}
/* ---- the Tour (F-034) ---- */
const TOUR={events:4,holes:9,points:[100,60,40,30,25,22,20,18,16,14,12,10,8],bands:[[-1,1],[-1,1],[2,5],[2,5],[2,5],[2,5],[6,9],[6,9],[6,9],[6,9],[10,14],[10,14]]};
const FIELD_DIST=[{k:.8,p:[2,32,44,13,4,2,3],tail:7},{k:5.1,p:[1,14,43,29,9,1,4],tail:6.25},{k:16,p:[0,4,17,34,22,9,14],tail:5.33}];
const FIRST=['Ada','Tomas','Priya','Lachlan','Mei','Kofi','Rosa','Hamish','Yuki','Bram','Ngaire','Ilya','Sadie','Kwame','Leila','Orla','Dev','Tessa','Jonah','Mira','Cal','Freya','Rafael','Isla'],LASTN=['Kerr','Reyes','Nair','Boyd','Tanaka','Mensah','Alvarez','Muir','Sato','Visser','Rangi','Petrov','Lund','Asante','Haddad','Quinn','Iyer','Marlow','Berg','Novak','Fraser','Okafor','Costa','Byrne'];
const thash=(a,b=0,c=0)=>{let h=Math.imul(a|0,0x9E3779B1)^Math.imul(b+1,0x85EBCA77)^Math.imul(c+7,0xC2B2AE3D);h^=h>>>15;h=Math.imul(h,0x2C1B3C6D);h^=h>>>12;return h|0};
function tourField(tseed){const R=mulberry32(thash(tseed,1)),rr=(a,b)=>a+R()*(b-a),used=new Set(),F=[];
  TOUR.bands.forEach((band,i)=>{let f,l;do{f=FIRST[(R()*FIRST.length)|0];l=LASTN[(R()*LASTN.length)|0]}while(used.has(f)||used.has(l));used.add(f);used.add(l);F.push({id:i,name:f+' '+l,skill:Math.round(rr(band[0],band[1])*2)/2})});
  return F.sort((a,b)=>a.skill-b.skill||a.id-b.id)}
function tourSeeds(tseed,cv=3){const out=[],seen=new Set();for(let s=tseed+1;out.length<TOUR.events&&s<tseed+400;s++){const b=biomeOf(s,cv);if(seen.has(b))continue;seen.add(b);out.push(s)}return out}
function fieldDist(k){k=clamp(k,FIELD_DIST[0].k,FIELD_DIST[FIELD_DIST.length-1].k);for(let i=0;i<FIELD_DIST.length-1;i++){const a=FIELD_DIST[i],b=FIELD_DIST[i+1];if(k<=b.k){const t=(k-a.k)/(b.k-a.k);const p=a.p.map((v,j)=>lerp(v,b.p[j],t));p.tail=lerp(a.tail,b.tail,t);return p}}const l=FIELD_DIST[FIELD_DIST.length-1],p=l.p.slice();p.tail=l.tail;return p}
/* the field model on version 4 also knows the green speed (F-054) and the wear of the week (F-055; the field places in winter, F-056) */
function fieldScores(tseed,ev,seed,pars,member,cv=3,se=0,wear=0,kind=0){const R=mulberry32(thash(tseed,ev+11,member.id+3)),out=[],x4=cv>=4?STIMP_DIFF*(stimpFor(seed,cv,se)-STIMP_REF):0;for(let h=0;h<pars.length;h++){const d=holeDifficulty(seed,kind>=2?islJ({kind},h):h,pars[h],cv)+(cv>=3?PINS.diff[Math.min(ev,3)]:0)+(cv>=4?x4+(pars[h]>3?wear*(se===3?WINTER_WEAR:1):0):0),k=member.skill+(d-16)/50*2.25,p=fieldDist(k);let u=R()*p.reduce((a,b)=>a+b,0),bucket=4;for(let j=0;j<p.length;j++){if(u<p[j]){bucket=j-2;break}u-=p[j]}if(bucket===4){const w=2*(p.tail-4)+1;bucket=4+Math.floor(R()*w)}out.push(pars[h]+bucket)}return out}
function newTour(tseed){return{seed:tseed,cv:CV_NOW,isl:1,ev:0,seeds:tourSeeds(tseed,CV),field:tourField(tseed),results:[],player:[]}}
const tourCv=T=>T.cv===CV_NOW?CV:(T.cv||3),evSeason=(T,e)=>tourCv(T)>=4?SEASON_ORDER[e%4]:0,evWear=T=>tourCv(T)>=4?WEAR_LEVEL.tour:0,evScores=(T,e,m)=>{const c=tourCond(T,e);return c?islField(c,()=>fieldScores(T.seed,e,T.seeds[e],carPars(c),m,CVX,c.se,c.wear,c.kind)):fieldScores(T.seed,e,T.seeds[e],PAR9,m,tourCv(T),evSeason(T,e),evWear(T))};
const fieldById=(T,id)=>T.field.find(m=>m.id===id);
function tourPartner(T){if(T.partners&&T.partners[T.ev]!=null)return fieldById(T,T.partners[T.ev]);if(T.ev>0){const st=tourStandings(T),i=st.rows.indexOf(st.me),r=st.rows[i>0?i-1:i+1];if(r&&r.id>=0)return fieldById(T,r.id)}
  const me=myHandicap(),k=me==null?6:me;let best=null;for(const m of T.field){const d=Math.abs(m.skill-k);if(!best||d<best.d||(d===best.d&&m.skill<best.m.skill))best={m,d}}return best.m}
const ordn=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
function partnerText(T){const m=tourPartner(T);if(!T.ev)return m.name+' (hcp '+m.skill+')';const st=tourStandings(T),r=st.rows.find(r=>r.id===m.id),d=Math.round(r.pts-st.me.pts);return m.name+' ('+ordn(r.rank)+', '+(d>=0?'+':'')+d+' pts)'}
function tourStandings(T){const pars=PAR9,rows=T.field.map(m=>({name:m.name,skill:m.skill,id:m.id,ev:[],pts:0})),me={name:'You',skill:myHandicap(),id:-1,ev:[],pts:0,me:true};
  for(let e=0;e<TOUR.events;e++){const seed=T.seeds[e],res=T.results[e];const scores=[];rows.forEach(r=>{const m=fieldById(T,r.id);let sc;if(res&&res.field&&res.field[m.id]!=null)sc=res.field[m.id];else sc=evScores(T,e,m).reduce((a,b)=>a+b,0);r.ev.push(sc);scores.push({r,sc})});
    const mine=T.player[e];me.ev.push(mine==null?null:mine);if(mine!=null)scores.push({r:me,sc:mine});
    if(mine!=null){scores.sort((a,b)=>a.sc-b.sc);for(let i=0;i<scores.length;){let j=i;while(j+1<scores.length&&scores[j+1].sc===scores[i].sc)j++;const pts=TOUR.points.slice(i,j+1).reduce((a,b)=>a+b,0)/(j-i+1);for(let k=i;k<=j;k++){scores[k].r.pts+=pts;scores[k].r['pos'+e]=i+1}i=j+1}}}
  const all=rows.concat([me]);all.sort((a,b)=>b.pts-a.pts||(a.ev.reduce((x,y)=>x+(y||0),0))-(b.ev.reduce((x,y)=>x+(y||0),0)));all.forEach((r,i)=>r.rank=i+1);return{rows:all,me,done:T.player.filter(v=>v!=null).length}}
function tourSave(){try{VS.setItem('voxellinks.tour',JSON.stringify(S.tour))}catch(e){}}
function tourLoad(){try{const t=JSON.parse(VS.getItem('voxellinks.tour'));return t&&t.seed&&t.field?t:null}catch(e){return null}}
function startTour(tseed){S.tour=newTour(tseed);tourSave();refreshTitle()}
function tourEvent(){const T=S.tour;if(!T||T.ev>=TOUR.events)return;const m=tourPartner(T);T.partners=T.partners||[];T.partners[T.ev]=m.id;tourSave();S.seed=T.seeds[T.ev];seedIn.value=S.seed;S.over=false;S.recvOverride=null;S.tourRound=T.ev;S.setup=Math.min(T.ev,3);S.forceCv=T.cv===CV_NOW?CV_NOW:tourCv(T);S.season=evSeason(T,T.ev);S.wear=evWear(T);S.casual=0;S.kind=0;{const c=tourCond(T,T.ev);if(c){S.season=c.se;S.wear=c.wear;S.kind=c.kind;S.islDay=c.islDay;S.forceCv=CVX;S.twist=0;S.fmtNext={format:0,twist:0}}}startRound(TOUR.holes,null,null,tierFor(m.skill,m.name,100+m.id))}
function tourFinishRound(s){const T=S.tour;if(!T||S.tourRound==null)return;const e=S.tourRound;T.player[e]=s;const partner=T.partners&&T.partners[e]!=null?fieldById(T,T.partners[e]):tourPartner(T),pl=[];for(let i=0;i<S.n;i++)pl.push(ghostLog(i));T.results[e]={field:{[partner.id]:pl.reduce((a,L)=>a+holeStrokes(L),0)}};T.ev=Math.max(T.ev,e+1);S.tourRound=null;tourSave()}
function tourCardHtml(){const T=S.tour,st=tourStandings(T);let h='<table><tr><th>Pos</th><th style="text-align:left">Player</th><th>Hcp</th>'+T.seeds.map((sd,i)=>'<th title="'+esc(tourWhere(T,i))+'">'+(T.isl?islName(sd).replace(/ Island$/,'').slice(0,5):BIOMES[biomeOf(sd,tourCv(T))].n.slice(0,4))+'</th>').join('')+'<th>Pts</th></tr>';
  for(const r of st.rows){h+='<tr'+(r.me?' style="color:var(--acc);font-weight:600"':'')+'><td>'+r.rank+'</td><td style="text-align:left">'+r.name+'</td><td>'+(r.skill==null?'—':r.skill)+'</td>'+r.ev.map((v,e)=>'<td>'+(v==null?'·':v)+'</td>').join('')+'<td><b>'+Math.round(r.pts)+'</b></td></tr>'}
  return h+'</table>'}
