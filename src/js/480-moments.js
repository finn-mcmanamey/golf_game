/* ===== M4 · moments and information: F-108 essentials HUD, F-105 near-miss margins, F-104 earned celebrations, F-106 the sound set, F-107 trails and the shot-map card, F-109 click a target, F-110 first-time tips. Nothing here stops a shot, asks for a click or changes a number; every moment derives from the shot's own simulation, so a replay shows the same ===== */
const HUD_KEY='h',HUD_TOP=28,HUD_FADE=tuneDef('F-108','HUD_FADE',150,'ui','the full HUD fades in over this, ms (out over twice it)',50,400,10),TICKER_T=tuneDef('F-108','TICKER_T',4,'ui','after a shot ends the full HUD and the ticker stay this long, s',1,10,.5);
setDef('hudFull',0);const HUD4={hold:false,edge:false,lite:false};
const hudLite=()=>!SETS.hudFull&&S.mode==='aim'&&S.ph===0&&!S.sw&&!S.lab&&!S.range&&!S.replay&&!S.hs&&!HUD4.hold&&!HUD4.edge&&S.t-S.shotEnd>TUNE.TICKER_T;
function hud4Tick(){const l=hudLite();if(l!==HUD4.lite){HUD4.lite=l;if(typeof document!=='undefined'&&document.body)document.body.classList.toggle('hudlite',l);if(!l&&BC.rvP)rvPulse()}}
/* M3: the rival's pulse waits for the ticker (the Essentials HUD hides it while you aim) and plays when it next shows, between shots */
function rvPulse(){BC.rvP=false;BC.rvPn=(BC.rvPn|0)+1;const el=typeof document!=='undefined'&&document.querySelector?document.querySelector('#ticker .r.rv'):null;if(!el||!el.classList)return;el.classList.remove('m3pulse');void el.offsetWidth;el.classList.add('m3pulse')}
const MARGIN_CUP=tuneDef('F-105','MARGIN_CUP',.05,'ui','a rolling ball this close to the cup\'s edge without holing is a miss told, m',.01,.2,.01),MARGIN_ACE=tuneDef('F-105','MARGIN_ACE',3,'ui','a par-3 tee shot finishing inside this is "from an ace", m',1,6,.5),MARGIN_HAZ=tuneDef('F-105','MARGIN_HAZ',3,'ui','a carry that clears water, sand or the edge by less than this is told, m',1,6,.5),MARGIN_TREE=tuneDef('F-105','MARGIN_TREE',.5,'ui','a flight this close to a canopy or a wall\'s top is told, m',.1,1.5,.1),MARGIN_T=tuneDef('F-105','MARGIN_T',2,'ui','a margin line stays this long, s',1,4,.5);
const MG={on:false,px:0,py:0,pz:0,cupMin:1e9,treeMin:1e9,wallMin:1e9,hit:false,carry:null};
function marginStart(){MG.on=true;MG.px=PB.x;MG.py=PB.y;MG.pz=PB.z;MG.cupMin=1e9;MG.treeMin=1e9;MG.wallMin=1e9;MG.hit=false;MG.carry=null;S.margin=null}
const segD4=(px,pz,ax,az,bx,bz)=>{const ex=bx-ax,ez=bz-az,l2=ex*ex+ez*ez||1e-9,u=clamp(((px-ax)*ex+(pz-az)*ez)/l2,0,1);return MM.hyp(px-ax-ex*u,pz-az-ez*u)};
function marginStep(){if(!MG.on||B!==PB)return;const b=PB,ax=MG.px,ay=MG.py,az=MG.pz,bx=b.x,by=b.y,bz=b.z;
  if(b.st==='roll'||(b.st==='air'&&by<W.pin.y+.4)){const d=segD4(W.pin.x,W.pin.z,ax,az,bx,bz);if(d<MG.cupMin)MG.cupMin=d}
  if(b.st==='air'&&by>ay-50){nearTrees(bx,bz,t=>{for(const c of t.cs){const ex=bx-ax,ey=by-ay,ez=bz-az,l2=ex*ex+ey*ey+ez*ez||1e-9,u=clamp(((c.x-ax)*ex+(c.y-ay)*ey+(c.z-az)*ez)/l2,0,1),d=MM.hyp(c.x-ax-ex*u,c.y-ay-ey*u,c.z-az-ez*u)-c.r;if(d<MG.treeMin)MG.treeMin=d}});
    if(W.obs)for(const o of W.obs){if(o.kind!=='wall')continue;const c=MM.cos(o.yaw),s=MM.sin(o.yaw),lx=(bx-o.x)*c-(bz-o.z)*s,lz=(bx-o.x)*s+(bz-o.z)*c;if(Math.abs(lx)<=o.hx&&Math.abs(lz)<=o.hz+.6){const cl=by-BALL_R-(o.y+o.hy);if(cl<MG.wallMin)MG.wallMin=cl}}}
  for(const e of b.ev)if(e==='tree'||e==='wall'||e==='face'||e==='rock'||e==='lip')MG.hit=MG.hit||e;
  MG.px=bx;MG.py=by;MG.pz=bz}
