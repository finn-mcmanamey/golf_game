/* ================= physics ================= */
let W=null,EXACT=false;
const newBall=()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,sp:0,ax:0,ay:0,az:0,st:'rest',t:0,acc:0,lip:false,cup:false,rim:0,rimS:0,tree:null,apex:0,dx:0,dz:0,sx:0,sz:0,trail:[],ev:[],rng:Math.random,rot:M4.I(),k0:0,n:0,plug:false,ballType:0,lf:0});
const PB=newBall(),GB=newBall();let B=PB;
const shotSeed=(seed,hole,stroke,attempt=0)=>(Math.imul(seed|0,7919)+Math.imul(hole+1,104729)+Math.imul(stroke,31)+Math.imul(attempt,0x9E3779B9|0)+17)|0;
const SHAPE=[{n:'Straight',s:'—',k:0},{n:'Fade',s:'Fade ◝',k:-1},{n:'Draw',s:'◜ Draw',k:1},{n:'Big fade',s:'◝◝',k:-2},{n:'Big draw',s:'◜◜',k:2}],SHAPE_ORDER=[4,2,0,1,3],TRAJ=[{n:'Low',s:'Low',ang:.8,spin:.9,v:.99},{n:'Normal',s:'Normal',ang:1,spin:1,v:1},{n:'High',s:'High',ang:1.22,spin:1.1,v:.97},{n:'Punch',s:'Punch',ang:PUNCH_ANG,spin:PUNCH_SPIN,v:PUNCH_V},{n:'Stinger',s:'Stinger',ang:STING_ANG,spin:STING_SPIN,v:STING_V}],TRAJ_ORDER=[3,4,0,1,2];
function place(x,z){terrainAt(W,x,z);B.x=x;B.z=z;B.y=TQ.h+BALL_R;B.vx=B.vy=B.vz=0;B.sp=0;B.st='rest';B.acc=0;B.trail.length=0;B.plug=false;B.lf=0;B.cup=false;B.rim=0;B.creep=0}
const windAt=k=>W&&W.swell?1+W.swell*MM.sin(TAU*(k*DT)/WIND.period+W.phase):1;
function thickAt(x,z){if(!W||W.cv<3)return false;terrainAt(W,x,z);const ty=TQ.ty;if(ty>1)return false;const h=thash(W.seed*7+W.idx,Math.floor(x*2)+40000,Math.floor(z*2)+40000)/4294967296;return h<LIES.sitDown[ty]}
function lieState(){if(!W||W.cv<3)return{sit:false,plug:false};if(W.cv<4)return{sit:!B.plug&&thickAt(B.x,B.z),plug:!!B.plug};
  /* version 4: a drop clears the F-046 states (lf 1), a winter placement clears wear too (lf 2) */const w=B.lf===2?0:wearAt(B.x,B.z);return{sit:!B.plug&&!B.lf&&thickAt(B.x,B.z),plug:!!B.plug,divot:w===1,worn:w===2,placed:B.lf===2,dropped:B.lf===1}}
/* F-055 seeded wear: 0 clean, 1 divot (0.5 m cells on fairway and tee), 2 worn (2 m cells); from the seed, the hole and the wear level only */
function wearKind(c,ty,x,z){const L=W.wear;if(!L||W.cv<4)return 0;const t=W.tC[c],len=W.len,par=W.par;
  if(ty===2||ty===5){const zw=ty===2&&par>3&&t>=DIVOT_ZONE[0]&&t<=DIVOT_ZONE[1]?WEAR_W.drive:ty===2&&par===5&&t>=len-130&&t<=len-70?WEAR_W.layup:ty===5&&par===3?WEAR_W.tee3:0;
    if(zw&&(thash(W.seed*131+W.idx*7+L,Math.floor(x*2)+40000,Math.floor(z*2)+40000)>>>0)/4294967296<L*DIVOT_P*zw)return 1}
  if(ty===0||ty===2||ty===3){const d=W.dC[c],zw=t>=len-55&&t<=len-20&&d<=8?WEAR_W.approach:par>3&&t>=DIVOT_ZONE[0]&&t<=DIVOT_ZONE[1]&&Math.abs(d-W.hw(t))<=4?WEAR_W.edge:0;
    if(zw&&(thash(W.seed*137+W.idx*11+L,c,77)>>>0)/4294967296<L*WORN_P*zw)return 2}
  return 0}
