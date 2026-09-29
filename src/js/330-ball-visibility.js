/* ===== Q-12 ball always readable: the ball never draws under BALL_MIN_PX; where trees or ground hide it, it is drawn again as a flat silhouette in the tracer colour; every cut-camera flight leaves a TRAIL_T trail (followed shots keep their full tracer); a ring pulses where a ball rests far off or hidden. Drawing only ===== */
const BALL_MIN_PX=3,TRAIL_T=.6,PULSE_EVERY=2,PULSE_FAR=60,PULSE_T=.9,BALL_SIL=.85;
/* the radius that keeps a ball BALL_MIN_PX (CSS pixels) on screen, and the height that keeps a grown ball on the ground */
function ballR(x,y,z){if(S.photo)return BALL_R;const d=Math.hypot(x-cam.x,y-cam.y,z-cam.z),px=innerHeight/2/MM.tan(cam.fov/2);return Math.max(BALL_R,BALL_MIN_PX*d/px)}
const ballY=(b,r)=>b.y+(b.st==='air'?0:r-BALL_R);
const tracerCol=()=>LOOK.tracer[lookGet(S.look,'tracer')]||[1,1,1];
/* hidden: the ground rises above the line from the camera to the ball (eight samples) */
function ballHidden(b){for(let k=1;k<8;k++){const u=k/8,x=cam.x+(b.x-cam.x)*u,y=cam.y+(b.y-cam.y)*u,z=cam.z+(b.z-cam.z)*u;terrainAt(W,x,z);if(TQ.h>y+.05)return true}return false}
/* in the opaque pass, after the ground, trees and grass but before the golfer: each ball's silhouette where they hide it (the golfer, drawn after, still covers it) */
function ballSil(){if(!W||S.photo||S.mode==='title')return;const L=[];if(PB.st!=='holed'&&!S.provHide&&!S.dropA)L.push([PB,tracerCol()]);if(S.ghost&&GB.st!=='holed'&&!S.ov)L.push([GB,[.55,.8,1]]);if(!L.length)return;
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.depthFunc(gl.GREATER);useProg(PS,A);for(const[b,c] of L){const r=ballR(b.x,b.y,b.z);draw(ballMesh,M4.trs(b.x,ballY(b,r),b.z,r),[c[0],c[1],c[2],BALL_SIL])}
  gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND)}
/* after the scene, blended: the short trail and the pulse */
function ballRead(){if(!W||S.photo||S.mode==='title')return;useProg(PS,A);ballTrail();ballPulse(PB);if(S.ghost&&!S.ov)ballPulse(GB)}
/* the last TRAIL_T of a cut-camera flight: back from the ball along its trail as far as it flies in TRAIL_T */
function ballTrail(){if(PB.st!=='air'||!S.shotCam||S.shotCam.follow||S.replay)return;const T=PB.trail,L=Math.hypot(PB.vx,PB.vy,PB.vz)*TRAIL_T;let d=0,px=PB.x,py=PB.y,pz=PB.z;const P=[px,py,pz];
  for(let i=T.length-3;i>=0&&d<L;i-=3){const s=Math.hypot(T[i]-px,T[i+1]-py,T[i+2]-pz);if(d+s>L){const f=(L-d)/s;P.push(px+(T[i]-px)*f,py+(T[i+1]-py)*f,pz+(T[i+2]-pz)*f);break}d+=s;px=T[i];py=T[i+1];pz=T[i+2];P.push(px,py,pz)}
  const n=P.length/3;if(n<2)return;if(trailArr.length<n*5)trailArr=new Float32Array(n*10);for(let i=0;i<n;i++){trailArr[i*5]=P[i*3];trailArr[i*5+1]=P[i*3+1];trailArr[i*5+2]=P[i*3+2];trailArr[i*5+3]=0;trailArr[i*5+4]=0}
  gl.bindBuffer(gl.ARRAY_BUFFER,trailBuf);gl.bufferData(gl.ARRAY_BUFFER,trailArr.subarray(0,n*5),gl.DYNAMIC_DRAW);const c=tracerCol();draw({buf:trailBuf,n},ID,[c[0],c[1],c[2],.7],gl.LINE_STRIP)}
/* at rest far off or hidden: a ring grows and fades every PULSE_EVERY, scaled with distance so it reads */
function ballPulse(b){if(b.st!=='rest'||S.replay)return;const d=Math.hypot(b.x-cam.x,b.z-cam.z),hid=ballHidden(b);if(d<=PULSE_FAR&&!hid)return;const u=(S.t%PULSE_EVERY)/PULSE_T;if(u>=1)return;
  terrainAt(W,b.x,b.z);if(hid)gl.disable(gl.DEPTH_TEST);draw(ringMesh,M4.trs(b.x,TQ.h+.06,b.z,(.4+2.2*u)*Math.max(1,d/40)),[1,1,1,.8*(1-u)]);if(hid)gl.enable(gl.DEPTH_TEST)}
