/* ===== Q-11 stance follows the lie: each foot takes the ground under it, the hips their mean; the spine tilts with F-032's along and side slope (as STANCE.cap clamps it); in sand the feet sink SAND_SINK. Drawing only ===== */
const SAND_SINK=.04,HIP_Y=.92,FOOT_Z=.1,STANCE_SHEAR=.35;
/* the golfer's height, the legs' shear (each foot on its ground) and the upper body's tilt about the hips */
function stance11(bx,bz,gx,gz,yaw,d){terrainAt(W,gx-d[0]*FOOT_Z,gz-d[2]*FOOT_Z);const h1=TQ.h,t1=TQ.ty;terrainAt(W,gx+d[0]*FOOT_Z,gz+d[2]*FOOT_Z);const h2=TQ.h,t2=TQ.ty;terrainAt(W,bx,bz);const sand=TQ.ty===6||t1===6||t2===6;
  const k=clamp((h2-h1)/(2*FOOT_Z),-STANCE_SHEAR,STANCE_SHEAR),sh=M4.trs(0,0,0,1);sh[9]=k;const st=stanceAt(bx,bz,yaw);
  const tilt=M4.mul(M4.trs(0,HIP_Y,0,1),M4.mul(M4.rot(1,0,0,-st.along),M4.mul(M4.rot(0,0,1,st.side),M4.trs(0,-HIP_Y,0,1))));
  return{y:(h1+h2)/2-(sand?SAND_SINK:0),shear:sh,tilt}}
/* the golfer's parts on its stance: the scene draws them, and on High the shadow pass (Q-17) */
function golferParts(x,z,yaw,th,look,lk){const lk0=lk==null?S.look:lk,GM=golferMesh(lk0&~HAND_BIT),hs=(lk0&HAND_BIT)?-1:1,r=[MM.cos(yaw)*hs,0,-MM.sin(yaw)*hs],d=[MM.sin(yaw),0,MM.cos(yaw)],gx=x+r[0]*GOLFER.side,gz=z+r[2]*GOLFER.side,P=stance11(x,z,gx,gz,yaw,d),G0=M4.axes(r,[0,1,0],d,[gx,P.y,gz]),G=M4.mul(G0,P.tilt),A=GOLFER.axis;
  return[[GM.legs,M4.mul(G0,P.shear)],[GM.torso,M4.mul(G,M4.mul(M4.trs(0,GOLFER.torsoY,0),M4.rot(0,1,0,th*.35)))],[GM.head,M4.mul(G,M4.mul(M4.trs(0,GOLFER.headY,0),M4.rot(0,1,0,look+th*.15)))],[GM.arms,M4.mul(G,M4.mul(M4.trs(0,GOLFER.shoulder,0),M4.mul(M4.rot(A[0],A[1],A[2],th),M4.rot(0,0,1,GOLFER.tilt))))]]}
