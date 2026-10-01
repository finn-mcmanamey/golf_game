/* ===== light and atmosphere: Q-17 voxel AO baked per vertex and the golfer in the shadow pass; Q-20 a highlight shoulder and a grade per biome and season; Q-18 a sky that scatters with the sun's height and a haze that warms toward the sun; Q-19 water that reads the round's wind, foam on the shore and a splash ring. Drawing only ===== */
const AO_R=3,AO_K=.55;
/* Q-17: occlusion at mesh build = the mean over eight directions of the steepest rise within AO_R blocks (a slope of 1 is full), stored in the normal's spare byte */
function aoBake(P,Nn,nx,nz,S){const s=nx+1,DI=[1,1,0,-1,-1,-1,0,1],DJ=[0,1,1,1,0,-1,-1,-1],R2=1/Math.SQRT2;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const k=j*s+i,h0=P[k*3+1];let occ=0;
    for(let d=0;d<8;d++){const di=DI[d],dj=DJ[d],f=(di!==0&&dj!==0?R2:1)/S;let m=0;for(let q=1;q<=AO_R;q++){const a=i+di*q,b=j+dj*q;if(a<0||b<0||a>nx||b>nz)break;const r=(P[(b*s+a)*3+1]-h0)*f/q;if(r>m)m=r}occ+=m<1?m:1}
    Nn[k*4+3]=(occ*15.875+.5)|0}}
function golferShadow(dm){if(GFX.level<2||S.mode==='title'||S.ov||!W)return;const g=golferAt();for(const[m,Mx] of golferParts(g.x,g.z,g.yaw,golferPose(),0,null))dm(m,Mx)}
/* Q-20: the grade — lift, gain (rgb) and gamma, saturation and contrast — per biome, times the season's; EXPOSURE before the shoulder */
const EXPOSURE=1.0,SHOULDER=.75;
/* the screen's own saturation (clear, overcast) and contrast on top of the grade; the readable-cuts model reads the grade, not these */
const SCREEN_SAT=[1.1,1.04],SCREEN_CON=1.06;
const GRADE=[{lift:[0,0,0],gain:[1,1,1],gamma:1,sat:1,con:1},{lift:[.01,.012,.02],gain:[.97,1,1.04],gamma:1,sat:.93,con:1.02},{lift:[.02,0,.02],gain:[1.03,.97,1.02],gamma:1,sat:.97,con:1},{lift:[.03,.02,0],gain:[1.05,1,.92],gamma:1.02,sat:.93,con:.98},
  {lift:[0,.005,0],gain:[.98,1.03,.96],gamma:.98,sat:1.06,con:1.02},{lift:[0,.006,.02],gain:[.97,1,1.06],gamma:1,sat:1,con:1.05},{lift:[0,.012,.012],gain:[.97,1.03,1.03],gamma:1.03,sat:1.04,con:1}];
const SEASON_GRADE=[{gain:[1,1,1],sat:1},{gain:[1.02,1,.98],sat:1.03},{gain:[1.04,1,.96],sat:1.02},{gain:[.97,.99,1.03],sat:.9}];
function gradeSet(){if(!PX.u.uExpo)return;const g=GRADE[W&&W.bio!=null?W.bio:0]||GRADE[0],se=SEASON_GRADE[W&&W.season!=null?W.season:0]||SEASON_GRADE[0],fl=W&&W.wea&&W.wea.flat;
  gl.uniform1f(PX.u.uExpo,EXPOSURE);gl.uniform3f(PX.u.uLift,g.lift[0],g.lift[1],g.lift[2]);gl.uniform3f(PX.u.uGain,g.gain[0]*se.gain[0],g.gain[1]*se.gain[1],g.gain[2]*se.gain[2]);gl.uniform1f(PX.u.uGamma,g.gamma);gl.uniform1f(PX.u.uSat,(fl?SCREEN_SAT[1]:SCREEN_SAT[0])*satOf(g,se,W&&W.season));gl.uniform1f(PX.u.uCon,SCREEN_CON*g.con)}
/* Q-18: the sky's scattering on High — the sun's height tints zenith and horizon, a glow gathers round the sun */
function skySet(){if(!PK.u.uScat)return;const SU=FR.sun||SUN;gl.uniform1f(PK.u.uScat,GFX.level>=2?1:0);gl.uniform1f(PK.u.uSunY,SU[1])}
/* Q-19: the round's wind for the water (unit direction, strength from s(k)); the splash ring where a ball went in */
const RIPPLE_N=3,FOAM_D=.25,SPLASH_T=2.5,SPL={on:false,x:0,y:0,z:0,t0:0};
function wnd19(wf){const w=W&&W.wind||{x:0,z:0,s:0},s=w.s||0;return s>.05?[w.x/s,w.z/s,Math.min(2,s*wf/6)]:[0,1,0]}
function splash19(){if(!W||S.photo)return;if(PB.st==='water'){if(!SPL.on){terrainAt(W,PB.x,PB.z);SPL.on=true;SPL.x=PB.x;SPL.z=PB.z;SPL.y=TQ.wl>-1e8?TQ.wl:PB.y;SPL.t0=S.t}}else SPL.on=false;
  if(!SPL.on)return;const u=(S.t-SPL.t0)/SPLASH_T;if(u<0||u>=1)return;useProg(PS,A);for(const k of[0,.35])if(u>k)draw(ringMesh,M4.trs(SPL.x,SPL.y+.02,SPL.z,.3+2.6*(u-k)),[1,1,1,.75*(1-u)])}
VL.feature({id:'q.draw',kind:'view',deps:['core.view'],f:['Q-05','Q-06','Q-10','Q-11','Q-12','Q-13','Q-14','Q-15','Q-16','Q-17','Q-18','Q-19','Q-20']});
