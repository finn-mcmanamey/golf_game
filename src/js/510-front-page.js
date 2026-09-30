/* ===== v5 look · Q-21 The club, today (the front page's diorama) and Q-22 Clubhouse panels (tokens, icons, sheets). Drawing only: the plot is its own world, generated from the round's own inputs, drawn while the title shows and never read by a round or a record. ===== */
const DIO_R=30,DIO_BLEND=10,DIO_HOUSE={w:18,d:9,h:4.4},DIO_TROPHY=10,SIGN_BOARD={w:10.4,h:2.4,foot:1},SIGN_CAP=1.3,SIGN_VOX=.08,DIO_CAM={fov:55},DIO_DRIFT=[[3,83],[.8,61],[1.5,107]],DIO_CLOCK=[6.5,18.5],DIO_LIT=[7,18],DIO_TICK=60,DIO_SOFT=.55,DIO_FADE=450,DIO_GFX_MAX=2,TILT_BAND=.24,TILT_BLUR=[2.5,1.5],FRONT_FIRST=1000;
const TITLE_FONT="Georgia,'Palatino Linotype','Book Antiqua',Palatino,serif";
const DIO_L={c:[-13,-10],sign:[-11,-3],house:[-11,-20],green:[-27,-3,6],cam:[-7.5,13,20],look:[-11,-1.5,-8],trees:[[-26,-27],[5,-25],[-41,-12],[11,-10]],flag:[3,-16],bench:[-19,-9],washer:[3.6,-1.4]};
const HOUSE_PAL=[[[.88,.84,.74],[.48,.22,.18],[.95,.94,.9]],[[.92,.91,.87],[.30,.33,.37],[.14,.2,.16]],[[.74,.68,.58],[.36,.26,.18],[.9,.86,.76]],[[.86,.70,.52],[.72,.36,.22],[.95,.88,.72]],[[.93,.89,.78],[.16,.32,.22],[.96,.95,.91]],[[.55,.38,.24],[.22,.22,.24],[.9,.86,.78]],[[.95,.95,.93],[.18,.45,.5],[.14,.2,.32]]];
const TROPHY_COL={gold:[.93,.74,.27],silver:[.8,.82,.85],bronze:[.72,.46,.26],plinth:[.93,.9,.82],white:[.96,.96,.94],red:[.85,.16,.14],book:[.45,.12,.1],plaque:[.12,.3,.18]};
const DIO_SLOTS=[['major','cupG'],['cup','cupS'],['season','cupG'],['promo','plaque'],['ace','ball'],['eagle','cupS'],['birdie','cupB'],['ld','bar'],['ctp','pin'],['passport','book']];
const REAL=typeof window!=='undefined'&&typeof window.matchMedia==='function';
const DIO={W:null,key:'',seed:0,t0:0,tick:0,err:null,firstT:null,buildMs:0,clockAt:null,seedAt:0,boxes:0,letters:0};
function todaySeed(){if(!gentleOn()&&dailyOnIsl())return dailyIsl().seed;if(gentleOn()){const d=new Date(),n=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);return GENTLE_SEEDS[n%GENTLE_SEEDS.length]}return daily()}
function frontN(){const[n,k]=lastMode();return!k&&n===18?18:9}
function dioInputs(seed){const F=typeof frontIsl==='function'&&(FRONT.act||frontAct(loadSave()))?frontIsl():null;if(F&&(F.seed===seed||FRONT.act!=='today'))return dioInputsIsl(F);const n=frontN(),cv=newCv(),tw=twistFor(seed,cv);let setup=setupFor(seed);if(tw===3)setup=3;const cond={season:S.seasonPick>=0?S.seasonPick:courseSeason(seed),wear:seed===daily()?WEAR_LEVEL.daily:S.condPick|0,kind:0,twist:tw,v10:1};return{seed,n,cv,setup,cond,par:parsFor(n,cv,0)[0]}}
function dioClock(){const d=new Date(),h=DIO.clockAt!=null?DIO.clockAt:d.getHours()+d.getMinutes()/60;return{t:tryOn()?islHourAt(h):clamp(h,DIO_CLOCK[0],DIO_CLOCK[1]),lit:h<DIO_LIT[0]||h>=DIO_LIT[1]}}
const dioSeg=(x,z,ax,az,bx,bz)=>{const ex=bx-ax,ez=bz-az,l2=ex*ex+ez*ez||1,u=clamp(((x-ax)*ex+(z-az)*ez)/l2,0,1);return Math.hypot(x-ax-ex*u,z-az-ez*u)};
function dioFront(){return DIO_L.house[1]+DIO_HOUSE.d/2}
function dioPath(x,z){const[hx]=DIO_L.house,fw=dioFront(),h2=DIO_HOUSE.w/2;if(x>hx-h2-1&&x<hx+h2+1&&z>DIO_L.house[1]-DIO_HOUSE.d/2-.5&&z<fw+3.5)return true;return dioSeg(x,z,hx+4,fw+3,-2.2,-2.4)<1.1||dioSeg(x,z,hx-6,fw+3,DIO_L.green[0]+4,DIO_L.green[1]-3)<1.1}
function dioCarve(W){const{cols,rows,ox,oz,H,ty,pond}=W,s=cols+1,[cx,cz]=DIO_L.c,R2=DIO_R-DIO_BLEND,keep=(x,z)=>x*x+z*z<25;terrainAt(W,0,0);const y0=TQ.h-.12;W.dioY=y0;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const x=ox+i*CS,z=oz+j*CS,d=Math.hypot(x-cx,z-cz);if(d>=DIO_R||keep(x,z))continue;const k=j*s+i;H[k]=lerp(H[k],y0+.05*W.N.n2(x*.06+7,z*.06+3),1-sstep(R2,DIO_R,d))}
  const[gx,gz,gr]=DIO_L.green;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i,x=ox+i*CS+1,z=oz+j*CS+1;if(Math.hypot(x-cx,z-cz)>=R2+3||keep(x,z))continue;pond[c]=-1;let T=ty[c];if(T>=3&&T!==5)T=0;const dg=Math.hypot(x-gx,z-gz);if(dg<gr)T=4;else if(dg<gr+1.5)T=3;else if(dioPath(x,z))T=9;ty[c]=T}
  W.trees=W.trees.filter(t=>Math.hypot(t.x-cx,t.z-cz)>DIO_R-4);const R=mulberry32((W.seed^0x5d10)>>>0);for(const[tx,tz]of DIO_L.trees){terrainAt(W,tx,tz);W.trees.push(makeTree(tx,tz,TQ.h-.2,R))}
  W.tgrid=new Map();for(const t of W.trees){const key=(((t.x-ox)/8)|0)+','+(((t.z-oz)/8)|0);(W.tgrid.get(key)||W.tgrid.set(key,[]).get(key)).push(t)}
  let lo=1e9;for(let q=0;q<H.length;q+=7)if(H[q]<lo)lo=H[q];W.hlow=lo;
  const[hx,hz]=DIO_L.house,[sx,sz]=DIO_L.sign,b=SIGN_BOARD;W.dioShadow=[[hx-DIO_HOUSE.w/2,hx+DIO_HOUSE.w/2,hz-DIO_HOUSE.d/2,hz+DIO_HOUSE.d/2,0,DIO_HOUSE.h+2.4],[sx-b.w/2,sx+b.w/2,sz-.25,sz,b.foot,b.foot+b.h]]}
