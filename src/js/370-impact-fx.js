/* ===== Q-16 impact set (sizes are full extents; the particle box takes half): read from the lie and the strike at contact — an iron or wedge from grass throws a divot sized by the strike and a spray of turf, sand a burst, waste a puff of dust, a teed wood sends the tee spinning away; all scaled by Q-02's q. High and up. Drawing only ===== */
const DIVOT=[.25,.08,.15],DIVOT_FLY=[3,8],TURF_N=14,SAND_N=40,DUST_N=18;
function part16(x,y,z,vx,vy,vz,s,life,col,sx,sy,sz){if(PARTS.length<400)PARTS.push({x,y,z,vx,vy,vz,s,life,col,sx,sy,sz})}
function impactFX(c,yaw,mis){if(GFX.level<2||c.putter||!W)return;terrainAt(W,B.x,B.z);const ty=TQ.ty,h=TQ.h,dx=MM.sin(yaw),dz=MM.cos(yaw),q=FX.q,R=Math.random,iron=c.id>=8&&c.id<=20,wood=c.id<=4;
  if(iron&&(ty===0||ty===1||ty===2||ty===3)&&!(mis<0)){const k=1+Math.max(0,mis),d=DIVOT_FLY[0]+(DIVOT_FLY[1]-DIVOT_FLY[0])*Math.max(0,q),v=Math.sqrt(d*9.8);
    part16(B.x+dx*.15,h+.04,B.z+dz*.15,dx*v*.72+(R()-.5),v*.72,dz*v*.72+(R()-.5),DIVOT[1]/2,1.4,[.34,.4,.2],DIVOT[0]*k/2,DIVOT[1]*k/2,DIVOT[2]*k/2);
    const n=Math.round(TURF_N*Math.max(.3,Math.abs(q)));for(let i=0;i<n;i++){const a=yaw+(R()-.5)*1.2,sp=2+R()*5;part16(B.x,h+.05,B.z,MM.sin(a)*sp,1.5+R()*3,MM.cos(a)*sp,.015+R()*.02,.5+R()*.5,R()<.5?[.3,.52,.22]:[.42,.32,.2])}}
  else if(ty===6){const n=Math.round(SAND_N*(c.sg&&c.sgi===3?1:.6+.4*Math.max(0,q)));for(let i=0;i<n;i++){const a=yaw+(R()-.5)*1.6,sp=1+R()*4;part16(B.x,h+.05,B.z,MM.sin(a)*sp,2+R()*4,MM.cos(a)*sp,.02+R()*.025,.6+R()*.7,[.9,.82,.6])}}
  else if(ty===8){for(let i=0;i<DUST_N;i++){const a=R()*TAU,sp=.5+R()*2;part16(B.x,h+.05,B.z,MM.sin(a)*sp,.8+R()*1.5,MM.cos(a)*sp,.04+R()*.05,.8+R()*.8,[.82,.72,.56])}}
  if(wood&&ty===5)part16(B.x,h+.03,B.z,dx*(3+R()*2)+(R()-.5)*2,2.5+R()*1.5,dz*(3+R()*2)+(R()-.5)*2,.01,1,[.97,.97,.95],.01,.03,.01)}
