/* ===== v6 M6 · Leaders simulated: F-128. In a career event the field's top LEADERS (by the calibrated model) are played shot by shot by the bots at the level their rating implies (carBot, as your partner is), each leader's hole is played just after that hole loads (it reuses the hole you are on, so it costs only the bots' shots), and anything left in true idle time; their cards are their shots, their logs are ghosts you can watch, and their event totals are their shots. Everyone else keeps the calibrated score model. */
const LEADERS=3;
const LEAD={ms:[],msLive:[],busy:false},LEAD_IDLE=40;
function leadPick(){const C=S.car,R=S.carRound;if(!C||!R||!S.fieldCache||S.fieldCache.lead)return;const t=C.tier,e=R.e,pid=R.v8?R.pid:isMajor(t,e)?C.cur.major.partners[R.r]:C.cur.partners[e],par=S.pars.reduce((a,b)=>a+b,0);
  const rows=S.fieldCache.rows.filter(r=>r.m.id!==pid).map(r=>({r,p:r.base+r.sc.reduce((a,b)=>a+b,0)-par})).sort((a,b)=>a.p-b.p||a.r.m.id-b.r.m.id).slice(0,LEADERS);
  S.fieldCache.lead=rows.map(x=>{x.r.lead={T:carBot(C,x.r.m,e),log:[],model:x.r.sc.slice()};return x.r});leadNext()}
function leadHole(r,h){const t0=performance.now(),sv=W,svB=B,svM=MM,live=holeIs(W,h);try{if(!live)W=genHole(S.seed,h,S.pars[h],S.cv,S.setup,S);const L=withBag(botBag(r.lead.T),()=>botHole(h,r.lead.T));r.lead.log[h]=L;r.sc[h]=holeStrokes(L,S.pars[h],S.cv)}finally{W=sv;B=svB;MM=svM}(live?LEAD.msLive:LEAD.ms).push(performance.now()-t0)}
function leadTodo(){const F=S.fieldCache;if(!F||!F.lead)return null;for(let h=0;h<S.n;h++)for(const r of F.lead)if(!r.lead.log[h])return{r,h};return null}
function leadStep(dl){LEAD.busy=false;if(!S.carRound||S.mode==='title')return;const j=leadTodo();if(!j)return;if(dl&&dl.timeRemaining&&dl.timeRemaining()<LEAD_IDLE){leadNext();return}leadHole(j.r,j.h);leadNext()}
function leadNext(){if(LEAD.busy||!leadTodo())return;LEAD.busy=true;(window.requestIdleCallback?f=>requestIdleCallback(f):f=>setTimeout(f,250))(leadStep)}
function leadAt(i){const F=S.fieldCache;if(!F||!F.lead||!S.carRound||i>=S.n)return;for(const r of F.lead)if(!r.lead.log[i])leadHole(r,i)}
function leadUpTo(k){const F=S.fieldCache;if(!F||!F.lead)return;for(let h=0;h<Math.min(k,S.n);h++)for(const r of F.lead)if(!r.lead.log[h])leadHole(r,h)}
function leadResults(){const F=S.fieldCache,out={};if(!F||!F.lead)return out;leadUpTo(S.n);for(const r of F.lead)out[r.m.id]=r.sc.reduce((a,b)=>a+b,0);S.leadDone=F.lead.map(r=>({id:r.m.id,name:r.m.name,log:r.lead.log.slice(),sc:r.sc.slice(),hcp:r.lead.T.hcp,seed:S.seed,n:S.n,cv:S.cv,setup:S.setup,season:S.season,wear:S.wear,kind:S.kind,islDay:S.islDay,v10:S.v10}));return out}
function leadCardHtml(){const L=S.leadDone;if(!L||!L.length)return'';const par=S.pars.reduce((a,b)=>a+b,0);return'<div class="sub" style="text-align:left;margin:10px 0 4px;color:var(--ink)"><b>The leaders, shot by shot</b></div>'+L.map((x,i)=>{const tot=x.sc.reduce((a,b)=>a+b,0),best=x.sc.map((s,h)=>s-S.pars[h]).reduce((b,v,h,a)=>v<a[b]?h:b,0);return'<div class="sotr">'+esc(x.name)+' · '+relS(tot-par)+' ('+tot+') · '+x.sc.join(' ')+' <button class="sec" data-lw="'+i+'" data-lh="'+best+'"><svg class="ic" aria-hidden="true"><use href="#i-play"/></svg> Watch hole '+(best+1)+'</button></div>'}).join('')}
function leadCode(x){return encodeRound(x.seed,x.n,x.log,x.hcp,x.cv,{setup:x.setup,season:x.season,wear:x.wear,kind:x.kind|0,islDay:x.islDay,v10:!!x.v10,casual:0,seat:0,ball:0,bag:DEFAULT_BAG,golfer:null})}
function leadBind(el){const L=S.leadDone;if(!L)return;el.querySelectorAll('[data-lw]').forEach(b=>b.onclick=()=>{AU.play('ui');const x=L[+b.dataset.lw],h=+b.dataset.lh;watchCode(leadCode(x),h,0,'pTour')})}
/* ===== v7 M1 · One game: F-132 one ruleset, F-141 the tempo swing retires, F-138 the developer switch. Every number is Brief v7's, by the same name. A new round in every mode plays CV_NOW: version 9's flight on today's generation (numbered courses as version 7, islands as version 8's frozen layout). Internally S.cv keeps the generation version (7, or 9 on an island) and S.v10 marks the ruleset; the record writes 10. Versions 0-9 play only for replays, links, codes and seasons already under way. */
const CV_NOW=10;
const CARRY10=new Map();
function carry10(id,pow){if(pow==null)return null;const q=Math.round(clamp(pow,0,1)*255),k=id+'/'+q;if(CARRY10.has(k))return CARRY10.get(k);const c=clubById(id);if(!c||c.putter||c.sg)return null;const sv=W,svB=B,svE=EXACT;EXACT=true;
  W={flat:2,M:mathFor(9),rk:ONES,bk:ONES,wind:{x:0,z:0},cv:9,v10:true,air:1,swell:0,pin:{x:1e6,z:1e6,y:0},tgrid:new Map(),ox:-1e9,oz:-1e9,cols:1e9,rows:1e9};B=newBall();let v=null;
  try{place(0,0);strike(c,q/255,0,0,0,1);const y0=B.y;let pz=0,py=y0;while(B.st==='air'){pz=B.z;py=B.y;stepAir(DT);if(B.nb|0||B.y<=y0)break}v=Math.round((pz+(B.z-pz)*Math.min(1,(py-y0)/Math.max(1e-9,py-B.y)))*10)/10}finally{W=sv;B=svB;EXACT=svE}CARRY10.set(k,v);return v}
function avgRows10(id){const out=[];for(const R of shotsGet())for(const r of R.rows){if(col(r,'club')!==id)continue;const pw=col(r,'pow');if(pw==null||pw<TUNE.AVG_MIN_POW||(col(r,'mishit')|0)||col(r,'traj')!==1||col(r,'shape')!==0)continue;const lie=col(r,'lie');if(lie!==5&&lie!==2&&lie!==3)continue;const v=carry10(id,pw);if(v!=null)out.push(v)}return out}
const devOn=()=>{try{return VS.getItem('voxellinks.dev')==='1'}catch(e){return false}};
function devSet(v){try{VS.setItem('voxellinks.dev',v?'1':'0')}catch(e){}devApply()}
function devApply(){try{document.body.classList.toggle('dev',devOn())}catch(e){}}
/* ===== v7 M2 · The hook first: F-136 a ghost on every first tee (the link's ghost, else your version-10 best, else the house player nearest your level, net match play), F-140 a gentle first hole (the pool drops forced carries past GENTLE_CARRY; the default aim takes the safe route in gentle rounds) */
const GHOST_START_HCP=24,GHOST_TIER_CUTS=[9,3],GAP_LINE_T=300,GENTLE_CARRY=150,GENTLE_POW=[.7,.85,1];
function houseTier(){const i=myIndex();return i==null||i>=GHOST_TIER_CUTS[0]?1:i>=GHOST_TIER_CUTS[1]?2:3}
const autoEligible=()=>!!S.v10&&!S.carRound&&!S.cup&&!S.hs&&!S.scen&&S.tourRound==null&&!S.range&&!S.lab&&!S.replay;
const oppArg=()=>S.oppSel==null?-1:S.oppSel;
function autoOppFill(n){if(!S.autoPick||S.ghost)return;if(!S.casual){const b=bookBest(S.seed,n,S.cv,S.twist|0,S.format|0),d=b&&decodeRound(b.code);if(d&&d.seed===S.seed&&d.n===n&&(d.cv||0)===S.cv&&!!d.v10===!!S.v10){S.ghost={code:b.code,data:d,k:0,L:[],verified:[],best:true,name:'Best'};S.autoPick='best';if(S.gk)S.gk[0]=ghostKind1();return}}
  const t=houseTier();S.ghost={code:null,house:t,name:TIERS[t].n,data:{seed:S.seed,n,hcp:TIERS[t].hcp,log:[]},k:0,L:[],verified:[]};S.autoPick='house';if(S.gk)S.gk[0]=ghostKind1()}
function gapText(){const ms=matchState();if(!ms)return'';let me=0,gh=0;for(let h=0;h<S.n;h++){const a=S.strokes[h],b=a!=null?ghostHoleScore(h):null;if(a!=null&&b!=null){me+=a;gh+=b}}const g=gh-me,up=ms.up,w=(v,k)=>v===0?'level '+k:(v>0?'up ':'down ')+Math.abs(v)+' '+k,t=w(up,'net')+' · '+w(g,'gross');return t.charAt(0).toUpperCase()+t.slice(1)}
function gapCheck(){if(!S.v10||!S.match||S.replay||S.lab||S.range)return;const h=S.hi,L=S.log[h]||[];if(!L.length||!holeDone(L,S.pars[h]))return;S.gapDone=S.gapDone||{};if(S.gapDone[h])return;S.gapDone[h]=performance.now();const ms=matchState();if(!ms||ms.res[h]==null)return;if(ms.res[h]===1)AU.play('good',.45);lower4('Duel',gapText(),'',2.4)}
function gentleAim(){S.gentleSafe=false;if(!S.gentle||!W||B!==PB||S.mode!=='aim')return;const c0=curClub();if(c0.putter||c0.sg)return;const ok=(ci,yaw)=>GENTLE_POW.every(p=>{const r=planSim(CLUBS[ci],p,yaw,S.traj,0,true);return r.st!=='water'&&r.st!=='oob'});if(ok(S.club,S.yaw))return;
  for(let dc=0;dc<7;dc++){const ci=S.club+dc;if(ci>=CLUBS.length-1)break;for(const f of[1,.85,.7]){const t=lineTarget(ownTotalT(CLUBS[ci],S.traj)*f);if(!t)continue;const yaw=MM.atan2(t.x-B.x,t.z-B.z);if(ok(ci,yaw)){S.club=ci;S.yaw=yaw;S.gentleSafe=true;return}}}}
function forcedCarry(){const c=curClub(),d0=ownTotalT(c,S.traj)*GENTLE_POW[0],dx=MM.sin(S.yaw),dz=MM.cos(S.yaw);let far=0;for(let t=2;t<=d0;t+=2){const x=B.x+dx*t,z=B.z+dz*t;terrainAt(W,x,z);if(TQ.ty===7||oob(W,x,z))far=t}return far}
TIPS.push(['ghost',()=>S.hi===0&&S.stroke===0&&!!S.ghost&&!!S.autoPick,()=>'The ghost on the tee plays your course shot for shot']);
/* ===== v7 M3 · Read, then decide: F-134 readable cuts, F-135 the setup camera looks down the hole with a landing mark, F-137 the chip bar. Presentation only, behind Try new things (F-116); no record changes. */
const CUT_DL=.06,SAT_FLOOR=.90,STRIPE_WINTER7=.80,WINTER_SAT=.97,BEVEL_NEAR=[8,30],AIM_LOOK=.35,AIM_EASE_T=400,LAND_MIN_PX=18,SETUP_MAX=12,BANNER_LINES=1,CHIP_ROLL_T=120;
const CUT_PAIRS=[[2,0],[2,1],[0,1],[4,3],[3,0]],CUT_TONE=[1.035,.94,1,1.04,1],CUT_LIT=.8;
const satOf=(g,se,season)=>tryOn()?Math.max(SAT_FLOOR,g.sat*(season===3?WINTER_SAT:se.sat)):g.sat*se.sat;
function cutLum(rgb,bio,season){const g=GRADE[bio]||GRADE[0],se=SEASON_GRADE[season]||SEASON_GRADE[0],o=[0,0,0];for(let i=0;i<3;i++){let c=rgb[i]*1.25*CUT_LIT*EXPOSURE;const k=SHOULDER;if(c>k)c=k+(1-k)*(1-MM.exp(-(c-k)/(1-k)));c=MM.pow(Math.max(c*g.gain[i]*se.gain[i]+g.lift[i]*(1-c),0),1/g.gamma);o[i]=c}const l=.299*o[0]+.587*o[1]+.114*o[2];return(l-.5)*g.con+.5}
function cutBase(bio,season,T){const pal=BIOMES[bio]&&BIOMES[bio].pal,col=(pal&&pal[T])||SURF[T].col,o=[col[0],col[1],col[2],T];tint4({season,bio,clock:12,wear:0},0,T,0,0,o);return[o[0]*CUT_TONE[T],o[1]*CUT_TONE[T],o[2]*CUT_TONE[T]]}