function marginCarry(){if(!MG.on||MG.carry!==null)return;const b=PB,dx=b.x-b.sx,dz=b.z-b.sz,L=MM.hyp(dx,dz)||1,ux=dx/L,uz=dz/L;terrainAt(W,b.x,b.z);if(TQ.ty===7||TQ.ty===6||TQ.ty===8){MG.carry=false;return}
  for(let d=.25;d<=TUNE.MARGIN_HAZ;d+=.25){const x=b.x-ux*d,z=b.z-uz*d;if(oob(W,x,z)){MG.carry={k:'edge',d};return}terrainAt(W,x,z);if(TQ.ty===7||(TQ.wl>-1e8&&TQ.h<TQ.wl)){MG.carry={k:'water',d};return}if(TQ.ty===6){MG.carry={k:'sand',d};return}}MG.carry=false}
function marginText(){if(!MG.on)return null;MG.on=false;const b=PB,st=b.st,fmt=m=>m<10?m.toFixed(1):String(Math.round(m));
  if(st!=='holed'&&MG.cupMin<1e8){const m=MG.cupMin-CUP_R;if(m<0)return{k:'cup',v:.01,text:MG.hit==='lip'?'Lipped out':'Ran over the cup'};if(m<TUNE.MARGIN_CUP)return{k:'cup',v:Math.max(.01,m),text:'Missed by '+Math.max(1,Math.round(m*100))+' cm'}}
  if(st!=='holed'&&W.par===3&&S.stroke===1){const d=MM.hyp(b.x-W.pin.x,b.z-W.pin.z);if(d<TUNE.MARGIN_ACE)return{k:'ace',v:d,text:fmt(d)+' m from an ace'}}
  if(MG.carry&&st!=='water'&&st!=='oob')return{k:MG.carry.k,v:MG.carry.d,text:'Carried the '+(MG.carry.k==='edge'?'edge':MG.carry.k)+' by '+fmt(MG.carry.d)+' m'};
  if(!MG.hit){if(MG.treeMin<TUNE.MARGIN_TREE&&MG.treeMin>-.05)return{k:'tree',v:Math.max(.05,MG.treeMin),text:'Under the branches by '+fmt(Math.max(.05,MG.treeMin))+' m'};if(MG.wallMin<TUNE.MARGIN_TREE&&MG.wallMin>=0)return{k:'wall',v:MG.wallMin,text:'Cleared the wall by '+fmt(Math.max(.05,MG.wallMin))+' m'}}
  return null}
function marginShow(){const m=marginText();if(!m||S.lab||S.range)return;S.margin=m;S.marginShown=true;if(S.cv>=CV_ISL){S.islMg=S.islMg||{};S.islMg[S.hi]=Math.min(S.islMg[S.hi]==null?1e9:S.islMg[S.hi],m.v)}(S.mgLog=S.mgLog||{})[S.hi]=(S.mgLog[S.hi]||[]).concat([m.text]);(S.mgShot=S.mgShot||{})[S.hi+'.'+Math.max(0,(S.log[S.hi]||[]).length-1)]=m.text;if(!S.marginBest||m.v<S.marginBest.v)S.marginBest=m;lower4('Margin',m.text,'',TUNE.MARGIN_T)}
function lower4(tag,title,sub,ttl){if(bcOn()){BC.low={html:'<div class="tag">'+tag+'</div><div class="txt"><b>'+esc(title)+'</b>'+esc(sub||'')+'</div>',at:null,ttl}}else hint(title,ttl)}
const CELEB_R=tuneDef('F-104','CELEB_R',2,'ui','slow motion from this far from the cup, m',.5,5,.25),CELEB_SLOW=tuneDef('F-104','CELEB_SLOW',.35,'ui','the clock inside CELEB_R',.15,.8,.05),ROAR_T=tuneDef('F-104','ROAR_T',2.5,'ui','the roar, s',1,5,.25),ACE_FW=tuneDef('F-104','ACE_FW',3,'ui','fireworks bursts for an ace',1,8,1),ACE_N=tuneDef('F-104','ACE_N',60,'ui','particles a burst',20,120,10);
function celebArm(pre,c){S.celeb=null;if(!pre||pre.st!=='holed'||S.lab||S.range)return;const n0=holeTally(S.log[S.hi]||[],S.seat|0).n;terrainAt(W,PB.x,PB.z);const off=TQ.ty!==4;
  const kind=n0===0?'ace':n0+1<=W.par-2?'eagle':off&&!c.putter?'chip':null;if(kind)S.celeb={kind,t0:S.t,from:MM.hyp(PB.x-W.pin.x,PB.z-W.pin.z)}}