function wearAt(x,z){if(!W||W.cv<4||!W.wear)return 0;terrainAt(W,x,z);return wearKind(TQ.cell,TQ.ty,x,z)}
const STANCE={tilt:1.5,loft:2,speed:.4,cap:.2};
function stanceAt(x,z,yaw){terrainAt(W,x,z);if(!W.cv||W.cv<2)return{along:0,side:0};const nx=TQ.nx,ny=TQ.ny||1,nz=TQ.nz,dx=MM.sin(yaw),dz=MM.cos(yaw);
  return{along:clamp(MM.atan(-(nx*dx+nz*dz)/ny),-STANCE.cap,STANCE.cap),side:clamp(MM.atan(-(nx*dz-nz*dx)/ny),-STANCE.cap,STANCE.cap)}}
function strike(c,pow,acc,yaw,shape=0,traj=1,mis=0){MM=W.M||NM;if(B===PB&&!EXACT){contactFX(c,pow,acc,mis);impactFX(c,yaw,mis)}const G8=B.G||G_TEST;B.G=null;const gm=G8?golfMods(G8,c):null;if(gm){acc*=gm.acc;if(mis>0)mis=Math.min(MIS_CAP,mis*gm.fat);else if(mis<0)mis=Math.max(-MIS_CAP,mis*gm.thin)}B.windK=gm?gm.wind:1;
  const st=c.putter?{along:0,side:0}:stanceAt(B.x,B.z,yaw);terrainAt(W,B.x,B.z);const hs=B.hand?-1:1,ty=TQ.ty,L=LIE[ty],dir=yaw+hs*acc*(c.putter?.012:.045),dx=MM.sin(dir),dz=MM.cos(dir),T=TRAJ[traj],sh=SHAPE[shape].k;
  B.sx=B.x;B.sz=B.z;B.dx=B.x;B.dz=B.z;B.t=0;B.acc=0;B.lip=false;B.cup=false;B.rim=0;B.creep=0;B.tree=null;B.apex=B.y;B.trail.length=0;B.ev.length=0;
  if(c.putter){const v=c.v*pow*PUTT[ty]*(gm?gm.v:1);B.vx=dx*v;B.vz=dz*v;B.vy=0;B.sp=0;B.st='roll';return}
  let df=L[0],sf=L[1],angK=1,vK=1,spK=1;if(ty===6&&(c.s==='SW'||c.s==='LW')){df=.95;sf=.9}
  if(W.cv>=3){const bl=BALLS[B.ballType|0];vK*=(W.cv>=9||W.v10)&&c.v9?bl.v/BALLS[0].v:bl.v;spK*=(W.cv>=9||W.v10)&&c.v9?bl.spin/BALLS[0].spin:bl.spin;if(W.rain)spK*=RAIN.spin;
    if(c.sg){const q=SG_LIE[c.sgi][ty];df=q[0];sf=q[1];if(c.sgi===2&&TIGHT[ty]){angK*=SG.thin.ang;vK*=SG.thin.v;spK*=SG.thin.spin}}
    const ls=lieState();if(ls.sit){df*=LIES.sitDf;sf*=LIES.sitSf}if(ls.plug){df*=c.sg&&c.sgi===3?LIES.plugDf:LIES.plugDf2;sf*=LIES.plugSf}
    if(W.cv>=4){if(ls.divot){vK*=.92;angK*=.9;spK*=.9}if(ls.worn){spK*=.9;if(c.sg&&c.sgi===2&&!TIGHT[ty]){angK*=SG.thin.ang;vK*=SG.thin.v;spK*=SG.thin.spin}}
      /* F-050: contact from the click, never from chance */if(mis>0){vK*=1-FAT_V*mis;angK*=1+FAT_ANG*mis;spK*=1+FAT_SPIN*mis}else if(mis<0){angK*=1+THIN_ANG*mis;vK*=1+THIN_V*mis;spK*=1+THIN_SPIN*mis}}}
  if(gm)spK*=gm.sp;B.n=0;B.nb=0;if(B.k0==null)B.k0=0;
  const L9=(W.cv>=9||W.v10)&&c.v9?1:0,vm=L9?df*T.v*(sh?.96:1)*(1-STANCE.speed*Math.abs(st.along))*(EXACT?1:1+(B.rng()-.5)*.025)*vK:0,v=L9?c.v9*pow*MM.pow(vm,LIE9):c.v*pow*df*T.v*(sh?.96:1)*(1-STANCE.speed*Math.abs(st.along))*(EXACT?1:1+(B.rng()-.5)*.025)*vK,ang=(L9?c.ang9*(1+PART_LOFT9*(1-pow)*part9(pow)):c.ang)*T.ang*(1+.12*(1-df))*(1+STANCE.loft*st.along)*angK,vg=v*(gm?gm.v:1),vh=vg*MM.cos(ang);
  B.vx=dx*vh;B.vz=dz*vh;B.vy=vg*MM.sin(ang);B.sp=c.spin*sf*T.spin*(.4+.6*pow+(L9?.3*(1-pow)*part9(pow):0))*spK;B.w9=L9?c.w9*sf*T.spin*(.4+.6*pow+.3*(1-pow)*part9(pow))*spK:null;B.sp9=B.sp;
  const tilt=hs*(acc*.55+sh*.45+STANCE.tilt*st.side)*c.side,ct=MM.cos(tilt),sn=MM.sin(tilt);B.ax=-dz*ct;B.ay=sn;B.az=dx*ct;B.sy=B.y;B.pathDrop=false;B.st='air'}