const CUT_KT={"1/0":[0.887,1.02,1.051,1.02,1.03],"1/1":[1.088,1.116,0.919,0.892,1.005],"1/2":[0.874,1.051,1.036,1.025,1.025],"1/3":[1.088,1.116,0.905,0.896,1.015],"2/0":[1.025,0.887,1.099,0.956,1.046],"2/1":[0.966,0.827,1.15,1.0,1.088],"2/2":[1.02,0.878,1.116,0.956,1.046],"2/3":[0.971,0.815,1.122,1.0,1.127],"3/0":[0.947,1.133,0.76,1.046,1.173],"3/1":[0.919,1.11,0.775,1.062,1.191],"3/2":[0.807,1.209,1.0,0.951,1.078],"3/3":[0.914,1.122,0.779,1.046,1.197],"4/0":[1.116,0.783,1.144,0.985,1.015],"4/1":[1.015,0.73,1.203,1.041,1.078],"4/2":[0.811,1.083,1.138,0.985,1.015],"4/3":[1.015,0.764,1.133,1.025,1.11],"5/0":[0.98,0.815,1.127,1.0,1.11],"5/1":[1.156,0.72,0.914,1.233,1.342],"5/2":[0.98,0.795,1.138,1.01,1.116],"5/3":[0.937,0.783,1.127,1.03,1.173],"6/0":[0.84,1.116,1.02,1.015,1.03],"6/1":[0.937,1.083,0.787,1.11,1.127],"6/2":[0.836,1.138,1.01,1.015,1.025],"6/3":[0.942,1.083,0.787,1.088,1.144]};
const CUTK=new Map(),CUT_L0={},CUT_RESP=1,cutMeasured=k=>!!CUT_KT[k];
function cutKFor(bio,season){const key=bio+'/'+season;if(CUTK.has(key))return CUTK.get(key);if(CUT_KT[key]){CUTK.set(key,CUT_KT[key]);return CUT_KT[key]}const k=[1,1,1,1,1],base=[0,1,2,3,4].map(T=>cutBase(bio,season,T)),L=T=>cutLum(base[T].map(v=>v*k[T]),bio,season);
  for(let it=0;it<80;it++){let ok=true;for(const[a,b]of CUT_PAIRS){const la=L(a),lb=L(b);if(Math.abs(la-lb)>=CUT_DL)continue;ok=false;const hi=la>=lb?a:b,lo=hi===a?b:a;k[hi]=Math.min(1.3,k[hi]*1.01);k[lo]=Math.max(.75,k[lo]/1.01)}if(ok)break}CUTK.set(key,k);return k}
function cutGaps(bio,season,k){const base=[0,1,2,3,4].map(T=>cutBase(bio,season,T)),L=T=>cutLum(base[T].map(v=>v*(k?k[T]:1)),bio,season);return CUT_PAIRS.map(([a,b])=>Math.abs(L(a)-L(b)))}
function aimLookD(c,dt){const tgt=c.putter?5:tryOn()?AIM_LOOK*ownCarry(c):10;if(dt==null||S.lookD==null||S.lookClub!==c.id&&dt==null){S.lookD=tgt}else S.lookD+=(tgt-S.lookD)*Math.min(1,dt*1000/(AIM_EASE_T/3));S.lookClub=c.id;return S.lookD}
function aimLookY(c,T){if(c.putter||!tryOn())return B.y+.3;const x=B.x+MM.sin(S.yaw)*T,z=B.z+MM.cos(S.yaw)*T;terrainAt(W,x,z);return TQ.h+.3}
function landPoint(){const c=curClub();if(c.putter||c.sg||!W)return null;const cr=(c.carryT?c.carryT[S.traj]:c.carry)*(c.carry>0?ownCarry(c)/c.carry:1),dx=MM.sin(S.yaw),dz=MM.cos(S.yaw),wa=(W.wind.x||0)*dx+(W.wind.z||0)*dz,k=caddieWind(S.traj),air=W.air&&W.air<1?airCarry():1;let d=cr;
  for(let i=0;i<2;i++){terrainAt(W,B.x+dx*d,B.z+dz*d);const dh=TQ.h-B.y;d=Math.max(5,(cr*air-CADDIE.rise*dh)/Math.max(.5,1-k*wa))}const x=B.x+dx*d,z=B.z+dz*d;terrainAt(W,x,z);return{x,z,y:TQ.h,cr,d}}
function camProject(x,y,z){const fx=cam.tx-cam.x,fy=cam.ty-cam.y,fz=cam.tz-cam.z,fl=Math.hypot(fx,fy,fz)||1,f=[fx/fl,fy/fl,fz/fl];let r=[f[2],0,-f[0]];const rl=Math.hypot(r[0],r[2])||1;r=[r[0]/rl,0,r[2]/rl];const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  const vx=x-cam.x,vy=y-cam.y,vz=z-cam.z,cz=vx*f[0]+vy*f[1]+vz*f[2];if(cz<=.1)return null;const px=innerHeight/2/MM.tan(cam.fov/2);return{x:innerWidth/2-(vx*r[0]+vy*r[1]+vz*r[2])/cz*px,y:innerHeight/2-(vx*u[0]+vy*u[1]+vz*u[2])/cz*px,d:cz}}
const LAND={p:null},getW=()=>W;
function landDraw(){const el=$('landLbl');const on=tryOn()&&W&&S.mode==='aim'&&S.ph===0&&!S.photo&&!S.ov&&!S.intro&&!S.range;const p=on?landPoint():null;LAND.p=p;if(!p){if(el)el.classList.add('hide');return}
  const dd=Math.hypot(p.x-cam.x,p.y-cam.y,p.z-cam.z),px=innerHeight/2/MM.tan(cam.fov/2),r=Math.max(1.2,LAND_MIN_PX*dd/(2*px)),c=tracerCol();draw(ringMesh,M4.trs(p.x,p.y+.08,p.z,r),[c[0],c[1],c[2],.85]);
  const q=camProject(p.x,p.y,p.z);if(!el)return;if(!q){el.classList.add('hide');return}el.classList.remove('hide');const t=dN(p.cr)+(ydOn()?' yd':' m');if(el.textContent!==t)el.textContent=t;el.style.transform='translate('+Math.round(q.x)+'px,'+Math.round(q.y-r*px/dd-6)+'px) translate(-50%,-100%)'}
const chipOn=()=>tryOn()&&!!W&&S.mode!=='title';
const SHAPE_G=['—','◝','◜','◝◝','◜◜'],TRAJ_G=['Low ▃','Normal ▅','High ▇','Punch ▁','Stinger ▂'];
const CHIP={n:'',v:null,from:null,t0:0};
function chipStep(d){if(S.mode!=='aim'||S.ph!==0)return;if(S.sg)S.sgi=clamp(S.sgi+d,0,SG_SET.length-1);else S.club=clamp(S.club+d,0,CLUBS.length-1);if(S.autoAim)aimPin();AU.play('ui');buildClubs()}
function chipUpdate(){try{document.body.classList.toggle('chipbar',chipOn())}catch(e){}if(!chipOn())return;const c=curClub(),v=c.putter?null:c.sg?null:ownCarry(c);const nm=c.s+gTag(c);if(nm!==CHIP.n){CHIP.from=CHIP.v;CHIP.t0=performance.now();CHIP.n=nm;$('chipN').textContent=nm}CHIP.v=v;$('chipSh').textContent=c.putter?'':SHAPE_G[S.shape]||'';$('chipSh').title=SHAPE[S.shape].n+' · A/D';$('chipTr').textContent=c.putter?'':TRAJ_G[S.traj]||'';$('chipTr').title='Height · W/S';chipTick()}
function chipTick(){if(!chipOn())return;const el=$('chipD');if(!el)return;const v=CHIP.v;if(v==null){if(el.textContent)el.textContent='';return}const u=CHIP.from==null?1:Math.min(1,(performance.now()-CHIP.t0)/CHIP_ROLL_T),n=CHIP.from==null?v:Math.round(CHIP.from+(v-CHIP.from)*u),t=String(dN(n));if(el.textContent!==t)el.textContent=t;if(u>=1)CHIP.from=null}
let CHIP_HINT=0;function chipHint(t,sec){const el=$('chipHint');if(!el)return;el.textContent=t;el.classList.add('on');CHIP_HINT=performance.now()+sec*1000;setTimeout(()=>{if(performance.now()>=CHIP_HINT-5)el.classList.remove('on')},sec*1000)}
function chipWire(){const ch=$('chip');if(!ch||ch.dataset.w)return;ch.dataset.w=1;$('chipL').onclick=e=>{e.stopPropagation();chipStep(-1)};$('chipR').onclick=e=>{e.stopPropagation();chipStep(1)};ch.addEventListener('wheel',e=>{e.preventDefault();chipStep(e.deltaY>0?1:-1)},{passive:false});
  ch.addEventListener('mouseenter',()=>{$('bottom').classList.add('chipOpen');if(!CHIP_HINT||performance.now()>CHIP_HINT)chipHint('Q/E or the wheel: club · A/D: shape · W/S: height',2.5)});$('bottom').addEventListener('mouseleave',()=>$('bottom').classList.remove('chipOpen'));ch.addEventListener('click',e=>e.stopPropagation())}
function hbarShow(i,sub){const el=$('hbar');if(!el)return;let t=holeTitle6(i)+' · '+fmtD(Math.round(W.len));if(i===0&&S.autoPick&&S.ghost&&S.match)t+=' · '+gName()+' · '+(S.match.recv?'you get '+S.match.recv:'no strokes');el.textContent=t;el.classList.add('on');clearTimeout(hbarShow.t);hbarShow.t=setTimeout(()=>el.classList.remove('on'),4000);try{const d=document.createElement('div');d.innerHTML=sub||'';$('holeT').title=d.textContent}catch(e){}}
/* ===== v7 M4 · Islands are the game: F-127 the tour and the career visit islands, F-133 the daily, the weekly and the cup on islands.
   One rule: a seed is an island (the same number, the same biome), so a home course number becomes a home island and today's date becomes today's island. New seasons and new dailies play island routings on version 10; anything under way keeps its course and its version. */
const LAUNCH_DAY7=271 ,DAILY_NINES=[2,3,4,5] ,MAJOR_KINDS=[2,4] ,CAR_YEAR_DAYS=ISLAND_YEAR*4;
const islDayOfDate=dt=>clamp(Math.round((Date.UTC(dt.getFullYear(),dt.getMonth(),dt.getDate())-Date.UTC(2026,0,1))/864e5),0,65535);
const evKind=e=>e%2?4:2 ;
function islField(cond,f){if(!cond||!(cond.cv>=CV_ISL))return f();const d0=ISL_DAY;ISL_DAY=cond.islDay|0;try{return f()}finally{ISL_DAY=d0}}
const alongWindIsl=(seed,j,day)=>{const I=islandOf(seed),F=I.frames[j],w=islDayOf(seed,day).wind,dx=F.gx-F.ox,dz=F.gz-F.oz,l=MM.hyp(dx,dz)||1;return(w.x*dx+w.z*dz)/l};
const carPars=cond=>cond&&cond.cv>=CV_ISL?islPars(cond.n,cond.kind):cond&&cond.n===18?PAR18_4:PAR9;
const carIsl=C=>!!(C&&C.cur&&C.cur.isl&&C.cur.cv===CV_NOW);
const carDay=(C,t,e,r)=>LAUNCH_DAY7+(thash(C.cur.ss,t*8+e,3)>>>0)%CAR_YEAR_DAYS+(r|0);
const carKind=(t,e,r)=>isMajor(t,e)?MAJOR_KINDS[r|0]:evKind(e);
function carCondIsl(C,t,e,r){const seed=C.cur.tiers[t].seeds[e],day=carDay(C,t,e,r),k=carKind(t,e,r),c=islCond(seed,day),maj=isMajor(t,e);return{setup:maj?(r?3:2):c.setup,se:c.season,wear:c.wear,n:maj?18:9,cv:CVX,kind:k,islDay:day,v10:1}}
const islLine=s=>{const M=islMeta(s),st=ARCH_STYLES[M.style];return esc(islName(s))+' #'+s+' · '+BIOMES[biomeOf(s,CV_ISL)].n+' · <span style="color:'+st.col+'">'+st.n+'</span>, '+esc(M.architect)};
const carWhere=(C,t,e,r)=>{const sd=C.cur.tiers[t].seeds[e];if(!carIsl(C))return courseLine(sd);const c=carCondIsl(C,t,e,r||0);return islLine(sd)+' · '+islRoutingName(c.kind,c.n)};
const carWhereShort=(C,t,e,r)=>{const sd=C.cur.tiers[t].seeds[e];if(!carIsl(C))return BIOMES[biomeOf(sd,4)].n+' ('+SEASONS[SEASON_ORDER[e]].n.toLowerCase()+')';const c=carCondIsl(C,t,e,r||0);return islName(sd)+', '+islRoutingName(c.kind,c.n).replace(/^Routing/,'routing')+' ('+SEASONS[c.se].n.toLowerCase()+')'};
const cupCond=C=>{if(!carIsl(C))return{setup:2,se:1,wear:WEAR_LEVEL.cup,n:9,cv:4};const d=carDay(C,3,0,0),day=d-islWd(d),c=islCond(C.home,day);return{setup:2,se:c.season,wear:WEAR_LEVEL.cup,n:9,cv:CVX,kind:2,islDay:day,v10:1}};
const tourDay=(T,e)=>LAUNCH_DAY7+(thash(T.seed,e,5)>>>0)%CAR_YEAR_DAYS;
const tourCond=(T,e)=>{if(!T.isl)return null;const c=islCond(T.seeds[e],tourDay(T,e));return{setup:Math.min(e,3),se:c.season,wear:c.wear,n:9,cv:CVX,kind:evKind(e),islDay:tourDay(T,e),v10:1}};
const tourWhere=(T,e)=>{const sd=T.seeds[e];if(!T.isl)return'course #'+sd+(tourCv(T)>=4?' · '+SEASONS[evSeason(T,e)].n:'');const c=tourCond(T,e);return islName(sd)+' #'+sd+' · '+islRoutingName(c.kind,9)+' · '+SEASONS[c.se].n};
const dailyOnIsl=(day=islDayNow())=>day>=LAUNCH_DAY7;
const dailyIsl=(day=islDayNow())=>{const dt=islDate(day);return{seed:seedOfDate(dt),kind:DAILY_NINES[islWd(day)%4],day,n:9}};
const weekIsl=(wk=isoWeek())=>{const t=new Date(Date.UTC(wk.y,0,4));const mon=new Date(t.getTime()+((wk.w-1)*7-((t.getUTCDay()+6)%7))*864e5),day=clamp(Math.round((mon.getTime()-Date.UTC(2026,0,1))/864e5),0,65535);return{seed:wk.seed,kind:wk.w%2?2:4,n:18,day}};
const weekOnIsl=(wk=isoWeek())=>weekIsl(wk).day>=LAUNCH_DAY7;
function goToday(){if(gentleOn()||!dailyOnIsl()){seedIn.value=todaySeed();showBiome();go(frontN(),null,0);return}const d=dailyIsl();VS.setItem('voxellinks.mode',JSON.stringify([9,0]));islPrep(d.seed,d.kind,d.day);const tw=twistFor(d.seed,CV),fm=tryOn()?S.formatPick|0:0;S.casual=S.casualOn?1:0;S.fmtNext={format:fm,twist:tw};if(fm)S.casual=1;if(tw===3)S.setup=3;startRound(9,null,null,oppArg())}
function goCalDay(seed){const dt=dateOf(seed);if(!dt)return;const day=islDayOfDate(dt);if(!dailyOnIsl(day)){seedIn.value=seed;showBiome();chTab('pPlay');go(9);return}const d=dailyIsl(day);VS.setItem('voxellinks.mode',JSON.stringify([9,0]));islPrep(seed,d.kind,day);const tw=twistFor(seed,CV);S.casual=S.casualOn?1:0;S.fmtNext={format:0,twist:tw};if(tw===3)S.setup=3;if(typeof sheetClose==='function')sheetClose();startRound(9,null,null,oppArg())}
const todayLine=()=>{const d=dailyIsl(),c=islCond(d.seed,d.day);return'Today’s island · '+islName(d.seed)+' · '+islRoutingName(d.kind,9).replace(/^Routing/,'routing')+' · '+SEASONS[c.season].n+' · 9 holes'};
function frontIsl(){const a=FRONT.act,C=S.car,T=S.tour;if(a==='career'&&t8Is(C)){const N=t8Next(C);if(N&&!N.out&&!N.fin){const c=t8Cond(C,C.tier,N.e,N.r);return{seed:c.seed,cond:c}}}if(a==='career'&&carIsl(C)){const t=C.tier,e=C.cur.ev,M=C.cur.major,r=isMajor(t,e)&&M&&M.r1!=null?1:0,c=carCondIsl(C,t,e,r);return{seed:C.cur.tiers[t].seeds[e],cond:c}}
  if(a==='tour'&&T&&T.isl)return{seed:T.seeds[T.ev],cond:tourCond(T,T.ev)};if(a==='today'&&!gentleOn()&&dailyOnIsl()){const d=dailyIsl(),c=islCond(d.seed,d.day);return{seed:d.seed,cond:{setup:c.setup,se:c.season,wear:c.wear,n:9,cv:CVX,kind:d.kind,islDay:d.day,v10:1}}}return null}