function dioStamp(W,sh){const{cols,rows,ox,oz}=W,SU=W.sun||SUN;if(SU[1]>0){const mx=SHADE.reach,ux=clamp(-SU[0]/SU[1],-mx,mx),uz=clamp(-SU[2]/SU[1],-mx,mx),k=SHADE.k;
    const span=(p,a,b,u)=>Math.abs(u)<1e-6?(p>=a&&p<=b?[-1e9,1e9]:null):u>0?[(p-b)/u,(p-a)/u]:[(p-a)/u,(p-b)/u];
    for(const[x0,x1,z0,z1,h0,h1]of W.dioShadow||[]){const i0=Math.max(0,((Math.min(x0,x0+ux*h1)-ox)/CS|0)-1),i1=Math.min(cols-1,((Math.max(x1,x1+ux*h1)-ox)/CS|0)+1),j0=Math.max(0,((Math.min(z0,z0+uz*h1)-oz)/CS|0)-1),j1=Math.min(rows-1,((Math.max(z1,z1+uz*h1)-oz)/CS|0)+1);
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=ox+i*CS+1,z=oz+j*CS+1,a=span(x,x0,x1,ux),c=span(z,z0,z1,uz);if(!a||!c)continue;if(Math.max(a[0],c[0],h0)<=Math.min(a[1],c[1],h1)){const q=j*cols+i;sh[q]=Math.min(sh[q],1-k)}}}}
  for(let q=0;q<sh.length;q++)sh[q]=1-(1-sh[q])*DIO_SOFT;
  if(W.lit){const[hx]=DIO_L.house,fw=dioFront();for(const dx of[-5,5])for(let z=fw;z<fw+4;z+=CS)for(let x=hx+dx-2;x<=hx+dx+2;x+=CS){const i=((x-ox)/CS)|0,j=((z-oz)/CS)|0;if(i>=0&&j>=0&&i<cols&&j<rows)sh[j*cols+i]=1.3-(z-fw)*.05}}}