function celebFF(){const C=S.celeb;if(!C||S.mode!=='shot'||FF.down||S.skip)return;const d=MM.hyp(PB.x-W.pin.x,PB.z-W.pin.z);if(C.passed)return;if(d<TUNE.CELEB_R&&(PB.st==='roll'||PB.st==='air'&&PB.y<W.pin.y+.5)){if(C.dmin!=null&&d>C.dmin+.15&&PB.st==='roll'){C.passed=true;return}C.dmin=Math.min(C.dmin==null?d:C.dmin,d);S.ff=Math.min(S.ff,TUNE.CELEB_SLOW)}}
function celebDrop(){const C=S.celeb;if(!C)return;crowd4(1,TUNE.ROAR_T,true);if(C.kind==='ace')S.fw={t0:S.t,n:0};S.celebShown=C;S.celeb=null}
function fwTick(){const F=S.fw;if(!F)return;const due=Math.floor((S.t-F.t0)/(2/TUNE.ACE_FW));if(due>F.n&&F.n<TUNE.ACE_FW){F.n++;const g=W.green,d=MM.hyp(g.x,g.z)||1,x=g.x+g.x/d*(g.r+4)+(Math.random()-.5)*8,z=g.z+g.z/d*(g.r+4)+(Math.random()-.5)*8;terrainAt(W,x,z);burst(x,TQ.h+2+Math.random()*3,z,F.n%2?'fire':'spark',TUNE.ACE_N|0)}if(F.n>=TUNE.ACE_FW&&S.t-F.t0>2.5)S.fw=null}
const CROWD_D=tuneDef('F-106','CROWD_D',6,'ui','applause for a finish inside this, m',2,12,.5),CROWD_N=tuneDef('F-106','CROWD_N',12,'ui','voices in the crowd',4,20,1),AMB_GAIN=tuneDef('F-106','AMB_GAIN',.18,'ui','the ambience bus under the master',0,.5,.02);
const CONTACT_CLASS=[[.7,1.3],[1,1],[1.25,.85],[1,1]];
const clubClass=c=>c.putter?3:c.id<=2?0:/W$/.test(c.s||'')?2:1;
setDef('amb',.6);
function auBus(name){if(!AU.ctx)return null;AU.bus=AU.bus||{};let g=AU.bus[name];if(!g){g=AU.ctx.createGain();g.gain.value=name==='amb'?0:1;g.connect(AU.out());AU.bus[name]=g}return g}
function landPlay(e){if(e!=='bounce'&&e!=='tap'){AU.play(e==='wall'||e==='face'||e==='rock'?'thud':e,e==='bounce'?.6:1);return}
  terrainAt(W,B.x,B.z);const ty=TQ.ty,v=e==='bounce'?.6:.3,k='land'+ty;if(!AU.on||!AU.ctx||S.t-(AU.last4=AU.last4||{})[k]<.06)return;AU.last4[k]=S.t;
  if(ty===4||ty===3){AU.tone(150,90,.05,.22*v);}else if(ty===2||ty===5){AU.tone(170,70,.08,.35*v);AU.hiss(400,.7,.05,.12*v,0,'lowpass')}
  else if(ty<=1){AU.hiss(300,.6,.09,.25*v,0,'lowpass');AU.tone(120,60,.06,.15*v)}else if(ty===6||ty===8){AU.hiss(900,.5,.11,.3*v);AU.tone(110,60,.05,.1*v)}
  else if(ty===9){if(TQ.wl>-1e8){AU.tone(320,180,.12,.3*v);AU.hiss(700,.8,.06,.12*v)}else{AU.tone(1900,1200,.03,.3*v,'square');AU.hiss(3200,1,.02,.2*v)}}else{AU.tone(170,60,.08,.35*v)}}