function dioInputsIsl(F){const c=F.cond,tw=F.cond.n===9&&S.frontSeed===F.seed?twistFor(F.seed,CV):0;return{seed:F.seed,n:c.n,cv:CVX,setup:tw===3?3:c.setup,cond:{season:c.se,wear:c.wear,kind:c.kind,twist:tw,islDay:c.islDay,v10:1},par:islPars(c.n,c.kind)[0]}}
const dioSeedNow=()=>{const F=frontIsl();return F?F.seed:todaySeed()};
/* ===== v8 M1 · The golfer: F-142 four stats, F-143 scored drills, F-144 gear, F-145 money, F-146 the bought caddie, F-147 the career record and the fence, F-148 the field's growth.
   All of it acts on the player's ball in career rounds of a v8 season (and in drills) and nowhere else. A career round writes record format 9, which every shared path refuses.
   strike() takes the golfer from B.G and clears it, so a ball carries a golfer only when its caller set one for that swing: every bot, ghost and replay of a shared record gets the standard numbers by default. */
const STAT_MAX=20,POW_CARRY=.07,ACC_TIGHT=.2,SG_CHECK=.25,PUTT_TRUE=.25,CARRY_E=1.22,DRV_E=1.142;
const DRILL_BALLS=10,DRILL_GAIN=.07,LANE_W=24,BOARD_K=.97,RING_R=4,LAG_R=.6,PUTTS8=[1.5,2,2.5,3,4,5,6,8,10,12],WEDGE_FLAGS=[40,100];
const FIELD_PACE=.5,GROW_SEASONS=8,GOLFER_STROKES=1.6,PAY_PT=[500,1250,3000];
const DRV_CARRY=.04,DRV_WILD=.3,SOFT_SPIN=.2,SOFT_CARRY=.03,SOFT_VK=.9868,STIFF_WIND=.2,STIFF_MIS=.5,BLADE_ACC=.15,BLADE_MIS=.4,MALLET_LINE=.3,MALLET_ROLL=.06,MIS_CAP=1.5,THIN_P=3.9;
const GEAR=[{n:'Bomber 460 driver',slot:'Driver',price:24000,gain:'+4 % driver carry',cost:'+30 % driver direction error',tag:'B'},
  {n:'Tour Soft ball',slot:'Ball',price:20000,gain:'+20 % backspin on every shot',cost:'−3 % iron carry',tag:'S'},
  {n:'X-Stiff shaft',slot:'Shaft',price:22000,gain:'−20 % wind push on full swings',cost:'+50 % on a thin strike’s cost',tag:'X'},
  {n:'Forged blades',slot:'Irons',price:24000,gain:'−15 % iron direction error',cost:'+40 % on a mishit’s cost',tag:'F'},
  {n:'Heavy mallet',slot:'Putter',price:18000,gain:'−30 % putt line error',cost:'+6 % roll for the same stroke',tag:'M'}];
const CADDIE_PRICE=[0,20000,35000,50000],CADDIE_N=['Today’s caddie','Your numbers','The club','The line and the gust'],CADDIE_WHAT=['book distances and plays-like for the standard bag','plays-like, the chip’s carry and the landing mark read your stats and gear','the club for your numbers and the lie, with a one-line reason','a suggested line past trouble and the wind’s timing'];
const STAT_N=['Power','Accuracy','Short game','Putting'],DRILL_N={range:'Range',wedge:'Wedges',putt:'Putting'},DRILL_WHAT={range:'power and accuracy',wedge:'short game',putt:'putting'},DRILL_K=['range','wedge','putt'],DRILL_HIT=['past the board','in the lane','inside '+RING_R+' m','holed or a lag'];
const G8_WATCH='A career round: watch only. It carries a golfer’s stats and gear, so it never plays as a ghost or posts a score.';
var G_TEST=null,G8C=new Map(),CAD_K='',G8FLAG=null;
function gTestSet(G){G_TEST=G;G8C.clear()}
function golferNew(){return{st:[0,0,0,0],own:[0,0,0,0,0],eq:[0,0,0,0,0],cad:0,cash:0,earn:0,win:null,dl:[]}}
function carMig(c,raw){if(c.v===1){try{if(VS.getItem('voxellinks.career.v1')==null)VS.setItem('voxellinks.career.v1',raw)}catch(e){}c.v=2}if(!c.g)c.g=golferNew();return c}
function car8(C){return!!(C&&C.cur&&C.cur.v8)}
function carGolfer(C){return C&&(C.g||(C.g=golferNew()))}
function g8Season(C){if(!tryOn())return;C.s8n=(C.s8n||0)+1;C.cur.v8=2;C.cur.s8=C.s8n;carGolfer(C);t8Start(C)}
function golfPack(C,alt){const g=carGolfer(C);return{st:g.st.map(v=>clamp(Math.round(v*10),0,200)),eq:g.eq.reduce((m,v,i)=>m|(v?1<<i:0),0),cad:g.cad|0,alt:alt?1:0}}
function golfWrite(w,G){for(let i=0;i<4;i++)w.w(G.st[i],8);w.w(G.eq&31,5);w.w(G.cad&3,2);w.w(G.alt?1:0,1)}
function golfRead(r){const st=[r.r(8),r.r(8),r.r(8),r.r(8)];if(st.some(v=>v>200))return null;return{st,eq:r.r(5),cad:r.r(2),alt:r.r(1)}}
function gAt(G,L,h,k){if(!G||!G.alt)return G||null;let n=0;for(let i=0;i<k&&i<L.length;i++)if(L[i].kind===0&&!L[i].mu)n++;return(h%2===0?n:n+1)%2?null:G}
function liveG(){const G=S.golfer;if(!G||S.replay)return null;const L=(S.log&&S.log[S.hi])||[];return gAt(G,L,S.hi|0,L.length)}
function gCad(){return S.golfer&&!S.replay?S.golfer.cad|0:0}
function gNum(){return gCad()>=1?liveG():null}
function gK(c){const G=gNum();return G?gCarryK(G,c):1}
function gPredK(){const G=gNum();return G?G.st.join('.')+'/'+G.eq:''}
const G_WEDGE=/^(PW|GW|SW|LW)$/,G_IRON=/^\dI$/;
function golfMods(G,c){const s=G.st.map(q=>q/10),m={v:1,acc:1,sp:1,wind:1,fat:1,thin:1};
  if(c.putter){m.acc=(1-PUTT_TRUE*s[3]/STAT_MAX)*(G.eq&16?1-MALLET_LINE:1);m.v=G.eq&16?Math.sqrt(1+MALLET_ROLL):1;return m}
  const full=!c.sg;if(full){m.v*=MM.pow(1+POW_CARRY*s[0]/STAT_MAX,1/CARRY_E);m.acc*=1-ACC_TIGHT*s[1]/STAT_MAX}
  if(c.sg||G_WEDGE.test(c.s))m.sp*=1+SG_CHECK*s[2]/STAT_MAX;
  if(G.eq&1&&c.s==='DR'){m.v*=MM.pow(1+DRV_CARRY,1/DRV_E);m.acc*=1+DRV_WILD}
  if(G.eq&2){m.sp*=1+SOFT_SPIN;if(full)m.v*=SOFT_VK}
  if(G.eq&4&&full){m.wind=1-STIFF_WIND;m.thin*=MM.pow(1+STIFF_MIS,1/THIN_P)}
  if(G.eq&8&&G_IRON.test(c.s)){m.acc*=1-BLADE_ACC;m.fat*=1+BLADE_MIS;m.thin*=MM.pow(1+BLADE_MIS,1/THIN_P)}
  return m}
function golfCarry(id,G){const k=id+'/'+(G?G.st.join('.')+'/'+G.eq:'-');if(G8C.has(k))return G8C.get(k);const c=clubById(id);if(!c||c.putter||c.sg)return null;const sv=W,svB=B,svE=EXACT,svM=MM,svT=G_TEST;EXACT=true;G_TEST=null;
  W={flat:2,M:mathFor(9),rk:ONES,bk:ONES,wind:{x:0,z:0},cv:9,v10:true,air:1,swell:0,pin:{x:1e6,z:1e6,y:0},tgrid:new Map(),ox:-1e9,oz:-1e9,cols:1e9,rows:1e9};B=newBall();let v=null;
  try{place(0,0);B.G=G;strike(c,1,0,0,0,1);const y0=B.y;let pz=0,py=y0;while(B.st==='air'){pz=B.z;py=B.y;stepAir(DT);if(B.nb|0||B.y<=y0)break}v=pz+(B.z-pz)*Math.min(1,(py-y0)/Math.max(1e-9,py-B.y))}finally{W=sv;B=svB;EXACT=svE;MM=svM;G_TEST=svT}G8C.set(k,v);return v}
function gCarryK(G,c){if(!G||!c||c.putter||c.sg)return 1;const a=golfCarry(c.id,G),b=golfCarry(c.id,null);return a&&b?a/b:1}
function gWindK(){const G=gNum(),c=curClub();return G&&G.eq&4&&!c.putter&&!c.sg?1-STIFF_WIND:1}
function gTag(c){const G=S.golfer;if(!G||!G.eq||S.replay)return'';let t='';if(G.eq&1&&c.s==='DR')t+='B';if(G.eq&8&&G_IRON.test(c.s))t+='F';if(G.eq&16&&c.putter)t+='M';if(G.eq&4&&!c.putter&&!c.sg)t+='X';if(G.eq&2)t+='S';return t?'·'+t:''}
function fieldGrow(C){if(!car8(C))return 0;const s=C.cur.s8||1;return FIELD_PACE*GOLFER_STROKES*Math.min(1,(s-1)/GROW_SEASONS)}
function grown(C,m){const g=fieldGrow(C);return g&&m?Object.assign({},m,{skill:m.skill-g}):m}
function carPay(C,pts){if(!C||!(car8(C)||tryOn())||!(pts>0))return 0;const g=carGolfer(C),v=Math.round(pts*PAY_PT[C.tier]);g.cash+=v;g.earn+=v;return v}
function money(v){return'$'+Math.round(v).toLocaleString('en-AU')}
function drillWin(C){const g=carGolfer(C),k=C.season*100+C.cur.ev;if(!g.win||g.win.k!==k)g.win={k,done:[0,0,0],pts:[0,0,0]};return g.win}
function drillOpen(C){return car8(C)&&!C.cur.done&&C.cur.ev<carEvN(C)}
function iDR(){return Math.max(0,CLUBS.findIndex(c=>c.id===0))}
function drillStimp(C){try{const t=C.tier,e=C.cur.ev,cond=carCond(t,e,0),cv=cond.cv||4;return stimpFor(C.cur.tiers[t].seeds[e],cv>=CV_ISL?cv:4,cond.se)}catch(x){return null}}
function drillStart(kind){const C=S.car;if(!drillOpen(C))return false;const w=drillWin(C),i=DRILL_K.indexOf(kind);if(i<0||w.done[i])return false;w.done[i]=1;carSave();
  const R=mulberry32(thash(C.seed,w.k,777+i)),flags=[];for(let j=0;j<DRILL_BALLS;j++)flags.push(Math.round(lerp(WEDGE_FLAGS[0],WEDGE_FLAGS[1],R())));
  const sv=S.rangeOpt;S.rangeOpt={se:-1,wind:0};rangeStart(kind==='putt');S.rangeOpt=sv;const G=golfPack(C,0);S.golfer=G;S.drill={kind,i:0,G,flags,pts:[0,0,0,0],st0:carGolfer(C).st.slice()};
  if(kind==='putt'){const st=drillStimp(C);if(st){W.stimp=st;W.rk[4]=STIMP_REF/st}}drillPlace();
  msg(DRILL_N[kind]+' drill · '+DRILL_BALLS+' balls',kind==='range'?'drivers: the lane ('+LANE_W+' m) scores accuracy, the board scores power':kind==='wedge'?'one ball at each flag: inside '+RING_R+' m scores short game':'holed scores putting; from 8 m a lag inside '+LAG_R+' m scores too · greens '+W.stimp.toFixed(1),3.2);return true}