function nearTrees(x,z,fn){const gx=((x-W.ox)/8)|0,gz=((z-W.oz)/8)|0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const l=W.tgrid.get((gx+i)+','+(gz+j));if(l)for(const t of l)fn(t)}}
function stepAir(dt){
  const w=W.wind,wk=W.swell?windAt(B.k0+SWING_TICKS+B.n):1,wh=wk*windH(B.y-(B.sy!=null?B.sy:B.y))*(B.windK||1),rx=B.vx-w.x*wh,ry=B.vy,rz=B.vz-w.z*wh,rs=MM.hyp(rx,ry,rz),d=(B.w9!=null?aero9(rs,dt):KD*rs*(1+.35*B.sp))*(W.rain?RAIN.drag:1)*(W.air||1),l=(B.w9!=null?F9.l:KL*B.sp*rs)*(W.air||1);
  B.vx+=(-d*rx+l*(B.ay*rz-B.az*ry))*dt;B.vy+=(-G-d*ry+l*(B.az*rx-B.ax*rz))*dt;B.vz+=(-d*rz+l*(B.ax*ry-B.ay*rx))*dt;
  B.x+=B.vx*dt;B.y+=B.vy*dt;B.z+=B.vz*dt;B.sp*=1-.04*dt;if(B.w9!=null)B.sp9=B.sp;if(B.y>B.apex)B.apex=B.y;
  nearTrees(B.x,B.z,t=>{
    if(W.cv>=6&&B.tree&&t!==B.tree)return;if(t===B.tree){let inside=false;for(const c of t.cs)if(MM.hyp(B.x-c.x,B.y-c.y,B.z-c.z)<c.r+.3)inside=true;if(!inside)B.tree=null;return}
    for(const c of t.cs){const ex=B.x-c.x,ey=B.y-c.y,ez=B.z-c.z,dd=MM.hyp(ex,ey,ez);if(dd<c.r){B.tree=t;if(B.rng()<canopyPass(t))return;const k=.3+B.rng()*.2,nx=ex/dd,ny=ey/dd,nz=ez/dd,vn=B.vx*nx+B.vy*ny+B.vz*nz;
      if(vn<0){B.vx-=1.2*vn*nx;B.vy-=1.2*vn*ny;B.vz-=1.2*vn*nz}const a=B.rng()*TAU,r=MM.hyp(B.vx,B.vz)*.25;B.vx=B.vx*k+MM.sin(a)*r;B.vy*=k;B.vz=B.vz*k+MM.cos(a)*r;B.sp=0;B.ev.push('tree');return}}
    const ex=B.x-t.x,ez=B.z-t.z,dd=MM.hyp(ex,ez);if(dd<t.tr+BALL_R&&B.y<t.y+t.th&&dd>0){const nx=ex/dd,nz=ez/dd,vn=B.vx*nx+B.vz*nz;if(vn<0){B.vx-=1.5*vn*nx;B.vz-=1.5*vn*nz;B.vy*=.5;B.sp=0;B.ev.push('tree')}}});
  if(W.obs&&W.obs.length)obsAir();if(W.cv>=5)flag5air();else{const px=B.x-W.pin.x,pz=B.z-W.pin.z;if(MM.hyp(px,pz)<.05+BALL_R&&B.y>W.pin.y&&B.y<W.pin.y+2.3){B.vx*=.08;B.vz*=.08;B.vy=Math.min(B.vy,0)*.3;B.sp=0;B.ev.push('pin')}}
  terrainAt(W,B.x,B.z);if(TQ.ty!==7){B.dx=B.x;B.dz=B.z}
  if(oob(W,B.x,B.z)){B.st='oob';return}
  if(TQ.wl>-1e8&&B.y<TQ.wl+BALL_R*.5){B.st='water';return}
  if(B.y<TQ.h+BALL_R)bounce()}