function dioClear(W,bx,n0){const[cx,cz]=DIO_L.c;let w=n0;for(let i=n0;i<bx.length;i++){const b=bx[i];if(Math.hypot(b[0]-cx,b[2]-cz)<DIO_R-2&&b[0]*b[0]+b[2]*b[2]>25)continue;bx[w++]=b}bx.length=w}
function tkRGB(n){const v=TK(n);const m=/(\d+)\D+(\d+)\D+(\d+)/.exec(v);return m?[m[1]/255,m[2]/255,m[3]/255]:[.5,.5,.5]}
function signLetters(cx,cy,z,wMax,col,out){const cv=typeof document!=='undefined'&&document.createElement?document.createElement('canvas'):null,g=cv&&cv.getContext?cv.getContext('2d',{willReadFrequently:true}):null;if(!g||typeof g.measureText!=='function'||typeof g.getImageData!=='function')return 0;
  const V=SIGN_VOX,txt='Voxel Links',font=px=>'bold '+px+'px '+TITLE_FONT;let px=Math.round(SIGN_CAP/V/.7);g.font=font(px);let w=g.measureText(txt).width;const maxW=Math.floor(wMax/V);if(!(w>0))return 0;if(w>maxW){px=Math.floor(px*maxW/w);g.font=font(px);w=g.measureText(txt).width}
  const Wd=Math.ceil(w)+4,Hd=Math.ceil(px*1.4)+4;cv.width=Wd;cv.height=Hd;g.font=font(px);g.textBaseline='alphabetic';g.fillStyle=TK('white');g.fillText(txt,2,Math.round(px*1.05)+2);const im=g.getImageData(0,0,Wd,Hd).data,on=(x,y)=>im[(y*Wd+x)*4+3]>=110;
  let x0=Wd,x1=-1,y0=Hd,y1=-1;for(let y=0;y<Hd;y++)for(let x=0;x<Wd;x++)if(on(x,y)){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}if(x1<0)return 0;
  const mx=(x0+x1+1)/2,my=(y0+y1+1)/2;let prev=new Map(),n=0;
  for(let y=y0;y<=y1;y++){const cur=new Map();let x=x0;while(x<=x1){if(!on(x,y)){x++;continue}let e=x;while(e<=x1&&on(e,y))e++;const k=x+','+e,p=prev.get(k);if(p){p[1]-=V/2;p[4]+=V/2;cur.set(k,p)}else{const b=[cx+((x+e)/2-mx)*V,cy-((y+.5)-my)*V,z+.035,(e-x)*V/2,V/2,.035,col];out.push(b);cur.set(k,b);n++}x=e}prev=cur}
  DIO.capM=(y1-y0+1)*V;return n}
function trophy(kind,x,y,z,col,out){const T=TROPHY_COL,s=1.6,B=(dx,dy,dz,hx,hy,hz,c)=>out.push([x+dx*s,y+dy*s,z+dz*s,hx*s,hy*s,hz*s,c]);B(0,.07,0,.17,.07,.14,T.plinth);if(!col)return;const c=T[col]||T.gold;
  if(kind==='cupG'||kind==='cupS'||kind==='cupB'){const k=kind==='cupB'?.75:1,g=kind==='cupG'?T.gold:kind==='cupS'?T.silver:T.bronze;B(0,.17,0,.1*k,.03,.08*k,g);B(0,.17+.1*k,0,.03,.08*k,.03,g);B(0,.2+.24*k,0,.13*k,.12*k,.11*k,g);for(const sx of[-1,1])B(sx*.17*k,.2+.25*k,0,.035,.06*k,.03,g)}
  else if(kind==='ball'){B(0,.17,0,.1,.03,.08,T.gold);B(0,.24,0,.015,.05,.015,T.white);B(0,.34,0,.06,.06,.06,T.white)}
  else if(kind==='bar'){B(0,.2,0,.03,.06,.03,T.gold);B(0,.3,0,.22,.035,.035,T.gold)}
  else if(kind==='pin'){B(0,.36,0,.012,.22,.012,T.white);B(.08,.5,0,.07,.045,.01,T.red)}
  else if(kind==='plaque'){B(0,.32,-.02,.13,.17,.02,T.plaque);B(0,.32,0,.085,.11,.022,T.gold)}
  else if(kind==='book'){B(0,.2,0,.14,.06,.1,T.book);B(0,.2,.1,.12,.045,.006,T.gold)}}
