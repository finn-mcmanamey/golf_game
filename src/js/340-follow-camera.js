/* ===== Q-10 smart follow camera: a followed shot already knows its landing (pre-simulated at contact), so the camera springs to a framing that holds the ball and the landing, widens to keep both, never sits in the ground or a canopy, rises while the ground hides the ball, and turns at most CAM_TURN a second. Drawing only ===== */
const CAM_W=4,CAM_FOV_MAX=70*DEG,CAM_FOV0=55*DEG,CAM_CLEAR=1.5,CAM_TURN=60*DEG,CAM_LOOK=.6,CAM_RISE=6;
const C10={key:null,p:[0,0,0],v:[0,0,0],q:[0,0,0],w:[0,0,0],lift:0};
const cam10On=()=>S.mode==='shot'&&!!S.shotCam&&S.shotCam.follow&&S.shotCam.lx!=null&&!curClub().putter&&(PB.st==='air'||PB.st==='roll');
/* a critically damped spring at CAM_W: settles in about 1/CAM_W s without overshoot */
function spr10(x,v,g,dt){v+=(CAM_W*CAM_W*(g-x)-2*CAM_W*v)*dt;return[x+v*dt,v]}
function cam10(dt){const C=S.shotCam,b=PB;if(C10.key!==C){C10.key=C;C10.p=[cam.x,cam.y,cam.z];C10.v=[0,0,0];C10.q=[cam.tx,cam.ty,cam.tz];C10.w=[0,0,0];C10.lift=0}
  let dx=C.lx-b.sx,dz=C.lz-b.sz,dl=Math.hypot(dx,dz);if(dl<1){dx=b.vx;dz=b.vz;dl=Math.hypot(dx,dz)||1}dx/=dl;dz/=dl;
  /* the look: from the ball toward the landing as the flight goes on; after the landing, the ball */
  terrainAt(W,C.lx,C.lz);const ly=TQ.h,f=b.st==='air'?CAM_LOOK*sstep(0,1,b.t/Math.max(.1,C.landT||1)):0,T=[b.x+(C.lx-b.x)*f,b.y+(ly-b.y)*f,b.z+(C.lz-b.z)*f];
  /* the place: behind the ball on the shot's line, lifted while the ground hides the ball */
  C10.lift=ballHidden(b)?Math.min(12,C10.lift+CAM_RISE*dt):Math.max(0,C10.lift-CAM_RISE/3*dt);
  const sp=Math.hypot(b.vx,b.vz),D=9+Math.min(sp,40)*.15,gx=b.x-dx*D,gz=b.z-dz*D;terrainAt(W,gx,gz);const G=[gx,Math.max(b.y+4,TQ.h+CAM_CLEAR+.7)+C10.lift,gz];
  for(let i=0;i<3;i++){[C10.p[i],C10.v[i]]=spr10(C10.p[i],C10.v[i],G[i],dt);[C10.q[i],C10.w[i]]=spr10(C10.q[i],C10.w[i],T[i],dt)}
  /* never in the ground, never in a canopy */
  let[x,y,z]=C10.p;terrainAt(W,x,z);if(y<TQ.h+CAM_CLEAR){y=TQ.h+CAM_CLEAR;C10.v[1]=Math.max(0,C10.v[1])}
  nearTrees(x,z,t=>{for(const c of t.cs){const ex=x-c.x,ey=y-c.y,ez=z-c.z,l=Math.hypot(ex,ey,ez),r=c.r+.4;if(l<r){const k=r/(l||1);x=c.x+ex*k;y=c.y+ey*k;z=c.z+ez*k}}});C10.p=[x,y,z];
  /* the view turns at most CAM_TURN a second */
  const o=[cam.tx-cam.x,cam.ty-cam.y,cam.tz-cam.z],n=[C10.q[0]-x,C10.q[1]-y,C10.q[2]-z],lo=Math.hypot(o[0],o[1],o[2])||1,ln=Math.hypot(n[0],n[1],n[2])||1,A=Math.acos(clamp((o[0]*n[0]+o[1]*n[1]+o[2]*n[2])/(lo*ln),-1,1)),mx=CAM_TURN*dt;
  let v=[n[0]/ln,n[1]/ln,n[2]/ln];if(A>mx){const k=mx/A,m=[o[0]/lo*(1-k)+v[0]*k,o[1]/lo*(1-k)+v[1]*k,o[2]/lo*(1-k)+v[2]*k],ml=Math.hypot(m[0],m[1],m[2])||1;v=[m[0]/ml,m[1]/ml,m[2]/ml]}
  /* the view widens to hold the ball and the landing, up to CAM_FOV_MAX */
  const ang=(px,py,pz)=>{const w=[px-x,py-y,pz-z],wl=Math.hypot(w[0],w[1],w[2])||1;return Math.acos(clamp((w[0]*v[0]+w[1]*v[1]+w[2]*v[2])/wl,-1,1))},half=Math.max(ang(b.x,b.y,b.z),b.st==='air'?ang(C.lx,ly,C.lz):0)+6*DEG;
  cam.fov+=(clamp(2*half,CAM_FOV0,CAM_FOV_MAX)-cam.fov)*Math.min(1,dt*3);
  cam.x=x;cam.y=y;cam.z=z;cam.tx=x+v[0]*ln;cam.ty=y+v[1]*ln;cam.tz=z+v[2]*ln;cam.fogK=lerp(cam.fogK,.0012,1-MM.exp(-dt*4))}