function crowd4(level,dur,roar){if(!AU.on||!AU.ctx||level<=0)return;const g=auBus('crowd');if(!g)return;const att=cam&&W?clamp(1-MM.hyp(cam.x-W.green.x,cam.z-W.green.z)/160,.35,1):1,n=TUNE.CROWD_N|0,base=level*att*(roar?.09:.06);
  for(let i=0;i<n;i++){const t0=Math.random()*dur*.7,d=.1+Math.random()*(roar?.3:.18);AU.hiss(1100+Math.random()*1200,.5,d,base*(.6+Math.random()*.6),t0);if(roar&&i%3===0)AU.hiss(500+Math.random()*400,.4,d*1.5,base*.5,t0+.05,'lowpass')}}
function finishSound4(holed){if(S.lab||S.range||S.replay)return;if(holed){if(S.celeb)celebDrop();else crowd4(1,1.4,false);return}const d=MM.hyp(PB.x-W.pin.x,PB.z-W.pin.z);if(d<TUNE.CROWD_D)crowd4(1-d/TUNE.CROWD_D,1.2,false)}
const AMB4={surf:null,stream:null,insect:0,inited:false};
function amb4Init(){if(AMB4.inited||!AU.ctx)return;AMB4.inited=true;const c=AU.ctx,bus=auBus('amb'),mk=(type,f,q)=>{const s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=AU.noise;s.loop=true;fl.type=type;fl.frequency.value=f;if(q)fl.Q.value=q;g.gain.value=0;s.connect(fl).connect(g).connect(bus);s.start();return g};AMB4.surf=mk('lowpass',260);AMB4.stream=mk('bandpass',1800,.6)}
function amb4Tick(dt){if(!AU.ctx||!W)return;amb4Init();const bus=auBus('amb');if(!bus)return;const on=AU.on&&S.mode!=='title',duck=(VL.has('m4.look')&&musicAddress())?MUSIC_DUCK:1;auTarget(bus.gain,on?TUNE.AMB_GAIN*SETS.amb*duck:0,.4);
  const b=W.bio;auTarget(AMB4.surf.gain,on&&b===6?.5+.5*MM.sin(S.t*.55):0,.6);auTarget(AMB4.stream.gain,on&&b===5?.45:0,.8);
  if(on&&b===3){AMB4.insect-=dt;if(AMB4.insect<=0){AMB4.insect=3+Math.random()*5;for(let i=0;i<4;i++)AU.hiss(5200+Math.random()*800,3,.05,.05*SETS.amb,i*.12)}}}
const TRAIL_A=tuneDef('F-107','TRAIL_A',.35,'ui','the last shot\'s trail alpha',.1,.8,.05),TRAIL_DECAY=tuneDef('F-107','TRAIL_DECAY',.6,'ui','each earlier shot fades by this per newer shot',.3,.9,.05),MAP_PX=[96,64];
function trails4Reset(i){S.trails=[];S.margin=null;S.celeb=null;S.fw=null}
function trailKeep4(b,col,half){if(!S.trails)return;let pts;if(b.trail.length>=6)pts=b.trail.slice();else{terrainAt(W,b.sx,b.sz);const y0=TQ.h+.08;terrainAt(W,b.x,b.z);pts=[b.sx,y0,b.sz,b.x,TQ.h+.08,b.z]}S.trails.push({pts,col:col||tracerCol(),half:!!half});if(S.trails.length>24)S.trails.shift()}
function trails4Draw(){if(!S.trails||!S.trails.length||S.mode==='title')return;const n=S.trails.length;for(let k=0;k<n;k++){const t=S.trails[k],age=n-1-k,a=TUNE.TRAIL_A*MM.pow(TUNE.TRAIL_DECAY,age)*(t.half?.5:1);if(a<.03)continue;ghostTrail3(t.pts,t.col,a)}}
function shotMap4(rs){const sh=shotsSG6(S.log),rows=[];for(let h=0;h<S.n;h++){const q=sh.filter(x=>x.h===h),par=S.pars[h],sc=S.strokes[h],putts=q.filter(x=>x.ty0===4).length,fir=par>3?(q[0]&&q[0].ty1===2?'✓':'·'):'–',gi=q.findIndex(x=>x.ty0===4),gir=gi>=0&&gi<=par-2?'✓':'·';
    rows.push('<tr><td>'+(h+1)+'</td><td class="'+(sc==null?'':relC(sc-par))+'">'+(sc==null?'·':sc)+'</td><td>'+fir+'</td><td>'+gir+'</td><td>'+putts+'</td><td><canvas class="sm4" data-h="'+h+'" width="'+MAP_PX[0]*2+'" height="'+MAP_PX[1]*2+'" style="width:'+MAP_PX[0]+'px;height:'+MAP_PX[1]+'px"></canvas></td><td class="sub" style="font-size:12px">'+((S.mgLog||{})[h]||[]).map(esc).join(' · ')+'</td></tr>')}
  return'<div class="sm4wrap"><div class="sub" style="text-align:left;margin:6px 0 2px"><b>Every shot</b> · fairway · green in regulation · putts · margins</div><table class="sm4t"><tr><th>Hole</th><th>Score</th><th>Fwy</th><th>GIR</th><th>Putts</th><th>Map</th><th>Margins</th></tr>'+rows.join('')+'</table></div>'}