function dioEarned(){const f=typeof featsGet==='function'?featsGet():[];let pp=0;try{pp=typeof ppGet==='function'?Object.keys(ppGet()||{}).length:0}catch(e){}return id=>id==='passport'?pp>0:f.includes(id)}
function dioBoxes(W){const bx=[],lt=[],L=DIO_L,y0=W.dioY,P=HOUSE_PAL[W.bio|0]||HOUSE_PAL[0],wall=P[0],roof=W.season===3&&W.bio===5?[.93,.94,.96]:P[1],trim=P[2],dark=trim.map(v=>v*.55),wood=[.42,.29,.17],B=(x,y,z,hx,hy,hz,c)=>bx.push([x,y,z,hx,hy,hz,c]);
  const[hx,hz]=L.house,w2=DIO_HOUSE.w/2,d2=DIO_HOUSE.d/2,fw=dioFront(),yF=y0+.3,yR=yF+DIO_HOUSE.h;
  B(hx,y0+.15,hz,w2+.3,.3,d2+.3,dark);B(hx,yF+DIO_HOUSE.h/2,hz,w2,DIO_HOUSE.h/2,d2,wall);
  [[.25,w2+.5,d2+.5],[.75,w2+.3,d2-.6],[1.25,w2+.1,d2-1.7],[1.75,w2-.1,d2-2.8]].forEach(([dy,a,b])=>B(hx,yR+dy,hz,a,.25,b,roof));B(hx,yR+2.15,hz,w2-.1,.15,.55,roof.map(v=>v*.8));B(hx+5.5,yR+2.3,hz-1.4,.45,1.15,.45,[.55,.3,.22]);
  B(hx,yF+1.2,fw+.04,.75,1.2,.06,[.28,.18,.12]);B(hx,yF+2.55,fw+.07,1.0,.12,.09,trim);B(hx,yF+2.95,fw+.75,1.5,.1,.8,roof);
  const lit=!!W.lit,glass=lit?[1,.9,.56]:[.13,.17,.21],earned=dioEarned();
  [-5,5].forEach((dx,wi)=>{const wx=hx+dx;B(wx,yF+1.75,fw+.03,2.1,.85,.05,glass);B(wx,yF+2.67,fw+.08,2.25,.1,.1,trim);B(wx,yF+.86,fw+.22,2.3,.08,.28,trim);for(const sx of[-1,1])B(wx+sx*2.18,yF+1.75,fw+.08,.1,.9,.1,trim);
    for(let i=0;i<5;i++){const[id,kind]=DIO_SLOTS[wi*5+i];trophy(kind,wx+(i-2)*.82,yF+.94,fw+.26,earned(id)?'gold':null,bx)}});
  const[sx,sz]=L.sign,S2=SIGN_BOARD,yB=y0+S2.foot,yT=yB+S2.h,board=tkRGB('g900'),frame=tkRGB('gold500'),ink=tkRGB('c50');
  for(const px of[-1,1])B(sx+px*(S2.w/2-.9),y0+(S2.foot+S2.h)/2,sz-.3,.13,(S2.foot+S2.h)/2,.13,wood);
  B(sx,(yB+yT)/2,sz-.12,S2.w/2,S2.h/2,.1,board);B(sx,yT+.07,sz-.06,S2.w/2+.14,.14,.15,frame);B(sx,yB-.07,sz-.06,S2.w/2+.14,.14,.15,frame);for(const px of[-1,1])B(sx+px*(S2.w/2+.07),(yB+yT)/2,sz-.06,.14,S2.h/2,.15,frame);
  DIO.letters=signLetters(sx,(yB+yT)/2,sz-.02,S2.w-.6,ink,lt);
  const[fx,fz]=L.flag;terrainAt(W,fx,fz);const yf=TQ.h;B(fx,yf+4.2,fz,.08,4.2,.08,TROPHY_COL.white);B(fx,yf+8.47,fz,.12,.08,.12,frame);B(fx+.95,yf+7.75,fz,.9,.5,.04,board);B(fx+.95,yf+7.75,fz+.045,.9,.1,.006,frame);
  const[bx0,bz0]=L.bench;B(bx0,y0+.45,bz0,.9,.06,.25,wood);B(bx0,y0+.8,bz0-.22,.9,.25,.04,wood);for(const q of[-1,1])B(bx0+q*.75,y0+.22,bz0,.06,.22,.22,dark);
  const[gx,gz]=L.green;[[-2,1.5,TROPHY_COL.red],[2.5,-1,[.95,.8,.2]],[.5,-3.5,[.25,.45,.85]]].forEach(([dx,dz,c])=>{terrainAt(W,gx+dx,gz+dz);const y=TQ.h;B(gx+dx,y+.65,gz+dz,.02,.65,.02,TROPHY_COL.white);B(gx+dx+.18,y+1.15,gz+dz,.18,.11,.01,c);B(gx+dx+.6,y+.05,gz+dz+.4,.05,.05,.05,TROPHY_COL.white)});
  const[wx0,wz0]=L.washer;terrainAt(W,wx0,wz0);B(wx0,TQ.h+.5,wz0,.05,.5,.05,dark);B(wx0,TQ.h+1.05,wz0,.16,.12,.1,[.2,.35,.6]);
  DIO.boxes=bx.length+lt.length;return{s:bx,l:lt}}