function bounce(){const nx=TQ.nx,ny=TQ.ny,nz=TQ.nz,S=SURF[TQ.ty],vn=B.vx*nx+B.vy*ny+B.vz*nz;B.y=TQ.h+BALL_R;if(vn>=0)return;const v3=W.cv>=3,rain=v3&&W.rain;
  const spd=MM.hyp(B.vx,B.vy,B.vz),desc=MM.atan2(-vn,Math.max(1e-6,Math.sqrt(Math.max(0,spd*spd-vn*vn)))),landK=v3?clamp(desc/(45*DEG),SG.land[0],SG.land[1]):1;
  const first=!(B.nb|0);B.nb=(B.nb|0)+1;if(v3&&first){if(TQ.ty===6&&desc>=LIES.plugAng&&spd>=LIES.plugV){B.plug=true;B.vx=B.vy=B.vz=0;B.sp=0;B.st='rest';B.ev.push('tap');return}if(TQ.ty===4&&desc>=LIES.markAng&&W.marks&&B===PB&&!EXACT)W.marks.push([B.x,B.z])}
  let bf=S.bf*W.bk[TQ.ty]*(rain?RAIN.bf:1),e=S.rest*(rain?RAIN.rest:1)*(1-.7*sstep(3,30,-vn));if(W.cv>=5){const k=sstep(SKIP_ANG,BITE_ANG,desc);bf*=1+BITE_K*(2*k-1);e*=1-.5*BITE_K*k}if(W.cv>=4&&W.wear&&wearKind(TQ.cell,TQ.ty,B.x,B.z)===2){e*=1.2;bf*=.9}const vn2=-vn*e;let tx=B.vx-vn*nx,ty=B.vy-vn*ny,tz=B.vz-vn*nz;const vt=MM.hyp(tx,ty,tz),dv=bf*(1+e)*-vn+(v3?SG.checkK3:SG.checkK)*B.sp*bf*landK,f=vt>0?Math.max(0,vt-dv)/vt:0;tx*=f;ty*=f;tz*=f;
  if(MM.hyp(B.x-W.pin.x,B.z-W.pin.z)<CUP_R*.85&&vt*f<6){B.st='holed';return}
  B.sp*=.5;B.ev.push(-vn>3?'bounce':'tap');
  if(vn2<.9){B.vx=tx;B.vy=ty;B.vz=tz;B.st='roll'}else{B.vx=tx+vn2*nx;B.vy=ty+vn2*ny;B.vz=tz+vn2*nz}}