function shotMapDrawAll(){if(typeof document==='undefined')return;document.querySelectorAll('canvas.sm4').forEach(cv=>{try{shotMapDraw(+cv.dataset.h,cv)}catch(e){}})}
function shotMapDraw(h,cvs){const p=S.real?realPlan(h):holePlan(S.seed,h,S.pars[h],S.cv),g=cvs.getContext('2d'),w=cvs.width,ht=cvs.height;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;const ext=(x,z,r)=>{x0=Math.min(x0,x-r);x1=Math.max(x1,x+r);z0=Math.min(z0,z-r);z1=Math.max(z1,z+r)};for(const c of p.C)ext(c.x,c.z,p.hw(c.t)+2);ext(p.g.x,p.g.z,p.gR+4);ext(0,0,6);
  const L=S.log[h]||[],P=holePath(L,p.pin,S.seat|0,S.cv);for(const o of P)if(o.start){ext(o.start[0],o.start[1],2);ext(o.end[0],o.end[1],2)}
  const dx=x1-x0,dz=z1-z0,long=dz>=dx,sc=Math.min((long?w:ht)/(Math.max(dz,1)+8),(long?ht:w)/(Math.max(dx,1)+8)),X=(x,z)=>long?[w/2+(x-(x0+x1)/2)*sc,ht/2+(z-(z0+z1)/2)*sc*-1+0]:[w/2+(z-(z0+z1)/2)*sc,ht/2+(x-(x0+x1)/2)*sc];
  g.fillStyle=TK('map-bg');g.fillRect(0,0,w,ht);g.lineCap='round';g.lineJoin='round';
  for(const q of p.PD){g.save();const[cx,cy]=X(q.x,q.z);g.translate(cx,cy);g.rotate(long?-q.rot:q.rot+Math.PI/2);g.scale(long?1:1,1);g.fillStyle=TK('map-water');g.beginPath();g.ellipse(0,0,q.rx*sc,q.rz*sc,0,0,TAU);g.fill();g.restore()}
  g.strokeStyle=TK('map-fair');for(let i=0;i+1<p.C.length;i++){const a=p.C[i],b=p.C[i+1];g.lineWidth=Math.max(2,p.hw(a.t)*2*sc);g.beginPath();g.moveTo(...X(a.x,a.z));g.lineTo(...X(b.x,b.z));g.stroke()}
  g.fillStyle=TK('map-green');{const[cx,cy]=X(p.g.x,p.g.z);g.beginPath();g.arc(cx,cy,p.gR*sc,0,TAU);g.fill()}
  for(const b of p.BK){const[cx,cy]=X(b.x,b.z);g.fillStyle=TK('map-sand');g.beginPath();g.ellipse(cx,cy,Math.max(1.5,b.rx*sc),Math.max(1.5,b.rz*sc),long?-b.rot:b.rot+Math.PI/2,0,TAU);g.fill()}
  g.strokeStyle=TK('white',.9);g.lineWidth=1.6;for(const o of P){if(!o.start||o.e.kind!==0||o.e.mu)continue;const a=X(o.start[0],o.start[1]),b=X(o.end[0],o.end[1]);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.fillStyle=TK('white');g.beginPath();g.arc(b[0],b[1],1.8,0,TAU);g.fill()}
  g.fillStyle=TK('map-pin');{const[cx,cy]=X(p.pin.x,p.pin.z);g.beginPath();g.arc(cx,cy,2.2,0,TAU);g.fill()}}