function withDW(Wd,f){const W1=W;W=Wd;try{return f()}finally{W=W1}}
function dioBuild(force){if(!force&&!REAL)return false;try{const seed0=DIO.seedAt||todaySeed(),I=dioInputs(seed0),seed=I.seed,key=holeKey(seed,0,I.cv,I.setup,I.cond)+'/'+I.par,ck=dioClock();if(DIO.W&&DIO.key===key&&!force)return true;const t0=performance.now();
    if(S.frontSeed===seed&&!loadSave())prebuild(null);const W0=PRE.W&&PRE.key===key?PRE.W:genHole(seed,0,I.par,I.cv,I.setup,I.cond);
    const Wd=Object.assign({},W0,{H:W0.H.slice(),ty:W0.ty.slice(),pond:W0.pond.slice(),trees:W0.trees.slice(),marks:[],meshes:null,base:null,shade:null,dio:true,key:'dio:'+key});
    applyClock(Wd,ck.t);Wd.lit=ck.lit;withDW(Wd,()=>{dioCarve(Wd);const sh=bakeShade(Wd);dioStamp(Wd,sh);Wd.shade=sh;buildMeshes(Wd)});
    if(DIO.W&&DIO.W.meshes)freeMeshes(DIO.W);DIO.W=Wd;DIO.key=key;DIO.seed=seed;DIO.buildMs=performance.now()-t0;DIO.tick=performance.now();DIO.err=null;if(!force&&REAL&&frontShown())drawFrame();return true}catch(e){DIO.err=String(e&&e.message||e);glOn();return false}}
function dioTick(now){if(now-DIO.tick<DIO_TICK*1000)return;DIO.tick=now;if(dioSeedNow()!==DIO.seed){dioBuild();return}const ck=dioClock(),Wd=DIO.W;if(Math.abs(ck.t-(Wd.clock||0))>.01)applyClock(Wd,ck.t);if(ck.lit!==Wd.lit){DIO.clockT=ck.t;dioBuild(true)}}
function dioCam(){const L=DIO_L,y0=DIO.W.dioY,t=rmOn()?0:(performance.now()-DIO.t0)/1000,asp=VP.w&&VP.h?VP.w/VP.h:16/9,k=Math.max(1,(16/9)/asp),D=DIO_DRIFT,sw=i=>D[i][0]*MM.sin(TAU*t/D[i][1]);
  const T=[L.look[0],y0+L.look[1],L.look[2]],C=[L.cam[0],y0+L.cam[1],L.cam[2]],Sg=[L.sign[0],y0+SIGN_BOARD.foot+SIGN_BOARD.h/2,L.sign[1]];cam.x=Sg[0]+(C[0]-Sg[0])*k+sw(0);cam.y=Sg[1]+(C[1]-Sg[1])*k+sw(1);cam.z=Sg[2]+(C[2]-Sg[2])*k+sw(2);cam.tx=T[0]+sw(0)*.35;cam.ty=T[1];cam.tz=T[2];cam.fov=DIO_CAM.fov*DEG}