function drillCarry(D){const c=clubById(0);return c.carry*gCarryK(D.G,c)}
function drillPlace(){const D=S.drill;if(!D)return;B=PB;PB.plug=false;PB.lf=0;S.stroke=D.i;S.ph=0;S.mark=0;S.mode='aim';S.shape=0;S.traj=1;S.sg=false;S.cadTick=null;
  if(D.kind==='putt'){const d=PUTTS8[D.i];W.pin={x:PG.x,z:PG.z,y:W.pin.y};place(PG.x,PG.z-d);S.club=CLUBS.length-1;aimPin()}
  else if(D.kind==='range'){place(0,RANGE_MAT);S.club=iDR();const d=drillCarry(D);terrainAt(W,0,d+RANGE_MAT);W.pin={x:0,z:d+RANGE_MAT,y:TQ.h};S.yaw=0;S.autoAim=false}
  else{place(0,RANGE_MAT);const d=D.flags[D.i];terrainAt(W,flagX(d),d+RANGE_MAT);W.pin={x:flagX(d),z:d+RANGE_MAT,y:TQ.h};autoClub();aimPin()}
  snapCam();buildClubs();updateHud(true)}
function drillScore(L,carry){const D=S.drill,C=S.car;if(!D||!C)return[];const g=carGolfer(C),got=[];
  if(D.kind==='range'){if(L.c===0){const side=L.cx==null?1e9:(L.cz-L.z0)*MM.sin(L.yaw)-(L.cx-L.x0)*MM.cos(L.yaw);if(carry>=drillCarry(D)*BOARD_K)got.push(0);if(Math.abs(side)<=LANE_W/2)got.push(1)}}
  else{const d=MM.hyp(W.pin.x-PB.x,W.pin.z-PB.z),holed=PB.st==='holed';if(D.kind==='wedge'){if(holed||d<=RING_R)got.push(2)}else if(holed||PUTTS8[D.i]>=8&&d<=LAG_R)got.push(3)}
  for(const j of got){D.pts[j]++;g.st[j]=Math.min(STAT_MAX,Math.round((g.st[j]+DRILL_GAIN)*100)/100)}
  if(got.length){carSave();AU.tone(880,880,.09,.12,'triangle');AU.tone(1320,1320,.12,.1,'triangle',.07)}
  const tot=D.pts.reduce((a,b)=>a+b,0);hint(DRILL_N[D.kind]+' · ball '+(D.i+1)+' of '+DRILL_BALLS+(got.length?' · '+got.map(j=>DRILL_HIT[j]).join(' · '):'')+' · '+tot+' point'+(tot===1?'':'s'),2.2);return got}
function drillNext(){const D=S.drill;if(!D)return;D.i++;if(D.i>=DRILL_BALLS){drillEnd(false);setTimeout(()=>{if(S.range&&!S.drill)rangeExit8()},1800);return}drillPlace()}
function drillEnd(quit){const D=S.drill,C=S.car;S.drill=null;S.golfer=null;S.cadTick=null;if(!D||!C)return;const g=carGolfer(C),w=drillWin(C),i=DRILL_K.indexOf(D.kind),tot=D.pts.reduce((a,b)=>a+b,0);
  w.pts[i]=tot;g.dl.push({s:C.season,e:C.cur.ev,k:D.kind,p:D.pts.slice(),n:D.i+(quit?0:0)});g.dl=g.dl.slice(-60);carSave();S.drillDone={st0:D.st0,t:performance.now()};
  const gain=g.st.map((v,j)=>v-D.st0[j]);msg(DRILL_N[D.kind]+' drill · '+tot+' point'+(tot===1?'':'s'),gain.map((v,j)=>v>0?STAT_N[j]+' +'+v.toFixed(2)+' → '+g.st[j].toFixed(1):null).filter(Boolean).join(' · ')||'no targets this time; the window is used',3.5);if(!tot)AU.play('ui')}
function rangeExit8(){S.range=null;S.drill=null;S.golfer=null;$('btnBack').classList.add('hide');$('btnMenu').click();chTab('pCareer')}
const G8_PX=14;
function g8Mesh(){if(!G8FLAG){const f=new MB(160);f.box(0,.5,0,.012,.5,.012,[.95,.95,.95]);f.box(.14,.9,0,.13,.075,.006,[.95,.3,.2]);const p=new MB(80);p.box(0,.5,0,.05,.5,.05,[1,1,1]);G8FLAG={f:f.upload(),p:p.upload()}}return G8FLAG}
function g8Tall(x,y,z){const dd=Math.hypot(x-cam.x,y-cam.y,z-cam.z),px=innerHeight/2/MM.tan(cam.fov/2);return Math.max(2.3,G8_PX*dd/px)}
function g8Pole(x,z,c){terrainAt(W,x,z);draw(g8Mesh().p,M4.trs(x,TQ.h,z,g8Tall(x,TQ.h,z)),c)}
function g8Draw(){const D=S.drill;if(S.cadTick&&S.mode==='aim'&&!S.ph&&S.cadTick.club===S.club){const t=S.cadTick;g8Pole(t.x,t.z,[.55,.9,1,.9])}if(!D||!W)return;const col=tracerCol();
  if(D.kind==='range'){const d=drillCarry(D),ux=MM.sin(S.yaw),uz=MM.cos(S.yaw),x0=PB.x,z0=PB.z,W2=LANE_W/2;
    for(let t=-30;t<=30;t+=10)for(const s of[-1,1])g8Pole(x0+ux*(d+t)+uz*s*W2,z0+uz*(d+t)-ux*s*W2,[1,1,1,.85]);
    const bd=d*BOARD_K;for(let s=-W2;s<=W2;s+=4)g8Pole(x0+ux*bd+uz*s,z0+uz*bd-ux*s,[col[0],col[1],col[2],.95])}
  else if(D.kind==='wedge'){terrainAt(W,W.pin.x,W.pin.z);const h=TQ.h;draw(ringMesh,M4.trs(W.pin.x,h+.06,W.pin.z,RING_R),[col[0],col[1],col[2],.6]);draw(g8Mesh().f,M4.trs(W.pin.x,h,W.pin.z,g8Tall(W.pin.x,h,W.pin.z)))}
  else if(PUTTS8[D.i]>=8){terrainAt(W,W.pin.x,W.pin.z);draw(ringMesh,M4.trs(W.pin.x,TQ.h+.03,W.pin.z,LAG_R),[1,1,1,.55])}}
function shopBuy(kind,i){const C=S.car,g=carGolfer(C);if(kind==='gear'){if(g.own[i]||g.cash<GEAR[i].price)return false;g.cash-=GEAR[i].price;g.own[i]=1;g.eq[i]=1}
  else{if(i!==g.cad+1||g.cash<CADDIE_PRICE[i])return false;g.cash-=CADDIE_PRICE[i];g.cad=i}carSave();AU.play('good');return true}
function shopEquip(i,on){const g=carGolfer(S.car);if(!g.own[i])return;g.eq[i]=on?1:0;carSave();AU.tone(110,80,.2,.16,'triangle')}
function statBar(n,v,from){return'<div class="g8stat"><span>'+n+'</span><i><b style="width:'+(from/STAT_MAX*100).toFixed(1)+'%" data-to="'+(v/STAT_MAX*100).toFixed(1)+'"></b></i><em>'+v.toFixed(1)+'</em></div>'}
function golferHtml(C){const g=carGolfer(C),shop=' <button class="sec" id="carShop">Bag and caddie</button>';
  if(!car8(C))return tryOn()?'<div class="g8box"><div class="sub" style="font-size:13px;margin:0">'+money(g.cash)+' prize money · your golfer (four stats, drills, gear and a caddie) arrives with season '+(C.season+1)+shop+'</div></div>':'';
  const D=S.drillDone&&performance.now()-S.drillDone.t<8000?S.drillDone:null,w=drillOpen(C)?drillWin(C):null,s8=C.cur.s8||1;
  let h='<div class="g8box"><div class="g8stats">'+g.st.map((v,j)=>statBar(STAT_N[j],v,D?D.st0[j]:v)).join('')+'</div>';
  if(g.st.every(v=>!v))h+='<div class="sub" style="font-size:12px;margin:4px 0 0">Drills fill these. They move your ball in career rounds only.</div>';
  if(w)h+='<div class="sub" style="font-size:13px;margin:8px 0 4px">Before '+(isMajor(C.tier,C.cur.ev)?'the major':'event '+(C.cur.ev+1))+': range · wedges · putting, 3 min each, once each</div><div class="row" style="margin:0;flex-wrap:wrap">'+DRILL_K.map((k,i)=>'<button class="sec" data-drill="'+k+'"'+(w.done[i]?' disabled':'')+' title="'+DRILL_WHAT[k]+'">'+DRILL_N[k]+' · '+DRILL_WHAT[k]+(w.done[i]?' · '+w.pts[i]+' pts':'')+'</button>').join('')+'</div>';
  if(s8>1&&s8-1<=GROW_SEASONS&&!C.cur.ev)h+='<div class="sub" style="font-size:12px;margin:6px 0 0">The '+TIER_NAMES[C.tier]+' field is '+(FIELD_PACE*GOLFER_STROKES/GROW_SEASONS).toFixed(1)+' a nine sharper than last season.</div>';
  return h+'<div class="sub" style="font-size:13px;margin:8px 0 0">'+money(g.cash)+' to spend · '+money(g.earn)+' career prize money · caddie: '+CADDIE_N[g.cad]+(g.eq.some(v=>v)?' · bag: '+GEAR.filter((_,i)=>g.eq[i]).map(x=>x.n).join(', '):'')+shop+'</div></div>'}
function shopHtml(C){const g=carGolfer(C);let h='<div class="sub" style="color:var(--ink)">Bag and caddie · '+money(g.cash)+' to spend</div><p class="sub" style="font-size:12px">Career rounds only: none of it reaches the daily, the weekly or a ghost. Every piece trades something, and a change applies from your next round.</p><table><tr><th style="text-align:left">Piece</th><th>Gain</th><th>Cost</th><th></th></tr>';
  GEAR.forEach((x,i)=>{h+='<tr><td style="text-align:left">'+x.n+'<br><small>'+x.slot+'</small></td><td>'+x.gain+'</td><td>'+x.cost+'</td><td>'+(g.own[i]?'<button class="sec" data-eq="'+i+'">'+(g.eq[i]?'In the bag':'Standard')+'</button>':'<button class="sec" data-buy="'+i+'"'+(g.cash<x.price?' disabled':'')+'>'+money(x.price)+'</button>')+'</td></tr>'});
  h+='</table><div class="sub" style="color:var(--ink);margin-top:10px">The caddie · information only, never the ball</div><table>'+CADDIE_N.map((n,i)=>'<tr><td style="text-align:left">L'+i+' '+n+'<br><small>'+CADDIE_WHAT[i]+'</small></td><td>'+(i<=g.cad?'✓':i===g.cad+1?'<button class="sec" data-cad="'+i+'"'+(g.cash<CADDIE_PRICE[i]?' disabled':'')+'>'+money(CADDIE_PRICE[i])+'</button>':money(CADDIE_PRICE[i]))+'</td></tr>').join('')+'</table>';return h}
function shopOpen(){const C=S.car;$('tourBody').innerHTML=shopHtml(C);$('tourOv').classList.remove('hide');const b=$('tourBody');
  b.querySelectorAll('[data-buy]').forEach(x=>x.onclick=()=>{if(shopBuy('gear',+x.dataset.buy))shopOpen()});b.querySelectorAll('[data-cad]').forEach(x=>x.onclick=()=>{if(shopBuy('cad',+x.dataset.cad))shopOpen()});
  b.querySelectorAll('[data-eq]').forEach(x=>x.onclick=()=>{const i=+x.dataset.eq;shopEquip(i,!carGolfer(C).eq[i]);shopOpen()});carPanel()}
function golferWire(C){const el=$('pCareer');if(!el)return;el.querySelectorAll('[data-drill]').forEach(b=>b.onclick=()=>{AU.play('ui');drillStart(b.dataset.drill)});const s=$('carShop');if(s)s.onclick=()=>{AU.play('ui');shopOpen()};
  if(S.drillDone){S.drillDone=null;AU.tone(660,660,.12,.12,'triangle');AU.tone(990,990,.3,.12,'triangle',.14)}setTimeout(()=>el.querySelectorAll('.g8stat b[data-to]').forEach(b=>{b.style.width=b.dataset.to+'%'}),40)}
function cadLieK(){terrainAt(W,B.x,B.z);const L=LIE[TQ.ty]||[1,1];return L[0]<1?MM.pow(L[0],LIE9*CARRY_E):1}
function cadClub(){if(gCad()<2||!W||S.sg||!liveG()||S.drill&&S.drill.kind!=='wedge')return;if(curClub().putter)return;const k=cadLieK();if(k>=.999)return;const de=playsLike(),last=CLUBS.length-1;let pick=0;for(let i=last-1;i>=0;i--)if(ownTotal(CLUBS[i])*k>=de*1.02){pick=i;break}S.club=pick}
function cadAfterClub(){if(!S.golfer||S.replay||!W||S.mode==='title')return;cadClub();const k=S.seed+'/'+S.hi+'/'+((S.log&&S.log[S.hi])||[]).length+'/'+(S.drill?S.drill.i:'');if(k===CAD_K)return;CAD_K=k;S.cadTick=null;setTimeout(cadLine,350)}
function cadSay(t){if(typeof chipHint==='function'&&chipOn())chipHint(t,2.5);else hint(t,2.5)}
function cadLine(){if(!S.golfer||S.replay||S.mode!=='aim'||S.ph||!W)return;const G=liveG();if(!G)return;const lv=gCad(),c=curClub();
  if(lv===0){if(G.st[0]>=50&&!S.cadSold&&!c.putter&&!c.sg){S.cadSold=1;cadSay('You’re carrying it '+Math.round(POW_CARRY*G.st[0]/10/STAT_MAX*100)+' % past the book')}return}
  if(lv<2||c.putter||c.sg)return;terrainAt(W,B.x,B.z);const ty=TQ.ty,k=cadLieK();let t=c.s+' · plays '+fmtD(Math.round(playsLike()))+' · you carry it '+fmtD(ownCarry(c))+(k<.97?' · from the '+SURF[ty].n.toLowerCase()+', about '+Math.round((1-k)*100)+' % short':'');
  if(lv>=3){const s=cadSuggest();if(s)t+=' · '+s;const wt=cadWind();if(wt)t+=' · '+wt}cadSay(t)}
