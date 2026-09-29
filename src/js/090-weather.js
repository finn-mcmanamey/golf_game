/* ---- time of day and weather (E-2): presentation only ---- */
function holeClock(i,n){const span=n===18?[8,17]:n===3?[16,17.5]:[8,12.5];return n>1?span[0]+(span[1]-span[0])*i/(n-1):span[0]}
function sunAt(t,wea,sunMax){const az=(-90+(t-6)/12*180)*DEG,el=Math.min(sunMax||90,Math.max(12,62*MM.sin(Math.PI*(t-6)/12)))*DEG,elv=wea&&wea.flat?45*DEG:el;
  const v=[MM.sin(az)*MM.cos(elv),MM.sin(elv),MM.cos(az)*MM.cos(elv)],k=clamp((el/DEG-15)/25,0,1),warm=[1,.85,.65],neu=[1,1,1],col=wea&&wea.flat?[.8,.82,.85]:[lerp(warm[0],neu[0],k),lerp(warm[1],neu[1],k),lerp(warm[2],neu[2],k)];
  return{v,el,az,col,t}}
function applyDay(W,i,n){if(W.cv<2){W.sun=SUN;W.light=[1,1,1];W.fogMul=1;W.clock=null;return}applyClock(W,islClockOn(W)?islHourNow():holeClock(i,n))}
function applyClock(W,t){if(!W.base)W.base={fog:W.fog,sky:W.sky};W.fog=W.base.fog;W.sky=W.base.sky;const P=coursePlan(W.seed,W.cv),H=W.cv>=4?holeFrame(W):courseHole(W.seed,W.cv,W.idx),su=sunAt(t,P.wea,W.cv>=4?SEASONS[W.season].sun:0),c=MM.cos(H.h),sn=MM.sin(H.h);
  W.sun=norm([su.v[0]*c-su.v[2]*sn,su.v[1],su.v[0]*sn+su.v[2]*c]);W.light=su.col;W.fogMul=P.wea.fog;W.clock=t;W.wea=P.wea;W.heading=H.h;
  if(P.wea.rain){W.fog=[.68,.71,.76];W.sky=[.44,.48,.55];W.light=su.col.map(v=>v*P.wea.light)}else if(P.wea.flat){W.fog=W.fog?W.fog.map(v=>v*.92):[.78,.8,.84];W.sky=[.55,.58,.64]}else if(su.el<20*DEG){W.sky=[.42,.5,.78];W.fog=[.92,.84,.72]}}