function glOn(){if(REAL)document.body.classList.add('gl-on')}
function frontShown(){const t=$('title');return!!t&&!t.classList.contains('hide')}
function dioRender(){const now=performance.now();dioTick(now);const g0=[GFX.level,GFX.shadows,GFX.post,GFX.bloom,GFX.refl],c0=[cam.fov,cam.fogK],sy=HUDL.sy;
  dioCam();GFX.level=Math.min(GFX.level,DIO_GFX_MAX);GFX.refl=false;HUDL.sy=0;W=DIO.W;/* the front page gets the player's own shadows and grade (up to High) so it looks like the game, not a flat preview */
  try{render(S.t)}finally{W=null;[GFX.level,GFX.shadows,GFX.post,GFX.bloom,GFX.refl]=g0;[cam.fov,cam.fogK]=c0;HUDL.sy=sy}
  if(DIO.firstT==null){DIO.firstT=now;DIO.firstDone=performance.now();glOn()}}
function drawFrame(){islClueTick();chipTick();if(ISLV.on&&ISLV.W)islRender();else if(!W&&DIO.W&&S.mode==='title'&&frontShown())dioRender();else render(S.t)}
const TILT={m:-1};function tiltTick(){const m=S.mode==='title'&&frontShown()?2:S.intro||ISLV.on?1:0;if(m===TILT.m||!REAL)return;TILT.m=m;const b=document.body;b.classList.toggle('tilt',m>0);b.classList.toggle('tilt-fly',m===1)}
const SHEETS=[['tour','Tour','tour',['pCareer','pTour','pStats','pLocker']],['daily','Daily','daily',['pDaily']],['courses','Courses','flag',['pPlay','pPlaces','pBook','pRange']],['ghosts','Ghosts','ghost',['pGhosts','pFriends']],['island','Island','island',['pIsland']],['settings','Settings','gear',['pSettings']]];
const TAB_N={pIsland:'Your island',pCareer:'Career',pTour:'Classic tour',pStats:'Stats',pLocker:'Locker',pDaily:'Calendar',pPlay:'Play a course',pPlaces:'Places',pBook:'Records',pRange:'Range',pGhosts:'Ghosts',pFriends:'Friends',pSettings:'Settings'};
const FRONT={act:'today',sheet:null,wired:false};
const ic=(n,c)=>'<svg class="ic'+(c?' '+c:'')+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
function sheetOf(id){return SHEETS.find(s=>s[3].includes(id))||SHEETS[2]}
function sheetOpen(id){const wrap=$('sheetWrap');if(!wrap||!REAL)return;const sh=sheetOf(id),list=sh[3].filter(p=>p!=='pTour'||S.tour),tabs=$('shTabs');$('shTitle').textContent=sh[1];tabs.innerHTML='';
  if(list.length>1)for(const p of list){const b=document.createElement('button');b.textContent=TAB_N[p];if(p===id)b.className='sel';b.onclick=()=>{AU.play('ui');chTab(p)};tabs.appendChild(b)}
  tabs.classList.toggle('hide',list.length<2);const was=FRONT.sheet;FRONT.sheet=sh[0];wrap.classList.remove('hide');document.body.classList.add('sheet-on');for(const b of document.querySelectorAll('#frontRow button'))b.classList.toggle('sel',b.dataset.sheet===sh[0]);if(!was){const x=$('shClose');if(x)x.focus({preventScroll:true})}}
