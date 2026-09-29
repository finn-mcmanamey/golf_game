/* ===== v6 M2 · Validated flight (course version 9): F-122. Drag and lift follow the spin ratio S = r·ω/v; each club launches at TrackMan's PGA Tour angle and spin, at the ball speed that carries the game's bag (qs/v6/flightbag.js solves LAUNCH9; qs/v6/flightfit6.js fits AERO9). Versions 0-8 never enter this code. */
const FLIGHT_TOL=.05,R9=.02135,KA9=1.225*Math.PI*R9*R9/(2*.04593);
const AERO9={a0:.19268,a1:.29533,a4:-.21647,a2:.51566,vc:39.24641,b0:.34879,b1:.1865,b2:.26346,dec:.07528};
const LAUNCH9={DR:[77.03,10.9,2686],MD:[73.03,10.5,3200],'3W':[69.84,9.2,3655],'5W':[67.36,9.4,4350],'7W':[65.23,10.4,4700],'2H':[68.06,9.6,4100],'3H':[66.21,9.9,4270],'4H':[64.41,10.2,4437],'2I':[64.3,9.6,4300],'3I':[62.91,10.4,4630],'4I':[61.62,11,4836],'5I':[60.23,12.1,5361],'6I':[57.58,14.1,6231],'7I':[54.38,16.3,7097],'8I':[51.86,18.1,7998],'9I':[48.61,20.4,8647],PW:[45.98,24.2,9304],GW:[42.54,29,10000],SW:[39.06,34,10500],LW:[34.76,40,11000]};
const FLIGHT_REF={DR:[251,29,38],'3W':[222,27,43],'5W':[210,28,47],'4H':[206,27,47],'5I':[177,28,49],'6I':[167,27,50],'7I':[157,29,50],'8I':[146,28,50],'9I':[135,27,51],PW:[124,27,52]};
for(const c of CLUB_SET){const q=LAUNCH9[c.s];if(q&&!c.sg){c.v9=q[0];c.ang9=q[1]*DEG;c.w9=q[2]*TAU/60}}
const BOT_POW9=1.6;
const PART_LOFT9=.6,PART9=[.15,.4];
const part9=pow=>sstep(PART9[0],PART9[1],pow);
const LIE9=.55;
const F9={d:0,l:0};
function aero9(rs,dt){const A=AERO9,s=Math.max(rs,1);if(B.sp<B.sp9*.999)B.w9=B.sp9>0?B.w9*B.sp/B.sp9:0;const S=R9*B.w9/s;
  F9.d=KA9*(A.a0+A.a1*S+A.a4*S*S+A.a2*Math.max(0,A.vc-s)/A.vc)*s;F9.l=KA9*A.b0*(1-MM.exp(-S/A.b1))*(1+A.b2*(s/50-1))*s;B.w9*=1-A.dec*(s/50)*dt;return F9.d}
function flight9(c){const sv=W,svB=B;EXACT=true;W={flat:2,M:mathFor(9),rk:ONES,bk:ONES,wind:{x:0,z:0},cv:9,air:1,swell:0,pin:{x:1e6,z:1e6,y:0},tgrid:new Map(),ox:-1e9,oz:-1e9,cols:1e9,rows:1e9};B=newBall();
  try{place(0,0);strike(c,1,0,0,0,1);const y0=B.y;let p=[0,0,0,0,0,0];while(B.st==='air'){p=[B.x,B.y,B.z,B.vx,B.vy,B.vz];stepAir(DT);if(B.nb|0||B.y<=y0)break}const f=(p[1]-y0)/Math.max(1e-9,p[1]-B.y);
    return{carry:p[2]+(B.z-p[2])*Math.min(1,f),apex:B.apex-y0,land:MM.atan2(-p[4],Math.hypot(p[3],p[5]))/DEG,v:c.v9,ang:c.ang9/DEG,rpm:c.w9*60/TAU}}finally{W=sv;B=svB;EXACT=false}}
function partRoll(c,pow,cv){const sv=W,svB=B;EXACT=true;W={flat:2,M:mathFor(cv),rk:ONES,bk:ONES,wind:{x:0,z:0},cv,air:1,swell:0,pin:{x:1e6,z:1e6,y:0},tgrid:new Map(),ox:-1e9,oz:-1e9,cols:1e9,rows:1e9};B=newBall();
  try{place(0,0);strike(c,pow,0,0,0,1);const y0=B.y;let carry=0,land=0,pv=[0,0,0];while(B.st==='air'){pv=[B.vx,B.vy,B.vz];stepAir(DT);if(!carry&&(B.nb|0||B.st!=='air'||B.y<=y0)){carry=B.z;land=MM.atan2(-pv[1],Math.hypot(pv[0],pv[2]))/DEG}}let n=0;while(B.st==='roll'&&n++<12000)stepRoll(DT);return{carry,roll:B.z-carry,land}}finally{W=sv;B=svB;EXACT=false}}
const FLIGHT_NOTE='voxellinks.flight9';
function flightNote(){if(lsGet(FLIGHT_NOTE,0))return'';try{VS.setItem(FLIGHT_NOTE,'1')}catch(e){}return'<br><i>Validated flight: your wedges carry further and land steeper; the club row shows the new carries.</i>'}