function cadSuggest(){const c=curClub(),G=liveG(),y0=S.yaw,d0=MM.hyp(W.pin.x-B.x,W.pin.z-B.z),sc=r=>r.st==='holed'?0:r.st==='water'||r.st==='oob'?1+expected(d0,2):expected(MM.hyp(W.pin.x-r.x,W.pin.z-r.z),r.ty),run=y=>{PLANB.G=G;return planSim(c,1,y,S.traj,0,true)};
  const s0=sc(run(y0));let best=null;for(let a=-6;a<=6;a+=2){if(!a)continue;const r=run(y0+a*DEG),s=sc(r);if(!best||s<best.s)best={a,s,r}}
  if(!best||best.s>s0-.05)return'your line is the caddie’s';S.cadTick={x:best.r.x,z:best.r.z,club:S.club};return'the caddie likes '+Math.abs(best.a)+'° '+(best.a>0?'left':'right')+' (saves '+(s0-best.s).toFixed(2)+')'}
function cadWind(){if(!W.swell||!(W.wind.s>=1.5)||curClub().putter)return'';const now=curTick();let bj=0,bf=9;for(let j=0;j<WIND.ticks;j+=3){const f=windAt(now+j+SWING_TICKS);if(f<bf){bf=f;bj=j}}const dt=bj*DT;if(dt<.4)return'swing now: the wind drops as you strike';
  const key=S.hi+'/'+S.stroke;setTimeout(()=>{if(S.mode==='aim'&&!S.ph&&S.hi+'/'+S.stroke===key){AU.tone(1200,1200,.06,.1,'sine');cadSay('Now: swing into the lull')}},Math.max(0,dt-.25)*1000);return'the wind lulls in '+dt.toFixed(1)+' s: swing on the pulse'}
function g8Banner(code,info){const G=info.d.golfer;$('hcpSel').style.display='none';$('ghostText').textContent='A career round, watch only · '+info.text+' · '+STAT_N.map((n,j)=>n.toLowerCase()+' '+(G.st[j]/10).toFixed(1)).join(', ')+(G.eq?' · '+GEAR.filter((_,i)=>G.eq>>i&1).map(x=>x.n).join(', '):'');$('btnGhost').textContent='Watch hole 1';$('btnGhost').onclick=()=>{AU.play('ui');watchCode(code,0,0,'pGhosts')}}
function g8Card(quiet){if(!S.golfer)return;$('btnVs').classList.add('hide');if(!quiet&&S.carDone&&S.carDone.qcard)AU.tone(1568,1568,.7,.12,'sine',.3);const b=$('cardBody');if(!b||!b.querySelectorAll)return;b.querySelectorAll('.g8pay[data-to]').forEach(el=>{const to=+el.dataset.to,t0=performance.now();el.removeAttribute('data-to');const f=()=>{const u=Math.min(1,(performance.now()-t0)/600);el.textContent='+'+money(to*u);if(u<1)requestAnimationFrame(f)};f();if(!quiet)AU.tone(520,780,.18,.08,'triangle',.05)})}
function g8StatNote(A){const n=A.filter(R=>R.car).length;return n?' · '+n+' career round'+(n>1?'s':'')+' on career numbers':''}
/* ===== v8 M2 · The tour's shape: F-149 six events, F-150 fields of 24, F-151 formats, F-152 Q-school, F-153 points and the title race, F-154 leaders out last and the moving leaderboard, F-155 skipping, F-156 the starting tier.
   A season begun with Try new things on is a v8 season (cur.v8 2): six island events, 24 a tier, one per biome. A season under way keeps its shape.
   Only your rounds are stored (me8), with your partner's ghost and F-128's leaders shot by shot (real8); every other round is the per-hole model, recomputed from the seed, so the save stays small and every board reproduces. */
const EVENTS8=6,FIELD8=24,POINTS8=[100,60,40,30,25,22,20,18,16,14,12,10,8,7,6,5,4,3,2,1,1,1,1,1],BIG=2,STAB8=[5,2,0,-1,-3],KO_SEEDS=16,KO_POINTS=[100,60,40,25,12],PAIRS=12,CHAMP8=8,Q_FIELD=10,Q_CARDS=3,RETIRE=3,ROOKIES=3,TEE_GAP=1,LAST_TRAIL=6,PLAYOFF_MAX=4,SHOT_T=16,HOLE_T=12;
const F8_N=['Stroke play','The Stableford','The knockout','The foursomes','The major','The championship'],F8_S=['stroke play','the Stableford','the knockout','the foursomes','the major','the championship'],F8_I=['flag','','swords','ghost','star','tour'],
  T8_KIND=[[2],[4],[2,3,4,5],[3],[2,3],[4,5]],T8_PINS=[[0],[1],[1,1,1,1],[2],[2,3],[2,3]],KO_ORDER=[1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11],KO_RN=['round of 16','quarter-final','semi-final','final'],KO_SN=['the round of 16','the quarter-finals','the semi-finals','the final','the title'];
function t8Is(C){return!!(C&&C.cur&&C.cur.v8>=2)}
function carEvN(C){return t8Is(C)?EVENTS8:EVENTS}
function t8Mem(C,t){return t===C.tier?C.roster[t].concat([-1]):C.roster[t].slice()}
const t8K=(e,r)=>e+'/'+(r|0),t8Rounds=e=>T8_KIND[e].length,t8Big=e=>e>=4,t8Age=(C,p)=>p.a0+(C.season-p.s0);
function t8Start(C){const ss=C.cur.ss;C.cur.tiers=[0,1,2].map(t=>({seeds:t8Seeds(C,ss,t),res:[]}));Object.assign(C.cur,{me8:{},real8:{},skip8:{},po8:{},ko8:{},q:null});t8Fill(C)}
function t8Seeds(C,ss,t){const hb=biomeOf(C.home,4),out=[],seen=new Set([hb]);let s=1+(ss+t*7919)%899000;while(biomeOf(s,4)!==hb)s++;out.push(s++);for(;out.length<EVENTS8;s++){const b=biomeOf(s,4);if(b&&!seen.has(b)){seen.add(b);out.push(s)}}
  const R=mulberry32(ss^(t+1)*977);for(let i=out.length-1;i>0;i--){const j=(R()*(i+1))|0;[out[i],out[j]]=[out[j],out[i]]}return out}
function t8Names(C){return{used:new Set(C.players.map(p=>p.name)),last:new Set(C.players.map(p=>p.name.split(' ').pop()))}}
function t8New(C,R,t,N,a0,a1){const F=FIRST.concat(FIRST2),L=LASTN.concat(LAST2);let n=null,k=0;while(!n||N.used.has(n)){const l=L[(R()*L.length)|0];if(k++<40&&N.last.has(l)){n=null;continue}n=F[(R()*F.length)|0]+' '+l}N.used.add(n);N.last.add(n.split(' ').pop());
  const b=TIER_BANDS[t];let u=R(),st=0;while(st<3&&u>=STYLE_P[st]){u-=STYLE_P[st];st++}const p={id:C.players.length,name:n,skill:Math.round(lerp(b[0],b[1],R())*2)/2,style:st,a0:a0+Math.floor(R()*(a1-a0+1)),s0:C.season,nw:C.season};C.players.push(p);return p}
function t8Fill(C){const R=mulberry32(thash(C.seed,C.season,881)),N=t8Names(C);for(const p of C.players)if(p.a0==null){p.a0=22+Math.floor(R()*17);p.s0=C.season}
  for(let t=0;t<3;t++)while(t8Mem(C,t).length<FIELD8)C.roster[t].push(t8New(C,R,t,N,22,38).id)}
function t8QSeed(C){return 1+(C.cur.ss>>>0)%899000}
function t8QDay(C){let d=0;for(let e=0;e<EVENTS8;e++)d=Math.max(d,carDay(C,C.tier,e,t8Rounds(e)-1));return d+1}
function t8Cond(C,t,e,r){r=r|0;if(e>=6){const seed=t8QSeed(C),day=t8QDay(C)+r,c=islCond(seed,day);return{setup:2,se:c.season,wear:c.wear,n:9,cv:CVX,kind:2+r,islDay:day,v10:1,seed}}
  const seed=C.cur.tiers[t].seeds[e],day=carDay(C,t,e,r),c=islCond(seed,day);return{setup:T8_PINS[e][r],se:c.season,wear:c.wear,n:9,cv:CVX,kind:T8_KIND[e][r],islDay:day,v10:1,seed}}
function t8P(C,id){return id<0?{id:-1,name:'You',skill:t8MySkill(C),style:0}:id>=1000?t8PairM(C,id):C.players[id]}
function t8MySkill(C){const b=TIER_BANDS[C.tier];return myIndex()??myHandicap()??lerp(b[0],b[1],.5)}
function t8Hm(C,t,e,r,id){const k='h8/'+C.season+'/'+t+'/'+e+'/'+(r|0)+'/'+id;let v=CAR_C.get(k);if(v)return v;const cond=t8Cond(C,t,e,r),pair=id>=1000,m=pair?t8PairM(C,id):grown(C,C.players[id]);
  v=islField(cond,()=>carScores_([C.seed,C.season*1000+t*100+e*10+(r|0),id+3],cond.seed,carPars(cond),m,cond,pair?0:formOf(C,id,C.season*8+e)));CAR_C.set(k,v);return v}
function t8H(C,t,e,r,id){if(id<0)return C.cur.me8[t8K(e,r)]||null;const R=C.cur.real8[t8K(e,r)];if(R&&R[id]&&(t===C.tier||e>=6))return R[id];return t8Hm(C,t,e,r,id)}
const t8Sum=h=>h?h.reduce((a,b)=>a+b,0):null,t8Stab=(h,pars)=>h?h.reduce((a,v,i)=>a+STAB8[clamp(v-pars[i]+2,0,4)],0):null;
function t8Pars(C,t,e,r){return carPars(t8Cond(C,t,e,r))}
function t8Place(L,cmp,at,mult){L.sort(cmp);for(let i=0;i<L.length;){let j=i;while(j+1<L.length&&cmp(L[j+1],L[i])===0)j++;let s=0;for(let k=i;k<=j;k++)s+=at(k)||0;for(let k=i;k<=j;k++){L[k].pts=s/(j-i+1)*mult;L[k].pos=i+1}i=j+1}return L}
const t8Low=(a,b)=>a.sc-b.sc,t8High=(a,b)=>b.sc-a.sc;
function t8Skipped(C,e){return e===2?C.cur.skip8[2]===1:!!C.cur.skip8[e]}
function t8Stroke(C,t,e,ids,r){return ids.map(id=>{const h=t8H(C,t,e,r,id);return h?{id,sc:t8Sum(h),h}:null}).filter(Boolean)}
function t8PO(C,t,e,L){const P=C.cur.po8[e];if(!P||t!==C.tier||!L.length)return L;const me=L.find(x=>x.id<0),rv=L.find(x=>x.id===P.rv);if(!me||!rv||me.pos!==1||rv.pos!==1)return L;const pts=me.pts,mult=t8Big(e)?BIG:1;
  if(P.w===1){me.pts=POINTS8[0]*mult;rv.pts=POINTS8[1]*mult;rv.pos=2}else if(P.w===0){rv.pts=POINTS8[0]*mult;me.pts=POINTS8[1]*mult;me.pos=2}else{me.pts=rv.pts=pts}L.sort((a,b)=>a.pos-b.pos||a.sc-b.sc);return L}
function t8Ev(C,t,e){const k='ev8/'+C.season+'/'+t+'/'+e;const c=CAR_C.get(k);if(c)return c;let L;const mem=t8Mem(C,t).filter(id=>!(id<0&&t8Skipped(C,e)));
  if(e===0)L=t8PO(C,t,e,t8Place(t8Stroke(C,t,0,mem,0),t8Low,i=>POINTS8[i],1));
  else if(e===1){const pars=t8Pars(C,t,1,0);L=t8PO(C,t,e,t8Place(mem.map(id=>{const h=t8H(C,t,1,0,id);return h?{id,sc:t8Stab(h,pars),st:t8Sum(h),h}:null}).filter(Boolean),t8High,i=>POINTS8[i],1))}
  else if(e===2)L=t8KO(C,t).rows;
  else if(e===3){const P=t8Pairs(C,t),rows=[];const PL=t8Place(P.map(p=>{const h=t8H(C,t,3,0,p.pid);return h?{id:p.pid,pair:p,sc:t8Sum(h),h}:null}).filter(Boolean),t8Low,i=>(POINTS8[2*i]+POINTS8[2*i+1])/2,1);
    for(const x of PL)for(const id of x.pair.ids)rows.push({id,sc:x.sc,pos:x.pos,pts:x.pts,pair:x.pair});L=rows}
  else{const ids=e===4?mem:t8Champs(C,t),r0=t8Place(t8Stroke(C,t,e,ids,0),t8Low,()=>0,1),n=r0.length,cutAt=r0.length?r0[Math.max(0,Math.ceil(n/2)-1)].sc:0,made=r0.filter(x=>x.sc<=cutAt),miss=r0.filter(x=>x.sc>cutAt);
    const fin=made.map(x=>{const h2=t8H(C,t,e,1,x.id);return h2?{id:x.id,r1:x.sc,sc:x.sc+t8Sum(h2),made:true}:null}).filter(Boolean);L=t8PO(C,t,e,t8Place(fin,t8Low,i=>POINTS8[i],BIG));miss.forEach(x=>{x.pts=0;x.pos=fin.length+1;x.made=false;x.r1=x.sc});L=L.concat(miss);L.cut=cutAt;L.r0=r0}
  CAR_C.set(k,L);return L}