function stepRoll(dt){if(B.rim>0){rimRide(dt);return}
  terrainAt(W,B.x,B.z);const S=SURF[TQ.ty],nx=TQ.nx,ny=TQ.ny,nz=TQ.nz,vn=B.vx*nx+B.vy*ny+B.vz*nz;B.vx-=vn*nx;B.vy-=vn*ny;B.vz-=vn*nz;
  const gx=G*ny*nx,gy=-G+G*ny*ny,gz=G*ny*nz;B.vx+=gx*dt;B.vy+=gy*dt;B.vz+=gz*dt;
  const roll=S.roll*W.rk[TQ.ty]*(W.cv>=3&&W.rain?RAIN.roll:1),s=MM.hyp(B.vx,B.vy,B.vz);if(s>0){const dec=Math.min(roll*dt,s);B.vx-=B.vx/s*dec;B.vy-=B.vy/s*dec;B.vz-=B.vz/s*dec}
  B.x+=B.vx*dt;B.z+=B.vz*dt;if(W.obs&&W.obs.length)obsRoll();terrainAt(W,B.x,B.z);B.y=TQ.h+BALL_R;if(TQ.ty!==7){B.dx=B.x;B.dz=B.z}
  const dc=MM.hyp(B.x-W.pin.x,B.z-W.pin.z),sp=MM.hyp(B.vx,B.vz);
  if(W.cv>=5){if(cup5(dc,sp))return}else if(dc<CUP_R-.03){if(sp<3.3){B.st='holed';return}if(!B.lip){B.lip=true;const a=(B.rng()<.5?-1:1)*(.35+B.rng()*.4),c=MM.cos(a),sn=MM.sin(a),vx=B.vx,vz=B.vz;B.vx=(vx*c-vz*sn)*.72;B.vz=(vx*sn+vz*c)*.72;B.ev.push('lip')}}
  else if(dc>CUP_R+.3)B.lip=false;
  if(TQ.wl>-1e8&&B.y<TQ.wl+BALL_R*.5){B.st='water';return}
  if(oob(W,B.x,B.z)){B.st='oob';return}
  if(sp<.15&&MM.hyp(gx,gy,gz)<roll){B.vx=B.vy=B.vz=0;B.st='rest';if(W.cv>=7&&TQ.ty===9)pathRelief()}else if(W.cv>=6)creep5(sp,dt)}
function stepOne(){MM=W.M||NM;B.t+=DT;B.n=(B.n|0)+1;if(B.st==='air')stepAir(DT);else if(B.st==='roll')stepRoll(DT);if(B.t>45&&(B.st==='air'||B.st==='roll')){B.vx=B.vy=B.vz=0;B.st='rest'}}
function simulate(dt){MM=W.M||NM;B.acc+=dt;let n=0;while(B.acc>=DT&&n++<4000&&(B.st==='air'||B.st==='roll')){B.acc-=DT;stepOne();
    if(B.st==='air'&&(B.trail.length===0||MM.hyp(B.x-B.trail[B.trail.length-3],B.y-B.trail[B.trail.length-2],B.z-B.trail[B.trail.length-1])>1.5))B.trail.push(B.x,B.y,B.z)}}