const AIM_STEP=tuneDef('F-109','AIM_STEP',.25,'ui','an arrow key turns the aim this much, degrees',.05,1,.05),AIM_DIST=tuneDef('F-109','AIM_DIST',2,'ui','up and down move the target this far along the line, m',.5,5,.5),TARGET_R=tuneDef('F-109','TARGET_R',.6,'ui','the target ring\'s radius, m',.2,1.5,.1);
let ZM4=null;
function groundAt4(sx,sy){if(!W||!cam)return null;const Wd=innerWidth,Hd=innerHeight,fx=cam.tx-cam.x,fy=cam.ty-cam.y,fz=cam.tz-cam.z,fl=MM.hyp(fx,fy,fz)||1,f=[fx/fl,fy/fl,fz/fl],r=[-f[2],0,f[0]],rl=MM.hyp(r[0],r[1],r[2])||1;r[0]/=rl;r[2]/=rl;const u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
  const th=MM.tan(cam.fov/2),asp=Wd/Hd,nx=(2*sx/Wd-1)*th*asp,ny=(1-2*sy/Hd+(typeof HUDL!=='undefined'?HUDL.sy:0))*th,d=[f[0]+r[0]*nx+u[0]*ny,f[1]+r[1]*nx+u[1]*ny,f[2]+r[2]*nx+u[2]*ny];
  let t=0,x=cam.x,y=cam.y,z=cam.z,step=1;for(let i=0;i<700;i++){t+=step;x=cam.x+d[0]*t;y=cam.y+d[1]*t;z=cam.z+d[2]*t;if(oob(W,x,z))return null;terrainAt(W,x,z);if(y<=TQ.h){let lo=t-step,hi=t;for(let k=0;k<8;k++){const m=(lo+hi)/2;terrainAt(W,cam.x+d[0]*m,cam.z+d[2]*m);if(cam.y+d[1]*m<=TQ.h)hi=m;else lo=m}t=hi;return{x:cam.x+d[0]*t,z:cam.z+d[2]*t}}if(t>600)return null}return null}