function t8Match(a,b){let up=0;for(let h=0;h<9;h++){const d=(b[h]??99)-(a[h]??99);up+=d>0?1:d<0?-1:0;if(Math.abs(up)>8-h)return{w:up>0?0:1,up,thru:h+1}}return{w:up>0?0:up<0?1:-1,up,thru:9}}
function t8SD(C,t,r,a,b){const cond=t8Cond(C,t,2,r),pars=carPars(cond);for(let k=1;k<=PLAYOFF_MAX;k++){const s=[a,b].map(id=>islField(cond,()=>carScores_([C.seed,C.season*1000+t*100+20+r,id+3+1000*k],cond.seed,pars,grown(C,C.players[id]),cond,formOf(C,id,C.season*8+2)))[8]);if(s[0]!==s[1])return{w:s[0]<s[1]?0:1,sd:k}}return{w:0,sd:PLAYOFF_MAX,seed:1}}
function t8KO(C,t){const k='ko8/'+C.season+'/'+t;const c=CAR_C.get(k);if(c)return c;const st=t8Stand(C,t,2),seeds=st.slice(0,KO_SEEDS).map(x=>x.id),stage={},rounds=[];let alive=KO_ORDER.map(s=>seeds[s-1]);
  for(let r=0;r<4;r++){const next=[],M=[];for(let i=0;i<alive.length;i+=2){const a=alive[i],b=alive[i+1];let res;
      if(a<0||b<0){const o=a<0?b:a,me=a<0?0:1;if(t===C.tier&&C.cur.skip8[2]&&r>=C.cur.skip8[2]-1)res={w:1-me,wo:1};else{const my=C.cur.me8[t8K(2,r)],oh=my&&t8H(C,t,2,r,o);if(!my){res=null}else{const m=t8Match(me?oh:my,me?my:oh);res=m.w>=0?m:(()=>{const P=C.cur.ko8[r];return P&&P.w!=null?{w:P.w===1?me:1-me,up:0,thru:9,sd:P.n}:null})()}}}
      else{const m=t8Match(t8H(C,t,2,r,a),t8H(C,t,2,r,b));res=m.w>=0?m:Object.assign(m,t8SD(C,t,r,a,b))}
      M.push({a,b,res});if(!res){next.push(null);continue}const win=res.w===0?a:b,lose=res.w===0?b:a;stage[lose]=r;next.push(win)}
    rounds.push(M);if(next.some(x=>x==null)){alive=next;break}alive=next;if(r===3&&alive[0]!=null)stage[alive[0]]=4}
  const rows=seeds.map(id=>({id,stage:stage[id],pts:stage[id]==null?0:KO_POINTS[4-stage[id]],pos:stage[id]==null?null:[9,5,3,2,1][stage[id]]})),done=Object.keys(stage).length===KO_SEEDS;
  const out={seeds,rounds,rows,done,stage};CAR_C.set(k,out);return out}
function t8KOMine(C){const K=t8KO(C,C.tier);if(!K.seeds.includes(-1))return{out:true};for(let r=0;r<K.rounds.length;r++){const m=K.rounds[r].find(x=>x.a===-1||x.b===-1);if(!m)return{done:true,stage:K.stage[-1]};if(!m.res)return{r,opp:m.a<0?m.b:m.a,seed:K.seeds.indexOf(m.a<0?m.b:m.a)+1,my:K.seeds.indexOf(-1)+1}}return{done:true,stage:K.stage[-1]}}
function t8Pairs(C,t){const st=t8Stand(C,t,3).map(x=>x.id),P=[];for(let i=0;i<PAIRS;i++){const ids=[st[i],st[st.length-1-i]].filter(x=>x!=null);P.push({k:i,ids,pid:ids.includes(-1)?-1:1000+t*100+i})}return P}
function t8PairM(C,id){const t=Math.floor((id-1000)/100),P=t8Pairs(C,t).find(p=>p.pid===id),ms=P.ids.map(i=>grown(C,C.players[i]));return{id,name:P.ids.map(i=>C.players[i].name.split(' ').pop()).join(' & '),skill:ms.reduce((a,m)=>a+m.skill,0)/ms.length,style:0}}
function t8Champs(C,t){let st=t8Stand(C,t,5);if(t===C.tier&&t8Skipped(C,5))st=st.filter(x=>x.id!==-1);return st.slice(0,CHAMP8).map(x=>x.id)}
function t8Stand(C,t,upto){const n=upto==null?Math.min(C.cur.ev,EVENTS8):upto,rows=t8Mem(C,t).map(id=>({id,p:id<0?null:C.players[id],name:id<0?'You':C.players[id].name,me:id<0,pts:0,wins:0,tot:0,ev:[],fin:[99,99]})),by=new Map(rows.map(r=>[r.id,r]));
  for(let e=0;e<EVENTS8;e++){if(e>=n){rows.forEach(r=>r.ev.push(null));continue}const got=new Set();for(const x of t8Ev(C,t,e)){const r=by.get(x.id);if(!r||got.has(x.id))continue;got.add(x.id);r.pts+=x.pts||0;if(x.pos===1)r.wins++;if(e===0||e>=4)r.tot+=x.sc||0;if(e>=4)r.fin[e-4]=x.made===false?50:x.pos;r.ev.push(x)}rows.forEach(r=>{if(!got.has(r.id))r.ev.push(r.me&&t===C.tier&&t8Skipped(C,e)?{skip:1}:null)})}
  rows.sort((a,b)=>b.pts-a.pts||b.wins-a.wins||a.fin[1]-b.fin[1]||a.fin[0]-b.fin[0]||a.tot-b.tot||a.id-b.id);rows.forEach((r,i)=>r.rank=i+1);return rows}
function t8Field(C,t,e,r){if(e>=6){const b=C.cur.q?C.cur.q.b:0,par=carPars(t8Cond(C,3+b,6,0)).reduce((a,v)=>a+v,0);return t8QField(C).map(id=>{const h=r?t8H(C,3+b,6,0,id):null;return{id,base:h?t8Sum(h)-par:0}})}if(e===3)return t8Pairs(C,t).map(p=>({id:p.pid,base:0}));
  if(e===4||e===5){const ids=e===4?t8Mem(C,t):t8Champs(C,t);if(!r)return ids.map(id=>({id,base:0}));const L=t8Ev(C,t,e),pars=t8Pars(C,t,e,0),par=pars.reduce((a,b)=>a+b,0);return L.r0.filter(x=>x.sc<=L.cut).map(x=>({id:x.id,base:x.sc-par}))}
  return t8Mem(C,t).filter(id=>!(id<0&&t8Skipped(C,e))).map(id=>({id,base:0}))}
function t8Draw(C,t,e,r,F){const st=e===0||e>=6?null:t8Stand(C,t,Math.min(e,EVENTS8)),rk=new Map(st?st.map(x=>[x.id,x.rank]):[]),key=x=>r||e>=6?x.base*100+(rk.get(x.id)||0):e===0?t8P(C,x.id<1000?x.id:-1).skill*100:(rk.get(x.id)||99);
  const O=F.slice().sort((a,b)=>key(b)-key(a)||b.id-a.id);O.forEach((x,i)=>x.g=Math.floor(i/3));const me=O.find(x=>x.id<0);O.forEach(x=>x.off=me?me.g-x.g:0);return O}
function t8Round(){const C=S.car,R=S.carRound;return C&&R&&R.v8?{C,R,t:R.q!=null&&C.cur.q?3+C.cur.q.b:C.tier,e:R.e,r:R.r|0}:null}
function t8Rows(k){const X=t8Round();if(!X||X.e===2||X.R.po!=null)return null;const{C,R,t,e,r}=X,key='t8/'+C.season+'/'+e+'/'+r;
  if(!S.fieldCache||S.fieldCache.key!==key){const F=t8Draw(C,t,e,r,t8Field(C,t,e,r));S.fieldCache={key,v8:1,all:F,rows:F.filter(x=>x.id>=0).map(x=>({m:x.id>=1000?t8PairM(C,x.id):C.players[x.id],id:x.id,base:x.base,off:x.off,sc:t8Hm(C,t,e,r,x.id).slice()}))};if(tryOn()&&e!==3)leadPick()}
  const FC=S.fieldCache,maxOff=Math.max(0,...FC.rows.map(x=>x.off));leadUpTo(Math.min(S.n,k+maxOff*TEE_GAP));const pars=S.pars,stab=e===1,pid=R.pid;
  const val=(h,a,b)=>{let v=0;for(let i=a;i<b;i++)v+=stab?STAB8[clamp(h[i]-pars[i]+2,0,4)]:h[i]-pars[i];return v};
  const sur=x=>x.m.name.split(' ').pop(),dup=new Set(FC.rows.map(sur).filter((n,i,A)=>A.indexOf(n)!==i)),rows=FC.rows.map(x=>{const done=clamp(k+x.off*TEE_GAP,0,S.n),h=x.id===pid?pars.map((p,i)=>i<done?ghostHoleScore(i)||p:p):x.sc;return{name:x.m.name,short:dup.has(sur(x))?x.m.name[0]+'. '+sur(x):sur(x),id:x.id,rel:(stab?0:x.base)+val(h,0,done),done,partner:x.id===pid,style:x.m.style}});
  const mh=S.strokes.map(v=>v==null?0:v);let me=0;for(let i=0;i<k;i++)me+=stab?STAB8[clamp(mh[i]-pars[i]+2,0,4)]:mh[i]-pars[i];const my=(C.cur.me8[t8K(e,0)]&&r?t8Sum(C.cur.me8[t8K(e,0)])-t8Pars(C,t,e,0).reduce((a,b)=>a+b,0):0)+me;
  rows.push({name:'You',short:'You',rel:my,me:true,done:k});const sgn=stab?-1:1;rows.sort((a,b)=>sgn*(a.rel-b.rel)||(a.me?-1:b.me?1:0));for(const x of rows){x.pos=rows.findIndex(q=>q.rel===x.rel)+1;x.tie=rows.filter(q=>q.rel===x.rel).length>1;if(stab)x.txt=(x.rel>0?'+':'')+x.rel+' pts'}
  const cutN=(e>=4&&e<=5&&!r)?Math.ceil(rows.length/2):e>=6?Q_CARDS:0;rows.cut=cutN?{n:cutN,rel:rows[cutN-1].rel,name:e>=6?'cards':'cut'}:null;
  const ahead=rows.filter(x=>!x.me&&x.done>k||FC.rows.find(q=>q.id===x.id&&q.off>0)),fin=ahead.length&&ahead.every(x=>x.done>=S.n);S.t8need=null;
  if(fin&&k<S.n&&k>0&&(e!==4&&e!==5||r)&&e<6){const best=rows.filter(x=>!x.me&&x.done>=S.n).reduce((m,x)=>stab?Math.max(m,x.rel):Math.min(m,x.rel),stab?-99:99),left=S.n-k,win=stab?best-my+1:best-my-1,po=stab?best-my:best-my;
    S.t8need=stab?(win<=0?'Leading by '+(my-best)+' with '+left+' to play':'Need '+win+' point'+(win===1?'':'s')+' in the last '+left+' to win, '+po+' for a playoff'):win>0?'You can drop '+win+' in the last '+left+' and still win':win===0?'Par in wins; one over forces a playoff':'Need '+relS(win)+' in the last '+left+' to win, '+relS(po)+' for a playoff'}
  if(S.t8need&&S.t8need!==S.t8needWas)AU.tone(1320,1320,.05,.06,'sine');S.t8needWas=S.t8need;return rows}
function t8Line(){const X=t8Round();if(!X)return'';const{C,R,e}=X,pars=S.pars,k=S.strokes.filter(v=>v!=null).length;if(!k)return'';
  if(e===2&&R.po==null&&S.ghost){let up=0,n=0;for(let h=0;h<k;h++){const a=S.strokes[h],b=ghostHoleScore(h);if(a==null||b==null)break;n=h+1;up+=a<b?1:a>b?-1:0;if(Math.abs(up)>S.n-1-h){return(up>0?'You won ':'Lost ')+Math.abs(up)+'&'+(S.n-1-h)}}return n?(up?Math.abs(up)+(up>0?' up':' down'):'All square')+' thru '+n+' · '+esc(S.ghost.name||''):''}
  if(e===1)return'Stableford · '+t8Stab(S.strokes.slice(0,k),pars)+' points thru '+k;if(R.q!=null)return'Q-school · '+relS(S.strokes.slice(0,k).reduce((a,v,i)=>a+v-pars[i],0)+(R.r?R.base|0:0))+' thru '+k+(R.r?'':' (of 18)');return''}
function t8QFields(C){const st=[0,1,2].map(t=>t8Stand(C,t,EVENTS8));return[0,1].map(b=>st[b+1].slice(-3).map(x=>x.id).concat(st[b].slice(3,10).map(x=>x.id)))}
function t8QField(C){const q=C.cur.q;return q?q.field:[]}
function t8QRes(C,b,F){const rows=F.map(id=>{const h=[0,1].map(r=>id<0?C.cur.me8[t8K(6,r)]:t8H(C,3+b,6,r,id));if(id<0&&(C.cur.skip8[6]||!h[1]))return{id,sc:999,cb:[999,999,999,999],skip:!!C.cur.skip8[6]};const b2=h[1];return{id,sc:t8Sum(h[0])+t8Sum(b2),cb:[t8Sum(b2),t8Sum(b2.slice(3)),t8Sum(b2.slice(6)),b2[8]]}});
  rows.sort((a,c)=>a.sc-c.sc||a.cb[0]-c.cb[0]||a.cb[1]-c.cb[1]||a.cb[2]-c.cb[2]||a.cb[3]-c.cb[3]||a.id-c.id);rows.forEach((x,i)=>{x.pos=i+1;x.card=i<Q_CARDS});return rows}
function t8End(C){const st=[0,1,2].map(t=>t8Stand(C,t,EVENTS8)),QF=t8QFields(C),up=[[],[],[]],down=[[],[],[]],names=a=>a.filter(id=>id>=0).map(id=>C.players[id].name),Qr=[0,1].map(b=>t8QRes(C,b,QF[b]));
  const mem=[0,1,2].map(t=>new Set(t8Mem(C,t)));for(let b=0;b<2;b++){const pro=st[b].slice(0,3).map(x=>x.id),cards=Qr[b].filter(x=>x.card).map(x=>x.id),bot=st[b+1].slice(-3).map(x=>x.id),drop=bot.filter(id=>!cards.includes(id)),rise=cards.filter(id=>!bot.includes(id));
    for(const id of pro.concat(rise)){mem[b].delete(id);mem[b+1].add(id)}for(const id of drop){mem[b+1].delete(id);mem[b].add(id)}up[b]=pro.concat(rise);down[b+1]=drop}
  const from=C.tier,to=[0,1,2].find(t=>mem[t].has(-1)),moved=to-from,retired=[...mem[2]].filter(id=>id>=0).sort((a,b)=>t8Age(C,C.players[b])-t8Age(C,C.players[a])||a-b).slice(0,Math.max(0,mem[2].size-FIELD8));
  for(const id of retired){mem[2].delete(id);C.players[id].ret=C.season}const R=mulberry32(thash(C.seed,C.season,883)),N=t8Names(C),rookies=[];while(mem[0].size<FIELD8){const p=t8New(C,R,0,N,20,23);mem[0].add(p.id);rookies.push(p.name)}
  const me=st[from].find(r=>r.me),wins=me.wins,mj=st[from].find(r=>r.me).ev[4];if(me.rank===1)featAdd('season');if(moved>0)featAdd('promo');if(from===2&&mj&&mj.made&&mj.pos===1)featAdd('major');const myQ=[0,1].map(b=>Qr[b].find(x=>x.id<0)).find(Boolean)||null;
  C.hist.push({s:C.season,tier:from,rank:me.rank,pts:Math.round(me.pts),wins,moved,champ:st[from][0].name,major:mj?(mj.made?mj.pos:0):null,q:myQ?myQ.pos:null,v8:1});
  C.cur.done={v8:1,moved,rank:me.rank,up:up.map(names),down:down.map(names),champs:st.map(s=>s[0].me?'You':s[0].name),from,retired:names(retired),rookies,q:myQ,Q:Qr.map((L,b)=>L.map(x=>({id:x.id,name:x.id<0?'You':C.players[x.id].name,sc:x.sc,card:x.card,pos:x.pos}))),
    tables:st.map(rows=>rows.map(r=>({id:r.id,name:r.name,me:!!r.me,rank:r.rank,pts:Math.round(r.pts),ev:r.ev.map(x=>x?t8Cell(x):null)})))};
  for(let t=0;t<3;t++)C.roster[t]=[...mem[t]].filter(id=>id>=0);C.tier=to;C.cur.cup={state:'ready'};t8Jour(C,'season',[retired.length?'Farewell to '+names(retired).join(', ')+', retiring from the World tour.':'',rookies.length?'New on the Regional tour: '+rookies.join(', ')+'.':''].filter(Boolean))}