function settle(){MM=W.M||NM;let n=0;while((B.st==='air'||B.st==='roll')&&n++<6000)stepOne()}
function withBall(b,fn){const sv=B;B=b;try{return fn()}finally{B=sv}}
const SB=newBall(),PRED={still:null,wind:null,tStill:0,tWind:0};
function predictShot(still,force,cl){MM=W&&W.M||NM;const c=cl||curClub();if(c.putter||!W)return null;const slot=(still?'still':'wind')+(cl?'_'+c.id:''),k0=curTick(),key=[c.id,c.sg?0:S.shape,c.sg?1:S.traj,Math.round(S.yaw*4000),Math.round(PB.x*20),Math.round(PB.z*20),W.seed,W.idx,W.cv,S.ball,PB.plug?1:0,PB.lf|0,still?0:Math.round((W.wind.x||0)*100)+','+Math.round((W.wind.z||0)*100)+','+(W.swell?k0:0),gPredK()].join(),old=PRED[slot];if(old&&old.key===key)return old;
  const now=performance.now();if(!force&&old&&now-PRED['t'+slot]<40)return old;PRED['t'+slot]=now;const svW=W.wind,svE=EXACT,dPin=MM.hyp(W.pin.x-PB.x,W.pin.z-PB.z);let pw=sgPow(c);if(still)W.wind={x:0,z:0,s:0,a:0};EXACT=true;let path,carry,rest;
  let treeD=null,face=false;const run=p=>{path=[];carry=null;treeD=null;face=false;withBall(SB,()=>{place(PB.x,PB.z);SB.plug=PB.plug;SB.lf=PB.lf;SB.rng=mulberry32(7);SB.k0=k0;SB.ballType=S.ball;SB.hand=PB.hand|0;SB.G=gNum();strike(c,p,0,S.yaw,c.sg?0:S.shape,c.sg?1:S.traj);let n=0;while((SB.st==='air'||SB.st==='roll')&&n++<9000){stepOne();if(treeD==null&&SB.tree)treeD=MM.hyp(SB.x-PB.x,SB.z-PB.z);if(!carry&&SB.ev.length)carry=[SB.x,SB.z];if(n%10===0)path.push(SB.x,SB.z)}path.push(SB.x,SB.z)});rest=[SB.x,SB.z];face=SB.ev.includes('face');carry=carry||rest;return MM.hyp(rest[0]-PB.x,rest[1]-PB.z)};
  try{let tot=run(pw);if(c.sg)for(let it=0;it<3&&tot>0;it++){const k=dPin/tot;if(Math.abs(k-1)<.06)break;pw=clamp(pw*Math.sqrt(k),SG.pinPow[0],SG.pinPow[1]);tot=run(pw)}}finally{W.wind=svW;EXACT=svE}
  const ux=MM.sin(S.yaw),uz=MM.cos(S.yaw),r={key,pow:pw,path,carry,rest,st:SB.st,treeD,face,carryD:MM.hyp(carry[0]-PB.x,carry[1]-PB.z),totalD:MM.hyp(rest[0]-PB.x,rest[1]-PB.z),roll:(rest[0]-carry[0])*ux+(rest[1]-carry[1])*uz};PRED[slot]=r;return r}
function checkText(i){const c=SG_SET[i],P=predictShot(true,false,c);if(!P)return'';const r=P.roll;return r<-.5?'spins back '+Math.abs(r).toFixed(r>-10?1:0)+' m':r<1.5?'stops':r<6?'checks '+r.toFixed(1)+' m':'runs '+Math.round(r)+' m'}
/* version 4 reads its own club rows: v3's spin model carries a full shot about 2% further than the version-0 rows the caddie showed (F-071: the range and the row agree) */
const CAL_F=['carry','total','carryT','totalT','curve'];
function useCalib(cv){const k=cv>=9?3:cv>=5?2:cv>=4?1:0;CALCV=cv;for(const c of CLUB_SET.slice(0,N_CLUBS))if(c.cal)for(const f of CAL_F)c[f]=c.cal[k][f]}
function calibrate(cv=0){const sv=W;EXACT=true;W={flat:2,M:mathFor(cv),rk:ONES,bk:ONES,wind:{x:0,z:0},cv,air:1,swell:0,pin:{x:1e6,z:1e6,y:0},tgrid:new Map(),ox:-1e9,oz:-1e9,cols:1e9,rows:1e9};
  const fly=(c,shape,traj)=>{place(0,0);strike(c,1,0,0,shape,traj);let carry=0,cx=0;while(B.st==='air'){stepAir(DT);if(!carry&&(B.st!=='air'||B.y<=BALL_R+1e-6)){carry=B.z;cx=B.x}}let n=0;while(B.st==='roll'&&n++<12000)stepRoll(DT);return{carry:c.putter?0:carry,total:B.z,cx}};
  for(const c of CLUB_SET){W.flat=c.putter?4:2;c.carryT=[];c.totalT=[];for(let t=0;t<TRAJ.length;t++){const r=fly(c,0,t);c.carryT.push(Math.round(r.carry));c.totalT.push(Math.round(r.total))}
    c.carry=c.carryT[1];c.total=c.totalT[1];c.curve=c.putter?0:Math.abs(fly(c,2,1).cx)}W=sv;EXACT=false}