function playsTo4(x,z){const d=MM.hyp(x-B.x,z-B.z);if(!W.cv||W.cv<2||d<1)return d;const dx=(x-B.x)/d,dz=(z-B.z)/d,wa=(W.wind.x||0)*dx+(W.wind.z||0)*dz;terrainAt(W,x,z);return Math.max(1,d*(1-caddieWind(S.traj)*wa*gWindK())+CADDIE.rise*(TQ.h-B.y))/(W.air&&W.air<1?airCarry():1)}
function clubForTarget4(x,z){terrainAt(W,B.x,B.z);const onG=TQ.ty===4,d=MM.hyp(x-B.x,z-B.z),last=CLUBS.length-1;if(onG)return;S.sg=false;if(W.cv>=3&&d<=SG.range){S.sg=true;S.sgi=sgDefault(TQ.ty,d);buildClubs();return}const de=playsTo4(x,z);let ci=0;for(let i=last-1;i>=0;i--)if(ownTotal(CLUBS[i])>=de*1.02){ci=i;break}if(ci!==S.club){S.club=ci;buildClubs()}}
function targetSet4(x,z){if(!W||S.mode!=='aim'||S.ph>0)return;terrainAt(W,B.x,B.z);if(TQ.ty===4)return;S.target={x,z,t0:S.t};S.yaw=MM.atan2(x-B.x,z-B.z);S.autoAim=false;clubForTarget4(x,z);AU.play('ui',.6)}
function targetClick4(e){if(S.zoom){closeMap();return}const p=groundAt4(e.clientX,e.clientY);if(p)targetSet4(p.x,p.z)}
function targetMap4(e){if(!ZM4||!S.zoom)return false;const r=$('pmapC').getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;if(px<0||py<0||px>r.width||py>r.height)return false;const a=(px-ZM4.cx)/ZM4.sc,b=(ZM4.cy-py)/ZM4.sc,X=-ZM4.cs*a+ZM4.sn*b,Z=ZM4.sn*a+ZM4.cs*b,x=ZM4.Bx+X,z=ZM4.Bz+Z;if(oob(W,x,z))return false;closeMap();targetSet4(x,z);return true}
function targetNudge4(dm){if(!W||S.mode!=='aim'||S.ph>0)return;let T=S.target;if(!T){const c=curClub(),d=c.putter?MM.hyp(W.pin.x-B.x,W.pin.z-B.z):ownTotalT(c,S.traj);T={x:B.x+MM.sin(S.yaw)*d,z:B.z+MM.cos(S.yaw)*d}}const d=MM.hyp(T.x-B.x,T.z-B.z),nd=Math.max(2,d+dm);targetSet4(B.x+MM.sin(S.yaw)*nd,B.z+MM.cos(S.yaw)*nd)}
function targetDraw4(){const T=S.target;if(!T||S.mode!=='aim'||S.ph>0||S.photo)return;terrainAt(W,T.x,T.z);const k=1+.4*Math.max(0,1-(S.t-T.t0)/.1),c=tracerCol();draw(ringMesh,M4.trs(T.x,TQ.h+.06,T.z,TUNE.TARGET_R*k),[c[0],c[1],c[2],.9])}
const TIP_MAX=32,TIP_T=tuneDef('F-110','TIP_T',4,'ui','a tip stays this long, s',2,8,.5);
setDef('tips',0);
const tipTold=i=>!!(SETS.tips&(1<<i)),tipMark=i=>{SETS.tips|=(1<<i);setSave()};
const nearFace=()=>W.obs&&W.obs.some(o=>o.kind==='face'&&MM.hyp(o.x-PB.x,o.z-PB.z)<TUNE.LIP_D+.3);
const TIPS=[
  ['hud',()=>S.hi===0&&S.stroke===0,()=>'Setup shows the essentials; hover the top edge or hold H for the rest'],
  ['target',()=>S.hi===0&&S.stroke===0,()=>'Right-click the course (or its overview map) to set a target; the caddie picks the club'],
  ['ghosts',()=>S.stroke===0&&(S.ghost||xgFull().length),()=>'Ghosts play the hole shot for shot beside you; the gap line reads best first'],
  ['best',()=>S.stroke===0&&S.ghost&&S.ghost.best,()=>'Your best round on this seed plays alongside in gold; beat it and it is replaced'],
  ['blind',()=>S.stroke===0&&W.crest,()=>'A blind drive: the post on the crest marks the line; play over it and trust the ground'],
  ['twin',()=>S.stroke===0&&W.twin,()=>'A double green: two flags; yours is the one the card named'],
  ['lane',()=>S.stroke===0&&W.arch&&W.arch.lane,()=>'A split fairway: the short route crosses the water, the long one goes round'],
  ['drivable',()=>S.stroke===0&&W.arch&&W.arch.drivable&&W.cv>=7,()=>'A drivable par 4: deep rough flanks a small green; the lay-up is the other line'],
  ['wall',()=>S.stroke===0&&W.obs&&W.obs.some(o=>o.kind==='wall'),()=>'A stone wall crosses this hole: a thin drive stops at it, a carried one flies on'],
  ['rocks',()=>S.stroke===0&&W.obs&&W.obs.some(o=>o.kind==='rock'),()=>'Rocks in play: a ball that hits one deflects, and every bounce is deterministic'],
  ['bridge',()=>S.stroke===0&&W.bridge,()=>'The cart path crosses the water on a bridge; a low ball can skip across'],
  ['winter',()=>S.stroke===0&&W.season===3&&W.trees&&W.trees.length>20,()=>'Winter: bare canopies let most shots through; in summer they stop them'],
  ['gale',()=>W.wind&&W.wind.s>=9,()=>'A gale: a punch (W) flies under most of it; the wind grows with height'],
  ['windh',()=>W.cv>=7&&W.wind&&W.wind.s>=4&&!curClub().putter,()=>'Wind grows with height here: a high ball meets '+TUNE.WIND_GRADIENT+'× the flag\'s wind at its apex'],
  ['deep',()=>{terrainAt(W,PB.x,PB.z);return TQ.ty===1},()=>'Deep rough: the ball comes out low and short; take more club'],
  ['potface',()=>{terrainAt(W,PB.x,PB.z);return TQ.ty===6&&nearFace()},()=>'Under a pot\'s face ('+TUNE.POT_LIP+' m): play out sideways; a low ball will not clear it'],
  ['sand',()=>{terrainAt(W,PB.x,PB.z);return TQ.ty===6&&!nearFace()},()=>'Sand: the splash (short game) throws the ball out; a full swing digs in'],
  ['waste',()=>{terrainAt(W,PB.x,PB.z);return TQ.ty===8},()=>'A waste area: play it like fairway; the club may touch the sand'],
  ['plug',()=>PB.plug,()=>'A plugged lie: the ball sits down; a splash gets it out, nothing else reaches'],
  ['path',()=>S.tipEv==='path',()=>'A ball on a cart path takes free relief: the nearest point off it, no nearer the hole'],
  ['tier',()=>{terrainAt(W,PB.x,PB.z);return TQ.ty===4&&W.gs&&W.gs.k===1},()=>'A two-tier green: from the wrong tier the putt runs on; aim for the flat'],
  ['ridge',()=>{terrainAt(W,PB.x,PB.z);return TQ.ty===4&&W.gs&&W.gs.k===2},()=>'A ridge across the green: a putt over it rolls away on the far side'],
  ['front',()=>{terrainAt(W,PB.x,PB.z);const d=MM.hyp(PB.x-W.pin.x,PB.z-W.pin.z);return TQ.ty!==4&&d<80&&W.gs&&W.gs.k===3},()=>'A false front: a shot that lands short of the flat rolls back off the green'],
  ['cap',()=>W.cv>=7&&S.stroke>=TUNE.STROKE_CAP-2,()=>'A hole ends at '+TUNE.STROKE_CAP+' strokes; the card shows '+TUNE.STROKE_CAP+' with a mark'],
  ['average',()=>!curClub().putter&&ownIs(curClub()),()=>'The dot on a club is your own average carry, the median of your last '+TUNE.AVG_WINDOW+' full swings'],
  ['margin',()=>!!S.marginShown,()=>'A margin line tells a near miss once: the number comes from the shot itself'],['format',()=>S.stroke===0&&fmtOn(),()=>S.format===1?'Stableford: a net double bogey scores nothing, a birdie three; the round is by points':'Match play: the hole is the unit; the card says when the match is decided'],['twist',()=>S.stroke===0&&!!S.twist,()=>'Saturday\'s twist: '+twistText(S.twist,S.seed)+'; the record carries it']];