function t8Cell(x){return x.skip?'–':x.made===false?'MC':x.stage!=null?['R16','QF','SF','F','W'][x.stage]:x.pos!=null?x.pos:null}
function t8Jour(C,kind,text,e){if(!text.length)return;C.journal.push({s:C.season,kind,e:e==null?0:e,text});C.journal=C.journal.slice(-JOURNAL_MAX)}
function t8Next(C){if(!t8Is(C)||C.cur.done)return null;const e=C.cur.ev;if(e<EVENTS8){if(e===2){const m=t8KOMine(C);if(m.out)return{e,out:1};if(m.done)return{e,fin:1};const P=C.cur.ko8[m.r];if(P&&P.w==null)return{e,r:m.r,po:P.n,opp:m.opp};return{e,r:m.r,opp:m.opp}}
    if(e===5&&!t8Champs(C,C.tier).includes(-1))return{e,out:1};const P=C.cur.po8[e];if(P&&P.w==null)return{e,r:t8Rounds(e)-1,po:P.n,rv:P.rv};for(let r=0;r<t8Rounds(e);r++)if(!C.cur.me8[t8K(e,r)]){if(r&&(e===4||e===5)){const L=t8Ev(C,C.tier,e),x=L.r0.find(q=>q.id<0);if(!x||x.sc>L.cut)return{e,fin:1}}return{e,r}}return{e,fin:1}}
  if(e===6){const q=C.cur.q;if(!q||q.done)return null;for(let r=0;r<2;r++)if(!C.cur.me8[t8K(6,r)])return{e:6,r,q:1};return null}return null}
function t8Event(){const C=S.car;t8Auto(C);const N=t8Next(C);if(!N||N.out||N.fin){carSave();carPanel();return}const t=C.tier,e=N.e,r=N.r|0;let cond=t8Cond(C,t,e,r),bot=0,pid=null,j=null;
  if(e===2){const o=C.players[N.opp];pid=o.id;bot=carBot(C,o,e);if(N.po){bot=Object.assign({},bot,{id:bot.id+1000*N.po})}}
  else if(e===3){const P=t8Pairs(C,t).find(p=>p.pid===-1),mate=C.players[P.ids.find(id=>id>=0)];S.cupPending={ses:1,mi:0,v8:1,pT:carBot(C,mate,e),pR:mulberry32(thash(C.seed,C.season,813))};pid=null}
  else if(N.po){const o=C.players[N.rv];pid=o.id;bot=Object.assign({},carBot(C,o,e),{id:100+o.id+1000*N.po})}
  else{const F=t8Draw(C,t,e,r,t8Field(C,t,e,r)),me=F.find(x=>x.id<0),grp=me?F.filter(x=>x.g===me.g&&x.id>=0&&x.id<1000):[],nem=carNemesis(C),o=grp.find(x=>nem&&x.id===nem.id)||grp[0];if(o){pid=o.id;bot=carBot(C,C.players[o.id],e)}}
  if(N.po){j=islJ({kind:cond.kind},8);cond=Object.assign({},cond,{kind:6|j<<3})}
  const seed=e>=6?t8QSeed(C):C.cur.tiers[t].seeds[e];islPrep(seed,cond.kind,cond.islDay);S.setup=cond.setup;S.season=cond.se;S.wear=cond.wear;seedIn.value=seed;S.recvOverride=null;
  S.carPending={v8:1,e,r,pid,po:N.po||null,q:e>=6?1:null,base:e>=6&&r?t8Sum(C.cur.me8[t8K(6,0)])-carPars(t8Cond(C,t,6,0)).reduce((a,b)=>a+b,0):0};S.golferPending=golfPack(C,e===3?1:0);carSave();startRound(N.po?1:9,null,null,bot);if(N.po&&bot)lowerThird('SD','Sudden death · hole '+N.po,' '+esc(bot.n||'')+' plays first')}
function t8Finish(s){const C=S.car,R=S.carRound;S.carRound=null;if(!C||!R)return;const e=R.e,r=R.r|0,t=C.tier,holes=S.strokes.map(v=>v|0),gh=S.ghost&&R.pid!=null?S.pars.map((p,h)=>holeStrokes(ghostLog(h),p)):null,D=S.carDone={v8:1,e,r,po:R.po,q:R.q};
  if(R.po){const P=e===2?C.cur.ko8[r]:C.cur.po8[e],a=holes[0],b=gh?gh[0]:a;if(a<b)P.w=1;else if(a>b)P.w=0;else if(R.po>=PLAYOFF_MAX){const m=t8KOMine(C);P.w=e===2?(m.my<m.seed?1:0):-1}else P.n=R.po+1;D.pw=P.w;CAR_C.clear();t8After(C,e);carSave();return}
  const key=t8K(e,r),L=S.fieldCache&&S.fieldCache.key==='t8/'+C.season+'/'+e+'/'+r?leadResults():{};C.cur.me8[key]=holes;const re=C.cur.real8[key]=C.cur.real8[key]||{};if(gh)re[R.pid]=gh;if(S.fieldCache&&S.fieldCache.lead)for(const x of S.fieldCache.lead)re[x.m.id]=x.sc.slice();CAR_C.clear();
  if(e===2){const m=t8Match(holes,gh||holes);if(m.w<0)C.cur.ko8[r]={n:1,w:null};D.ko={opp:R.pid,m}}
  else if(e<6&&(e!==4&&e!==5||r===1)){const Lv=t8Ev(C,t,e),me=Lv.find(x=>x.id<0),first=Lv.filter(x=>x.pos===1&&x.id!==-1);if(me&&me.pos===1&&first.length===1&&e!==3)C.cur.po8[e]={n:1,w:null,rv:first[0].id}}
  t8After(C,e);if(e>=6&&C.cur.done&&C.cur.done.q&&C.cur.done.q.card)D.qcard=1;carSave()}
function t8After(C,e){const N=t8Next(C);if(e>=6){if(!N){C.cur.q.done=1;t8End(C)}return}if(N&&N.e===e&&!N.out&&!N.fin)return;if(C.cur.ev===e)t8Done(C);t8Auto(C)}
function t8Auto(C){let N=t8Next(C),g=0;while(N&&(N.out||N.fin)&&C.cur.ev<EVENTS8&&g++<8){t8Done(C);N=t8Next(C)}}
function t8Done(C){const e=C.cur.ev,t=C.tier;if(e>=EVENTS8)return;for(let u=0;u<3;u++)if(u!==t)t8Ev(C,u,e);const L=t8Ev(C,t,e),me=L.find(x=>x.id<0),D=S.carDone&&S.carDone.v8&&S.carDone.e===e?S.carDone:null;
  const pay=me&&me.pts>0?carPay(C,me.pts):0;if(D){D.pay=pay;D.pos=me?me.pos:null;D.pts=me?me.pts:0;D.done=1}
  if(e!==3)for(const x of L){if(x.id<0||!me||me.pos==null||x.pos==null)continue;const h=C.h2h[x.id]||(C.h2h[x.id]=[0,0,0]);h[2]++;if(x.pos<me.pos)h[0]++;else if(x.pos>me.pos)h[1]++}
  const where=islName(C.cur.tiers[t].seeds[e]),w=L.find(x=>x.pos===1),wn=w?(w.id<0?'you':w.id>=1000?'a pair':C.players[w.id]?C.players[w.id].name:'—'):'—';
  t8Jour(C,'event',[t8Skipped(C,e)?'You sat out '+F8_S[e]+' at '+where+'.':me&&me.pos?(me.pos===1?'You won '+F8_S[e]+' at '+where+'.':F8_N[e]+' at '+where+': '+ordn(me.pos)+(me.stage!=null&&e===2?' (out in '+KO_SN[me.stage]+')':'')+', '+wn+' won.'):F8_N[e]+' at '+where+': '+wn+' won.'],e);
  C.cur.ev++;if(C.cur.ev>=EVENTS8){const QF=t8QFields(C),b=QF.findIndex(F=>F.includes(-1));C.cur.q=b>=0?{b,field:QF[b],done:0}:{b:-1,field:[],done:1};C.cur.ev=6;if(b<0)t8End(C)}CAR_C.clear()}
function t8Skip(){const C=S.car,N=t8Next(C);if(!N)return;if(N.e>=6){C.cur.skip8[6]=1;C.cur.q.done=1;t8End(C)}else{C.cur.skip8[N.e]=N.e===2?(N.r|0)+1:1;CAR_C.clear();t8Done(C);t8Auto(C)}carSave();AU.play('ui');carPanel()}
const t8Ic=e=>F8_I[e]?'<svg class="ic" aria-hidden="true"><use href="#i-'+F8_I[e]+'"/></svg>':'';
function t8Where(C,t,e,r){const c=t8Cond(C,t,e,r||0);return islName(c.seed)+', '+islRoutingName(c.kind,9).replace(/^Routing/,'routing')+' · '+SEASONS[c.se].n.toLowerCase()}
function t8Mine(C,e){if(e>=C.cur.ev)return null;if(t8Skipped(C,e))return'skipped';const x=t8Ev(C,C.tier,e).find(q=>q.id<0);if(!x)return e===2?'not in the 16':e===5?'not in the 8':'—';return e===2&&x.stage!=null?['R16','QF','SF','final','won'][x.stage]+' · '+x.pts+' pts':x.made===false?'MC':ordn(x.pos)+' · '+Math.round(x.pts)+' pts'}
function t8EvRow(C,e){const cur=!C.cur.done&&C.cur.ev===e,m=t8Mine(C,e);return'<div class="t8ev'+(cur?' cur':'')+(t8Big(e)?' big':'')+'"><span class="g">'+(t8Ic(e)||'+')+'</span><b>'+F8_N[e]+'</b><span class="w">'+esc(t8Where(C,C.tier,e,0))+'</span><span class="m">'+(m||(cur?'next':'·'))+'</span></div>'}
function t8NextText(C,N){const t=C.tier,e=N.e;if(N.out)return e===2?'The knockout takes the top 16 after two events: you are outside them, so the week passes.':'The championship is for the top '+CHAMP8+': you are outside them.';if(N.fin)return F8_N[e]+' is over for you.';
  if(e>=6){const q=C.cur.q;return'Q-school · '+Q_FIELD+' play for '+Q_CARDS+' '+TIER_NAMES[q.b+1]+' cards · round '+(N.r+1)+' of 2 on '+esc(t8Where(C,t,6,N.r))}
  if(N.po)return'Sudden death at the 9th against '+esc(C.players[e===2?N.opp:N.rv].name)+' · hole '+N.po+' of '+PLAYOFF_MAX+(e===2?'':' (then the title is shared)');
  if(e===2){const m=t8KOMine(C);return'The knockout · the '+KO_RN[N.r]+' against '+esc(C.players[N.opp].name)+' (seed '+m.seed+'; you are seed '+m.my+') · '+esc(t8Where(C,t,2,N.r))}
  if(e===3){const P=t8Pairs(C,t).find(p=>p.pid===-1),mate=C.players[P.ids.find(id=>id>=0)];return'The foursomes · with '+esc(mate.name)+' ('+STYLE_NAMES[mate.style]+'), alternate shot: you drive the odd holes · '+esc(t8Where(C,t,3,0))}
  if((e===4||e===5)&&N.r){const L=t8Ev(C,t,e),x=L.r0.find(q=>q.id<0),par=t8Pars(C,t,e,0).reduce((a,b)=>a+b,0);return F8_N[e]+' · the second nine · '+ordn(L.r0.indexOf(x)+1)+' after the first (the cut fell at '+relS(L.cut-par)+') · '+esc(t8Where(C,t,e,1))}
  return F8_N[e]+(e>=4?' · two nines, the cut after the first (top half and ties), points doubled':e===1?' · eagle +5 · birdie +2 · par 0 · bogey −1 · double −3':'')+' · '+esc(t8Where(C,t,e,0))+' · '+PINS.names[T8_PINS[e][0]]}
function t8Race(C){if(C.cur.ev!==5)return'';const ch=t8Champs(C,C.tier);if(!ch.includes(-1))return'';const st=t8Stand(C,C.tier,5),me=st.find(r=>r.me),P=[0,1,2,3].map(i=>POINTS8[i]*BIG),fins=[[0,'win'],[2,'finish 3rd'],[-1,'miss the cut']];
  const rows=st.filter(r=>!r.me&&ch.includes(r.id)&&r.pts+P[0]>=me.pts&&r.pts<=me.pts+P[0]).slice(0,5);if(!rows.length)return'';
  const need=(r,f)=>{const mine=me.pts+(f<0?0:P[f]);if(r.pts>mine)return'passes you anyway';for(let g=3;g>=0;g--)if(r.pts+P[g]>mine)return(g?ordn(g+1)+' or better':'the win');return'can’t pass'};
  return'<div class="sub" style="margin:8px 0 2px;color:var(--ink)">The race before the championship · you have '+Math.round(me.pts)+'</div><table class="t8race"><tr><th style="text-align:left">Rival</th><th>Pts</th>'+fins.map(f=>'<th>if you '+f[1]+'</th>').join('')+'</tr>'+rows.map(r=>'<tr'+(r.pts>=me.pts?' style="color:var(--bad)"':r.pts+P[1]>me.pts?' style="color:var(--acc)"':'')+'><td style="text-align:left">'+esc(r.name)+'</td><td>'+Math.round(r.pts)+'</td>'+fins.map(f=>'<td>'+need(r,f[0])+'</td>').join('')+'</tr>').join('')+'</table>'}
