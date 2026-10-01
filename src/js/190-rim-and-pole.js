/* ===== Q-03 course version 5: the rim is geometry, the flagstick a pole, a landing bites or skips by its angle — no dice ===== */
const CAP_DROP=.087,RIM_E=.55,LIP_TURN=50*DEG,FLAG_R=.05,FLAG_H=2.3,FLAG_E=.35,FLAG_DROP_V=1.5,BITE_ANG=50*DEG,SKIP_ANG=20*DEG,BITE_K=.25,CAP_K=Math.sqrt(G/(2*CAP_DROP));
/* reflect the ball's horizontal velocity off the pole at the hole; true if it was moving into it */
function pole5(dx,dz,d){const nx=dx/d,nz=dz/d,vn=B.vx*nx+B.vz*nz;if(vn>=0)return false;B.vx-=(1+FLAG_E)*vn*nx;B.vz-=(1+FLAG_E)*vn*nz;B.sp=0;B.ev.push('pin');return true}
/* rolling: capture on entry (the ball must fall CAP_DROP while crossing its chord), the pole, and the rim ride on the way out */
function cup5(dc,sp){const cx=W.pin.x,cz=W.pin.z,dx=B.x-cx,dz=B.z-cz;
  if(!B.cup&&dc<CUP_R){B.cup=true;if(sp<1e-6){B.st='holed';return true}const b=Math.abs((B.vx*dz-B.vz*dx)/sp);if(sp<=2*Math.sqrt(Math.max(0,CUP_R*CUP_R-b*b))*CAP_K){B.st='holed';return true}}
  if(dc<FLAG_R+BALL_R&&dc>1e-9&&pole5(dx,dz,dc)&&MM.hyp(B.vx,B.vz)<=FLAG_DROP_V){B.st='holed';return true}
  if(B.cup&&dc>=CUP_R){B.cup=false;const v=MM.hyp(B.vx,B.vz)||1,cr=(B.vx*-dz+B.vz*dx)/v;B.rim=LIP_TURN*Math.min(1,Math.abs(cr)/CUP_R);B.rimS=cr>0?1:-1;B.ev.push('lip');if(B.rim<1e-6){B.rim=0;B.vx*=RIM_E;B.vy*=RIM_E;B.vz*=RIM_E}}
  return false}
/* the ride: the ball runs round the rim toward the side the hole was on, its path turning with it, then leaves at RIM_E of its pace */
function rimRide(dt){const cx=W.pin.x,cz=W.pin.z,v=MM.hyp(B.vx,B.vz),d=Math.min(B.rim,v*dt/CUP_R),t=B.rimS*d,c=MM.cos(t),s=MM.sin(t),rx=B.x-cx,rz=B.z-cz,rl=MM.hyp(rx,rz)||1,vx=B.vx,vz=B.vz;
  B.x=cx+(rx*c-rz*s)*CUP_R/rl;B.z=cz+(rx*s+rz*c)*CUP_R/rl;B.vx=vx*c-vz*s;B.vz=vx*s+vz*c;B.rim-=d;terrainAt(W,B.x,B.z);B.y=TQ.h+BALL_R;B.dx=B.x;B.dz=B.z;
  if(B.rim<=1e-9){B.rim=0;B.vx*=RIM_E;B.vy*=RIM_E;B.vz*=RIM_E}}
/* flying: the pole reflects instead of stopping the ball dead; one that falls inside the cup is caught by the landing's dunk rule */
function flag5air(){const dx=B.x-W.pin.x,dz=B.z-W.pin.z,d=MM.hyp(dx,dz);if(d<FLAG_R+BALL_R&&d>1e-9&&B.y>W.pin.y&&B.y<W.pin.y+FLAG_H)pole5(dx,dz,d)}
/* version 6: a ball barely moving on a slope its friction almost holds is at rest after CREEP_T below CREEP_V (the grass holds it; versions 4 and 5 run such balls to the 45 s cap) */
const CREEP_V=.06,CREEP_T=1.5;
function creep5(sp,dt){if(sp<CREEP_V){B.creep=(B.creep||0)+dt;if(B.creep>=CREEP_T){B.vx=B.vy=B.vz=0;B.st='rest'}}else B.creep=0}
VL.feature({id:'q03.rim',kind:'sim',deps:['core.sim'],f:['Q-03']});