function sheetClose(){const wrap=$('sheetWrap');if(!wrap||!FRONT.sheet)return;FRONT.sheet=null;wrap.classList.add('hide');document.body.classList.remove('sheet-on');for(const b of document.querySelectorAll('#frontRow button'))b.classList.remove('sel');const m=$('btnMain');if(m&&frontShown())m.focus({preventScroll:true})}
function frontWire(){if(FRONT.wired||!REAL||!$('btnMain'))return;FRONT.wired=true;$('btnMain').onclick=mainGo;$('btnGear').onclick=()=>{AU.play('ui');chTab('pSettings')};$('shClose').onclick=()=>{AU.play('ui');sheetClose()};
  for(const b of document.querySelectorAll('#frontRow button'))b.onclick=()=>{AU.play('ui');if(FRONT.sheet===b.dataset.sheet){sheetClose();return}const sh=SHEETS.find(s=>s[0]===b.dataset.sheet),cur=S.chTab&&sh[3].includes(S.chTab)?S.chTab:sh[3][0];chTab(cur)};
  $('sheetWrap').addEventListener('pointerdown',e=>{if(e.target===$('sheetWrap'))sheetClose()});
  addEventListener('keydown',e=>{if(e.key!=='Escape'||!FRONT.sheet||!frontShown())return;if(document.querySelector('.ov:not(.hide):not(#title)'))return;sheetClose();e.stopImmediatePropagation();e.preventDefault()},true)}
function frontAct(sv){if(sv)return'resume';const C=S.car;if(t8Is(C)){const N=t8Next(C);if(N&&!N.out&&!N.fin)return'career'}else if(C&&C.cur&&C.cur.ev<EVENTS&&!C.cur.done){const M=C.cur.major,maj=isMajor(C.tier,C.cur.ev);if(!(maj&&M&&M.r1!=null&&!M.made))return'career'}const T=S.tour;if(T&&T.ev<TOUR.events)return'tour';return'today'}
function frontRefresh(sv){const a=FRONT.act=frontAct(sv);S.frontSeed=a==='today'?todaySeed():null;if(!REAL||!$('btnMain'))return;frontWire();let sub='';
  if(a==='resume')sub=$('resumeText').textContent;else if(a==='career'){const C=S.car;sub=t8Is(C)?(()=>{const N=t8Next(C),c=t8Cond(C,C.tier,N.e,N.r);return(N.e>=6?'Q-school':F8_N[N.e])+' · season '+C.season+' · '+islName(c.seed)})():(isMajor(C.tier,C.cur.ev)?'The major · '+TIER_NAMES[C.tier]+' tour':'Career · season '+C.season+' · event '+(C.cur.ev+1)+' of '+EVENTS)+(carIsl(C)?' · '+islName(C.cur.tiers[C.tier].seeds[C.cur.ev]):'')}
  else if(a==='tour')sub='Classic tour · event '+(S.tour.ev+1)+' of '+TOUR.events+(S.tour.isl?' · '+islName(S.tour.seeds[S.tour.ev]):'');else{const seed=S.frontSeed,I=dioInputs(seed);sub=!gentleOn()&&dailyOnIsl()?todayLine():(gentleOn()?'A gentle course to start':seed===daily()?'Today’s course':'Course #'+seed)+' · '+BIOMES[biomeOf(seed,I.cv)].n+' · '+SEASONS[I.cond.season].n+' · '+I.n+' holes'}
  $('mainT').textContent=a==='today'?'Play today’s':'Continue';$('mainIc').innerHTML=ic(a==='today'?'play':'next');$('mainSub').textContent=sub;$('btnMain').classList.remove('busy');if(frontShown()&&!FRONT.sheet&&document.activeElement===document.body)$('btnMain').focus({preventScroll:true});
  {const r=$('btnIslRow');if(r)r.classList.toggle('hide',!tryOn())}if(frontShown()&&(!DIO.W||DIO.seed!==todaySeed()))later(()=>dioBuild())}
const later=f=>{if(REAL&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(f,0));else f()};
function mainGo(){const b=$('btnMain');if(!b||b.classList.contains('busy'))return;AU.play('ui');b.classList.add('busy');$('mainT').textContent='Teeing off…';
  later(()=>{const a=FRONT.act;try{if(a==='resume')continueRound();else if(a==='career')careerEvent();else if(a==='tour')tourEvent();else goToday()}finally{if(frontShown())frontRefresh(loadSave())}})}

function TK(n,a){const C=TK.c||(TK.c=new Map()),k=n+'|'+(a==null?1:a);let v=C.get(k);if(v)return v;if(!TK.g){try{const cs=getComputedStyle(document.documentElement);TK.g=q=>cs.getPropertyValue('--'+q).trim()}catch(e){TK.g=()=>''}}
  const m=/^#([0-9a-f]{6})$/i.exec(TK.g(n)),rgb=m?[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4),16)]:[128,128,128];v=a==null||a>=1?'rgb('+rgb+')':'rgba('+rgb+','+a+')';C.set(k,v);return v}
