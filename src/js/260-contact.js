/* ===== Q-02 strike-scaled contact: the strike already in the record — the accuracy, a fat or a thin — sets a hit-stop, a camera kick (or a shake for a mishit) and the contact sound; replays play the same contact ===== */
const HITSTOP=[[.9,2],[.6,1]],KICK=[.3,2*DEG,180],SHAKE=[.15,120],CONTACT_BODY=[110,160,.06,.09],CONTACT_CLICK=[2400,3000,.015],FX={stop:0,t0:-1e9,q:1,pow:0,mis:0};
/* q: 1 at the zone's centre, 0 at its edge, −|mis| for fat or thin (F-050) */
const strikeQ=(acc,mis)=>mis?-Math.abs(mis):1-Math.min(1,Math.abs(acc));
function contactFX(c,pow,acc,mis){if(c.putter){FX.q=1;return}const q=strikeQ(acc,mis);FX.q=q;FX.pow=pow;FX.mis=mis;FX.t0=performance.now();FX.stop=0;for(const[m,n]of HITSTOP)if(q>=m){FX.stop=n;break}}
AU.contact=function(q,v){const cls=FX.cls||0,fk=CONTACT_CLASS[cls][0],dk=CONTACT_CLASS[cls][1],b=Math.max(0,q),k=1-b,f=(CONTACT_BODY[0]+(CONTACT_BODY[1]-CONTACT_BODY[0])*b)*fk,d=(CONTACT_BODY[2]+(CONTACT_BODY[3]-CONTACT_BODY[2])*b)*dk;
  this.hiss(2200*fk,.8,.05,.3*v);if(b>0)this.tone(f,f*.6,d,.6*v*b);this.tone((CONTACT_CLICK[0]+(CONTACT_CLICK[1]-CONTACT_CLICK[0])*k)*fk,CONTACT_CLICK[0]*fk,CONTACT_CLICK[2]*dk,.35*v*(.25+k),'square')};
/* the kick: a dolly back and a pitch up that settle over KICK_T, scaled by q × power; a mishit shakes sideways instead. Drawing only */
let KICKED=null;function camKick(){if(rmOn())return;const a=performance.now()-FX.t0;if(a<0||a>Math.max(KICK[2],SHAKE[1])||!cam)return;const fx=cam.tx-cam.x,fy=cam.ty-cam.y,fz=cam.tz-cam.z,L=Math.hypot(fx,fy,fz)||1;let dx=0,dy=0,dz=0,ty=0;
  if(FX.q>0&&a<KICK[2]){const k=(1-a/KICK[2])**2*FX.q*FX.pow;dx=-fx/L*KICK[0]*k;dy=-fy/L*KICK[0]*k;dz=-fz/L*KICK[0]*k;ty=MM.tan(KICK[1]*k)*L}
  else if(FX.q<0&&a<SHAKE[1]){const k=(1-a/SHAKE[1])*MM.sin(a/SHAKE[1]*Math.PI*6)*SHAKE[0]*Math.min(1,-FX.q*2);dx=fz/L*k;dz=-fx/L*k}
  KICKED=[dx,dy,dz,ty];cam.x+=dx;cam.y+=dy;cam.z+=dz;cam.tx+=dx;cam.ty+=dy+ty;cam.tz+=dz}
function camUnkick(){const K=KICKED;if(!K)return;KICKED=null;cam.x-=K[0];cam.y-=K[1];cam.z-=K[2];cam.tx-=K[0];cam.ty-=K[1]+K[3];cam.tz-=K[2]}
VL.feature({id:'q02.contact',kind:'view',deps:['core.view'],f:['Q-02']});