function t8Panel(el,C){if(!C.cur.done)t8Auto(C);const D=C.cur.done,st=D?null:t8Stand(C,C.tier),me=st&&st.find(r=>r.me),N=D?null:t8Next(C);S.t8skip=0;
  let h='<div class="tourbox"><div class="sub" style="margin:0 0 6px"><b style="color:var(--ink)">Season '+C.season+' · '+TIER_NAMES[D?D.from:C.tier]+' tour</b>'+(me&&C.cur.ev?' · '+ordn(me.rank)+' of '+st.length+' with '+Math.round(me.pts)+' points':' · '+FIELD8+' players, '+EVENTS8+' events')+'</div><div class="t8evs">'+[0,1,2,3,4,5].map(e=>t8EvRow(C,e)).join('')+'</div>';
  if(!D&&N){const play=!N.out&&!N.fin,lab=N.e>=6?'Play Q-school · round '+(N.r+1):N.po?'Play sudden death':N.e===2?'Play the '+KO_RN[N.r]:N.r?'Play the second nine':'Play '+F8_S[N.e];
    h+='<div class="sub" style="margin:8px 0 6px;font-size:13px">'+t8NextText(C,N)+'</div><div class="row" style="margin:0;flex-wrap:wrap"><button id="carPlay" class="big" style="font-size:16px;padding:10px 20px">'+(play?lab:'Continue')+'</button>'+(play?'<button id="carSkip" class="sec" title="Zero points, no prize money; the field plays it">Skip</button>':'')+'<button id="carTable" class="sec">Standings</button>'+(C.cur.ev>=2?'<button id="carKO" class="sec">Bracket</button>':'')+'<button id="carHist" class="sec">History</button></div>'+t8Race(C)}
  else if(D){const mv=D.moved>0?' — up to the '+TIER_NAMES[C.tier]+' tour':D.moved<0?' — down to the '+TIER_NAMES[C.tier]+' tour':'',q=D.q;
    h+='<div class="sub" style="margin:8px 0 6px;font-size:15px;color:var(--ink)">Season complete: '+ordn(D.rank)+' of '+FIELD8+mv+'</div>'+(q?'<div class="sub" style="font-size:13px">Q-school: '+(q.skip?'skipped, so last':ordn(q.pos)+' of '+Q_FIELD)+(q.card?' — a card':' — no card')+'</div>':'')+'<div class="sub" style="font-size:13px;margin:0 0 6px">Champions: '+TIER_NAMES.map((n,t)=>n+' '+esc(D.champs[t])).join(' · ')+'</div>'+(D.retired&&D.retired.length?'<div class="sub" style="font-size:12px">Retiring: '+D.retired.map(esc).join(', ')+' · new: '+D.rookies.map(esc).join(', ')+'</div>':'')+(typeof cupHtml==='function'?cupHtml(C):'')+
      '<div class="row" style="margin:0">'+(C.cur.cup&&C.cur.cup.state==='ready'&&typeof cupStart==='function'?'<button id="carCup" class="big" style="font-size:16px;padding:10px 20px">'+(C.cup&&C.cup.s===C.season&&C.cup.res.length?'Play the foursomes':'Play the team cup')+'</button><button id="carCupSkip" class="sec">Let it play out</button>':'<button id="carNext" class="big" style="font-size:16px;padding:10px 20px">Start season '+(C.season+1)+'</button>')+'<button id="carTable" class="sec">Standings</button><button id="carHist" class="sec">History</button></div>'}
  h+='</div>'+golferHtml(C)+(C.journal&&C.journal.length&&typeof journalHtml==='function'?journalHtml(C,2):'')+'<div class="sub" style="font-size:12px">Home: '+islLine(C.home)+'</div>';el.innerHTML=h;const on=(id,f)=>{const b=$(id);if(b)b.onclick=f};
  on('carPlay',()=>careerEvent());on('carSkip',()=>{const b=$('carSkip');if(!S.t8skip){S.t8skip=1;b.textContent='Skip: sure?';return}t8Skip()});
  on('carTable',()=>{$('tourBody').innerHTML='<div class="sub" style="color:var(--ink)">'+TIER_NAMES[D?D.from:C.tier]+' tour · season '+C.season+'</div>'+carTableHtml(C,D?D.from:C.tier)+carOthersHtml(C);$('tourOv').classList.remove('hide')});
  on('carKO',()=>{$('tourBody').innerHTML=t8KOHtml(C);$('tourOv').classList.remove('hide')});on('carHist',()=>{$('tourBody').innerHTML=carHistHtml(C);$('tourOv').classList.remove('hide')});
  on('carNext',()=>{if(typeof journalSeason==='function'&&!C.cur.jDone)journalSeason(C);newSeason(C);carSave();AU.play('good');carPanel()});on('carCup',()=>cupStart());on('carCupSkip',()=>{cupSim(C);carSave();carPanel()});golferWire(C)}
function t8TableHtml(C,t){const D=C.cur.done,rows=D?D.tables[t]:t8Stand(C,t).map(r=>({id:r.id,name:r.name,me:!!r.me,rank:r.rank,pts:Math.round(r.pts),ev:r.ev.map(x=>x?t8Cell(x):null)})),nem=carNemesis(C);
  let h='<table><tr><th>Pos</th><th style="text-align:left">Player</th><th>Style</th><th>Age</th>'+[0,1,2,3,4,5].map(e=>'<th'+(t8Big(e)?' style="color:var(--acc)"':'')+' title="'+F8_N[e]+'">'+(t8Ic(e)||'+')+'</th>').join('')+'<th>Pts</th></tr>';
  for(const r of rows){const p=r.id>=0?C.players[r.id]:null,isN=nem&&nem.id===r.id,n=rows.length,mv=D?(r.rank<=3&&t<2?' ↑':r.rank>n-3&&t>0?' Q':''):'';
    h+='<tr'+(r.me?' style="color:var(--acc);font-weight:600"':isN?' style="color:var(--bad)"':'')+'><td>'+r.rank+mv+'</td><td style="text-align:left">'+esc(r.name)+(p&&p.nw===C.season?' <small class="t8new">new</small>':'')+(isN?' <small>N</small>':'')+'</td><td style="font-size:12px;color:var(--dim)">'+(p?STYLE_NAMES[p.style]:'')+'</td><td>'+(p&&p.a0!=null?t8Age(C,p):'')+'</td>'+r.ev.map(v=>'<td>'+(v==null?'·':v)+'</td>').join('')+'<td><b>'+r.pts+'</b></td></tr>'}
  return h+'</table>'}
function t8KOHtml(C){const t=C.cur.done?C.cur.done.from:C.tier,K=t8KO(C,t),nm=id=>id==null?'—':id<0?'You':esc(C.players[id].name.split(' ').pop()),sd=id=>K.seeds.indexOf(id)+1;
  return'<div class="sub" style="color:var(--ink)">The knockout · '+TIER_NAMES[t]+' tour · the top 16 after two events</div>'+(C.cur.ev<2?'<p class="sub">The draw is made after the Stableford.</p>':K.rounds.map((M,r)=>'<div class="sub" style="margin:6px 0 2px"><b>'+KO_RN[r][0].toUpperCase()+KO_RN[r].slice(1)+'</b></div>'+M.map(m=>{const w=m.res?(m.res.w===0?m.a:m.b):null,how=m.res?(m.res.wo?'walkover':m.res.sd?'at the '+ordn(m.res.sd)+' extra hole':Math.abs(m.res.up)+(m.res.thru<9?'&'+(9-m.res.thru):' up')):'to play';
    return'<div class="t8m'+(m.a<0||m.b<0?' me':'')+'"><span'+(w===m.a?' class="w"':'')+'>('+sd(m.a)+') '+nm(m.a)+'</span> v <span'+(w===m.b?' class="w"':'')+'>('+sd(m.b)+') '+nm(m.b)+'</span> · '+how+'</div>'}).join('')).join(''))}
function t8CardHtml(d){const C=S.car;if(!C)return'';const t=C.cur.done?C.cur.done.from:C.tier,e=d.e;let h='';
  const next=()=>{const N=t8Next(C);return N&&!N.out&&!N.fin?'<div class="row"><button id="btnCarNext" class="big">'+(N.po?'Sudden death':N.e>=6?'Q-school round '+(N.r+1):N.e===e&&e===2?'The '+KO_RN[N.r]:N.e===e&&N.r?'The second nine':'Next: '+F8_S[N.e])+'</button></div>':'<div class="row"><button id="btnCarCard" class="big">Season card</button></div>'},pay=d.pay?' · <b class="g8pay" data-to="'+d.pay+'">+'+money(d.pay)+'</b>':'';
  if(d.po){const w=d.pw;h='<div class="sub" style="font-size:18px;color:var(--acc)">Sudden death, hole '+d.po+': '+(w===1?'you win':w===0?'you lose':w===-1?'the title is shared':'halved — another hole')+'</div>'}
  else if(e===2&&d.ko){const m=d.ko.m,o=esc(C.players[d.ko.opp].name);h='<div class="sub" style="font-size:18px">The knockout · '+KO_RN[d.r]+' against '+o+': '+(m.w===0?'won '+Math.abs(m.up)+(m.thru<9?'&'+(9-m.thru):' up'):m.w===1?'lost '+Math.abs(m.up)+(m.thru<9?'&'+(9-m.thru):' down'):'all square after nine — sudden death at the 9th')+'</div>'}
  else if((e===4||e===5)&&d.r===0){const L=t8Ev(C,t,e),par=t8Pars(C,t,e,0).reduce((a,b)=>a+b,0),i=L.r0.findIndex(x=>x.id<0),x=L.r0[i],made=x&&x.sc<=L.cut;
    h='<div class="sub" style="font-size:18px;color:var(--acc)">'+F8_N[e]+' · after the first nine you are '+ordn(i+1)+' · the cut fell at '+relS(L.cut-par)+(made?' — you play the second nine':' — missed the cut by '+(x.sc-L.cut))+'</div><table><tr><th>Pos</th><th style="text-align:left">Player</th><th>Nine</th></tr>'+L.r0.slice(0,Math.min(L.r0.length,Math.max(8,i+1))).map((q,j,A)=>'<tr'+(q.id<0?' style="color:var(--acc);font-weight:600"':'')+(j&&A[j-1].sc<=L.cut&&q.sc>L.cut?' class="cutline"':'')+'><td>'+(j+1)+'</td><td style="text-align:left">'+(q.id<0?'You':esc(C.players[q.id].name))+'</td><td>'+relS(q.sc-par)+'</td></tr>').join('')+'</table>'}
  else if(d.q){const q=C.cur.q,b=q?q.b:-1,R=b>=0?t8QRes(C,b,q.field):[],me=R.find(x=>x.id<0);h='<div class="sub" style="font-size:18px;color:var(--acc)">Q-school'+(d.r?' · final':' · after round 1')+': '+(me?ordn(me.pos)+' of '+Q_FIELD:'')+(d.r&&me?(me.card?' — a '+TIER_NAMES[b+1]+' card':' — no card'):'')+'</div>'}
  if(d.done){const L=t8Ev(C,t,e).filter(x=>x.pos!=null),me=L.find(x=>x.id<0),top=L.slice().sort((a,b)=>a.pos-b.pos).filter((x,i,A)=>A.findIndex(y=>y.id===x.id)===i).slice(0,6);h+='<div class="sub" style="font-size:18px">'+F8_N[e]+(me?' · you finished '+ordn(me.pos)+' ('+Math.round(me.pts)+' pts)':' · '+(t8Skipped(C,e)?'skipped':'done'))+pay+'</div>';
    if(e!==2&&e!==3)h+='<div class="sub" style="font-size:13px">'+top.map(x=>ordn(x.pos)+' '+(x.id<0?'you':esc(C.players[x.id].name))+' '+(e===1?x.sc+' pts':relS(x.sc-t8Pars(C,t,e,0).reduce((a,b)=>a+b,0)*(e>=4?2:1)))).join(' · ')+'</div>'}
  return h+(C.cur.done?'<div class="sub">'+(C.cur.done.q?'Q-school: '+(C.cur.done.q.card?'a card':'no card')+' · ':'')+'Season complete: '+ordn(C.cur.done.rank)+'</div>':'')+next()}
function t8Winners(){if(S.t8win)return S.t8win;const T={roster:[[],[],[]],players:[],tier:0,seed:4242,season:1,home:1234,cur:{ss:4242,ev:0,v8:2,s8:1}};t8Start(T);const out=[0,1].map(t=>{const L=t8Ev(T,t,0),par=t8Pars(T,t,0,0).reduce((a,b)=>a+b,0);return L.length?L[0].sc-par:0});CAR_C.clear();return S.t8win=out}
function t8Base(){const X=t8Round();if(!X)return 0;const{C,R,t,e,r}=X;if(R.q!=null)return R.r?R.base|0:0;return(e===4||e===5)&&r&&C.cur.me8[t8K(e,0)]?t8Sum(C.cur.me8[t8K(e,0)])-t8Pars(C,t,e,0).reduce((a,b)=>a+b,0):0}
function t8Thr(k){const X=t8Round(),rows=X&&X.e!==1?t8Rows(k):null,b=rows&&rows.find(r=>!r.me);return b?{rel:b.rel,name:b.short}:{rel:99,name:''}}
function t8Resume(){const C=S.car,R=S.carRound;if(!C||!t8Is(C)||!R||R.e!==3||S.cup)return;const P=t8Pairs(C,C.tier).find(p=>p.pid===-1),mate=P&&C.players[P.ids.find(id=>id>=0)];if(mate)S.cup={ses:1,mi:0,v8:1,pT:carBot(C,mate,3),pR:mulberry32(thash(C.seed,C.season,814))}}
function t8TierPick(){const W8=t8Winners();return'<div class="sub" style="margin:6px 0 4px">Start on</div><div class="seg">'+[0,1].map(t=>'<button data-tier="'+t+'" class="'+(t===(S.t8tier|0)?'sel':'')+'">'+TIER_NAMES[t]+' · winners '+relS(W8[t])+' a nine</button>').join('')+'</div><p class="sub" style="font-size:12px;margin:2px 0 6px">World is earned. Your stats start at 0 either way.</p>'}