function tipTick(){if(S.mode!=='aim'||S.ph>0||S.intro||S.guide||S.replay||S.lab||S.range||S.hs||S.tipDone===S.hi+'/'+S.stroke||!W)return;if(BC.low&&(BC.low.at==null||S.t<BC.low.at+(BC.low.ttl||LOWER_T)))return;if(S.t-S.shotEnd<TUNE.MARGIN_T+.3)return;
  S.tipDone=S.hi+'/'+S.stroke;if(chipOn()&&S.tipHole===S.hi)return;for(let i=0;i<TIPS.length&&i<TIP_MAX;i++){if(tipTold(i))continue;let on=false;try{on=!!TIPS[i][1]()}catch(e){}if(!on)continue;tipMark(i);if(TIPS[i][0]==='path')S.tipEv=null;if(chipOn()){S.tipHole=S.hi;chipHint(TIPS[i][2](),TUNE.TIP_T)}else lower4('Tip',TIPS[i][2](),'',TUNE.TIP_T);return}}
function settingsM4(el){const d=document.createElement('div');d.innerHTML='<div class="setrow"><span>HUD during setup (F-108)</span><div class="seg" data-k4="hudFull">'+['Essentials','Everything'].map((o,i)=>'<button data-v="'+i+'" class="'+(i===(SETS.hudFull?1:0)?'sel':'')+'">'+o+'</button>').join('')+'</div></div>'+
  '<div class="setrow"><span>Ambience</span><input type="range" id="setAmb" min="0" max="1" step="0.05" value="'+SETS.amb+'"></div><div class="setrow"><span>First-time tips (told '+TIPS.filter((t,i)=>tipTold(i)).length+' of '+TIPS.length+')</span><button class="sec" id="setTips">Reset tips</button></div>';
  el.appendChild(d);d.querySelectorAll('.seg[data-k4] button').forEach(bt=>bt.onclick=()=>{SETS.hudFull=+bt.dataset.v;setSave();AU.play('ui');settingsPanel()});const r=d.querySelector('#setAmb');if(r)r.oninput=()=>{SETS.amb=+r.value;setSave()};const t=d.querySelector('#setTips');if(t)t.onclick=()=>{SETS.tips=0;setSave();AU.play('ui');settingsPanel()}}
if(typeof addEventListener==='function'&&typeof document!=='undefined'){const inField=e=>e.target&&/INPUT|TEXTAREA/.test(e.target.tagName||'');
  addEventListener('keydown',e=>{if(!inField(e)&&e.key&&e.key.toLowerCase()===HUD_KEY)HUD4.hold=true});addEventListener('keyup',e=>{if(e.key&&e.key.toLowerCase()===HUD_KEY)HUD4.hold=false});addEventListener('blur',()=>{HUD4.hold=false});
  addEventListener('pointermove',e=>{HUD4.edge=e.clientY<HUD_TOP},{passive:true});
  if(typeof cv!=='undefined'&&cv&&cv.addEventListener)cv.addEventListener('contextmenu',e=>e.preventDefault());
  const pm=typeof $==='function'?$('pmapC'):null;if(pm){pm.style.pointerEvents='auto';pm.addEventListener('pointerdown',e=>{if(e.button===0&&targetMap4(e)){e.stopPropagation();e.preventDefault()}})}
  if(typeof document.documentElement!=='undefined'&&document.documentElement.style)document.documentElement.style.setProperty('--hudfade',TUNE.HUD_FADE+'ms')}
VL.feature({id:'m4.moments',kind:'view',deps:['m4.look','f114.tune'],f:['F-104','F-105','F-106','F-107','F-108','F-109','F-110']});
