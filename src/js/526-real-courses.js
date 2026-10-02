/* ===== Real courses: holes built from map data (525-real-data.js) instead of being invented from a seed.
   A round on one is an ordinary v10 round with S.real set to the course's id; the seed still deals the day's weather, wind
   and pin set. Round codes store the course in the island header's kind field (7, then a 6-bit id), a value no older code
   uses, so every existing replay is untouched. Building a hole is scored code: plain arithmetic, the game's MM maths under
   course version CV, and seeded randoms only. ===== */
const REAL_DIGITS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const REAL_BIO=4;                  /* Parkland: the game's closest look to a Tasmanian river course */
const REAL_MARGIN=[40,20];         /* metres of course kept either side of a hole's line (shrinks on huge holes) */
const REAL_CELLS=46000;            /* the same cell budget gridOf gives an invented hole */
const REAL_SAND=.55,REAL_TEE_RISE=.25,REAL_WATER_DEPTH=1.6,REAL_GREEN_TILT=.3;
const REAL_TREE_STEP=7,REAL_TREE_CLEAR=12,REAL_TREE_LINE=22;  /* tree spacing, gap to any playing surface, gap to a hole's line */
const REAL_SEA=10,REAL_WOOD=16,REAL_HOUSE=32;                 /* surface-map codes and flags beyond the game's own 0-9 */
/* map classes in paint order → surface code: boundary, rough, sea, wood, building, fairway, tee, green, bunker, water */
const REAL_PAINT=[[0,0],[1,0],[7,REAL_SEA],[8,REAL_WOOD],[9,REAL_HOUSE],[2,2],[4,5],[3,4],[5,6],[6,7]];

/* zig-zag integers stored as base-64 digits: 5 bits each, the 6th bit says more digits follow */
function realInts(s){const out=[];let v=0,k=1;for(let i=0;i<s.length;i++){const d=REAL_DIGITS.indexOf(s[i]);v+=(d&31)*k;if(d&32)k*=32;else{out.push(v%2?-(v+1)/2:v/2);v=0;k=1}}return out}

/* n paths of half-metre deltas starting at a[i] → [{c,p:[[x,z],...]}] in metres */
function realPaths(a,i,n,withClass){const out=[];for(let q=0;q<n;q++){const c=withClass?a[i++]:0,m=a[i++],p=[];let x=0,z=0;for(let k=0;k<m;k++){x+=a[i++];z+=a[i++];p.push([x/2,z/2])}out.push({c,p})}return out}

const realSrc=id=>REAL_SRC.find(c=>c.id===id)||null;
const realPars=(id,n)=>realSrc(id).par.slice(0,n);

/* one course, decoded once: map polygons, hole lines, a 1 m surface map, the height grid and its trees.
   Built under CV's maths whoever asks first, so the page and the checking worker always agree */
const REAL_C=new Map();
function realCourse(id){if(REAL_C.has(id))return REAL_C.get(id);const src=realSrc(id);if(!src)return null;
  const C=withMath(CV,()=>{const P=realInts(src.poly),L=realInts(src.holes),polys=realPaths(P,1,P[0],true);
    const C={src,polys,holes:realPaths(L,1,L[0],false).map(h=>h.p),dem:realDem(src.dem)};C.map=realMap(src,polys);C.trees=realTrees(C,id);return C});
  REAL_C.set(id,C);return C}

/* heights: deltas of quarter metres above the course's lowest point */
function realDem(d){const q=realInts(d.d),h=new Float64Array(q.length);let v=0;for(let i=0;i<q.length;i++){v+=q[i];h[i]=d.lo+v/4}return Object.assign({h},d)}

/* bilinear ground height in course metres (x east, z south); off the grid it holds the edge */
function realHeight(C,x,z){const D=C.dem,fx=clamp((x-D.x0)/D.step,0,D.cols-1.000001),fz=clamp((z-D.z0)/D.step,0,D.rows-1.000001),i=fx|0,j=fz|0,u=fx-i,v=fz-j,k=j*D.cols+i,h=D.h;
  return(h[k]*(1-u)+h[k+1]*u)*(1-v)+(h[k+D.cols]*(1-u)+h[k+D.cols+1]*u)*v}

/* the 1 m surface map: each polygon filled by even-odd scanline in REAL_PAINT order, then a fringe collar round every green */
function realMap(src,polys){const[x0,z0,x1,z1]=src.box,w=x1-x0,h=z1-z0,m=new Uint8Array(w*h).fill(1),xs=[];
  const fill=(p,paint)=>{let lo=1e9,hi=-1e9;for(const q of p){if(q[1]<lo)lo=q[1];if(q[1]>hi)hi=q[1]}
    for(let j=Math.max(0,Math.ceil(lo-z0-.5));j<=Math.min(h-1,Math.floor(hi-z0-.5));j++){const z=z0+j+.5;xs.length=0;
      for(let a=0,b=p.length-1;a<p.length;b=a++){const A=p[a],B=p[b];if((A[1]>z)!==(B[1]>z))xs.push(A[0]+(z-A[1])/(B[1]-A[1])*(B[0]-A[0]))}
      xs.sort((a,b)=>a-b);for(let q=0;q+1<xs.length;q+=2)for(let i=Math.max(0,Math.ceil(xs[q]-x0-.5));i<=Math.min(w-1,Math.floor(xs[q+1]-x0-.5));i++)paint(j*w+i)}};
  for(const[cls,code]of REAL_PAINT)for(const p of polys)if(p.c===cls)fill(p.p,code>=REAL_WOOD?k=>{m[k]|=code}:k=>{m[k]=(m[k]&(REAL_WOOD|REAL_HOUSE))|code});
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){if((m[j*w+i]&15)!==4)continue;
    for(let b=Math.max(0,j-2);b<=Math.min(h-1,j+2);b++)for(let a=Math.max(0,i-2);a<=Math.min(w-1,i+2);a++){const k=b*w+a,c=m[k]&15;if(c<=2)m[k]=(m[k]&~15)|3}}
  return{x0,z0,w,h,m}}

/* surface code at course metres (outside the map: deep rough) */
function realSurf(C,x,z){const M=C.map,i=Math.floor(x-M.x0),j=Math.floor(z-M.z0);return i<0||j<0||i>=M.w||j>=M.h?1:M.m[j*M.w+i]}

/* a hole's frame: tee at (0,0), the first leg along +z. Same shape as courseHole's, so toWorld/fromWorld work on it */
function realFrame(id,i){const L=realCourse(id).holes[i],t=L[0],a=L[1];return withMath(CV,()=>{const h=MM.atan2(a[0]-t[0],a[1]-t[1]);return{ox:t[0],oz:t[1],h,c:MM.cos(h),s:MM.sin(h)}})}
const realToCourse=(F,x,z)=>[F.ox+x*F.c+z*F.s,F.oz-x*F.s+z*F.c];
const realToLocal=(F,x,z)=>{const dx=x-F.ox,dz=z-F.oz;return[dx*F.c-dz*F.s,dx*F.s+dz*F.c]};

/* every tree on the course, placed once so neighbouring holes share them: woods are thick, the rough between holes is
   lightly treed, and nothing grows near a playing surface or across a hole's line. Every cell rolls its dice so the list never shifts */
function realTrees(C,id){const R=mulberry32(thash(id,4401)),N=makeNoise(mulberry32(thash(id,4402))),M=C.map,out=[],near=realNearPlay(C);
  const lines=[];for(const L of C.holes)for(let a=0;a+1<L.length;a++)lines.push([L[a],L[a+1]]);
  for(let z=M.z0+REAL_TREE_STEP/2;z<M.z0+M.h;z+=REAL_TREE_STEP)for(let x=M.x0+REAL_TREE_STEP/2;x<M.x0+M.w;x+=REAL_TREE_STEP){
    const px=x+(R()-.5)*REAL_TREE_STEP*.8,pz=z+(R()-.5)*REAL_TREE_STEP*.8,u=R(),k=R(),s=realSurf(C,px,pz);
    if((s&15)>1||s&REAL_HOUSE||near(px,pz))continue;
    const p=s&REAL_WOOD?.6:((s&15)===0?.22:.06)*clamp(.35+N.n2(px*.011,pz*.011),0,1);if(u>=p)continue;
    if(lines.some(([a,b])=>realSegDist(px,pz,a[0],a[1],b[0],b[1])<REAL_TREE_LINE))continue;
    out.push({x:px,z:pz,kind:k<.7?'oak':'pine',seed:thash(id,Math.round(px*2),Math.round(pz*2))})}
  return out}

/* true within REAL_TREE_CLEAR of fairway, fringe, green, tee, sand or water: a 4 m mask grown outwards */
function realNearPlay(C){const M=C.map,S=4,w=Math.ceil(M.w/S),h=Math.ceil(M.h/S),g=new Uint8Array(w*h);
  for(let j=0;j<M.h;j++)for(let i=0;i<M.w;i++){const c=M.m[j*M.w+i]&15;if(c>=2)g[((j/S)|0)*w+((i/S)|0)]=1}
  const r=Math.ceil(REAL_TREE_CLEAR/S),out=new Uint8Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(!g[j*w+i])continue;for(let b=Math.max(0,j-r);b<=Math.min(h-1,j+r);b++)for(let a=Math.max(0,i-r);a<=Math.min(w-1,i+r);a++)if((a-i)*(a-i)+(b-j)*(b-j)<=r*r)out[b*w+a]=1}
  return(x,z)=>{const i=Math.floor((x-M.x0)/S),j=Math.floor((z-M.z0)/S);return i>=0&&j>=0&&i<w&&j<h&&out[j*w+i]===1}}

function realSegDist(px,pz,ax,az,bx,bz){const ex=bx-ax,ez=bz-az,l2=ex*ex+ez*ez||1,u=clamp(((px-ax)*ex+(pz-az)*ez)/l2,0,1),dx=px-ax-ex*u,dz=pz-az-ez*u;return Math.sqrt(dx*dx+dz*dz)}

/* the hole's line resampled every 4 m as the game's centreline: {x,z,t,h} */
function realCentre(line){const seg=[];let T=0;
  for(let a=0;a+1<line.length;a++){const p=line[a],q=line[a+1],dx=q[0]-p[0],dz=q[1]-p[1],L=Math.sqrt(dx*dx+dz*dz);seg.push({p,q,t0:T,L,h:MM.atan2(dx,dz)});T+=L}
  const C=[],n=Math.ceil(T/4);let a=0;
  for(let i=0;i<=n;i++){const t=Math.min(i*4,T);while(a<seg.length-1&&seg[a].t0+seg[a].L<t)a++;const s=seg[a],u=s.L?(t-s.t0)/s.L:0;C.push({x:s.p[0]+(s.q[0]-s.p[0])*u,z:s.p[1]+(s.q[1]-s.p[1])*u,t,h:s.h})}
  return C}

/* the hole's grid box: its line plus a margin, shrunk until it fits the cell budget */
function realGrid(line){let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const[x,z]of line){x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z)}
  let m=REAL_MARGIN[0];while(m>REAL_MARGIN[1]&&Math.ceil((x1-x0+2*m)/CS)*Math.ceil((z1-z0+2*m)/CS)>REAL_CELLS)m-=4;
  return{ox:Math.floor(x0-m),oz:Math.floor(z0-m),cols:Math.ceil((x1-x0+2*m)/CS),rows:Math.ceil((z1-z0+2*m)/CS)}}

/* the hole itself: a W with the same fields genHole_ builds, from the real map */
function realHole(seed,idx,par,cv,setup,cond){const id=cond.real,C=realCourse(id),F=realFrame(id,idx),BI=BIOMES[REAL_BIO];
  const line=C.holes[idx].map(p=>realToLocal(F,p[0],p[1])),Cl=realCentre(line),len=Cl[Cl.length-1].t,teeH=realHeight(C,F.ox,F.oz);
  const{ox,oz,cols,rows}=realGrid(line),s=cols+1,nv=s*(rows+1),nc=cols*rows,H=new Float32Array(nv),ty=new Uint8Array(nc),sea=new Uint8Array(nc);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const[x,z]=realToCourse(F,ox+i*CS,oz+j*CS);H[j*s+i]=realHeight(C,x,z)-teeH}
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i,lx=ox+(i+.5)*CS,lz=oz+(j+.5)*CS,[x,z]=realToCourse(F,lx,lz),m=realSurf(C,x,z)&15;
    ty[c]=m===REAL_SEA?7:m;sea[c]=m===REAL_SEA?1:0;if(Math.abs(lx)<2.4&&Math.abs(lz)<2.4&&ty[c]!==7)ty[c]=5}
  const cellAt=(x,z)=>{const i=Math.floor((x-ox)/CS),j=Math.floor((z-oz)/CS);return i<0||j<0||i>=cols||j>=rows?-1:j*cols+i};
  realShape(H,ty,cols,rows);
  const{PD,pond}=realWater(H,ty,sea,cols,rows,ox,oz,Cl,cellAt,teeH);
  const diag=new Uint8Array(nc),tC=new Float32Array(nc),dC=new Float32Array(nc);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const c=j*cols+i,k=j*s+i,x=ox+(i+.5)*CS,z=oz+(j+.5)*CS;diag[c]=Math.abs(H[k]-H[k+s+1])<=Math.abs(H[k+1]-H[k+s])?0:1;
    let bd=1e9,bt=0;for(let a=0;a+1<line.length;a++){const A=line[a],B=line[a+1],ex=B[0]-A[0],ez=B[1]-A[1],l2=ex*ex+ez*ez||1,u=clamp(((x-A[0])*ex+(z-A[1])*ez)/l2,0,1),dx=x-A[0]-ex*u,dz=z-A[1]-ez*u,d=Math.sqrt(dx*dx+dz*dz);
      if(d<bd){bd=d;let t0=0;for(let b=0;b<a;b++){const P=line[b],Q=line[b+1];t0+=Math.sqrt((Q[0]-P[0])*(Q[0]-P[0])+(Q[1]-P[1])*(Q[1]-P[1]))}bt=t0+Math.sqrt(l2)*u}}
    tC[c]=bt;dC[c]=bd}
  const hw=realWidths(Cl,ty,cellAt,par),G=line[line.length-1],gh=Cl[Cl.length-1].h;
  let gn=0;for(let c=0;c<nc;c++){if(ty[c]!==4)continue;const x=ox+(c%cols+.5)*CS,z=oz+((c/cols|0)+.5)*CS;if((x-G[0])*(x-G[0])+(z-G[1])*(z-G[1])<1600)gn++}
  const gR=Math.max(6,Math.sqrt(gn*CS*CS/Math.PI)),N=makeNoise(mulberry32(thash(id,idx+4500)));
  const ed=(e,x,z)=>{if(e.cr===undefined){e.cr=MM.cos(e.rot);e.sr=MM.sin(e.rot)}const dx=x-e.x,dz=z-e.z,u=(dx*e.cr+dz*e.sr)/e.rx,v=(dz*e.cr-dx*e.sr)/e.rz;return Math.sqrt(u*u+v*v)};
  const src=C.src,W={seed,idx,par:src.par[idx],cv,bio:REAL_BIO,len,cols,rows,ox,oz,H,ty,pond,diag,tC,dC,levels:PD.map(p=>p.level),pin:{x:G[0],z:G[1],y:0},green:{x:G[0],z:G[1],r:gR,h:gh},
    C:Cl,hw,hb:(x,z)=>{const[cx,cz]=realToCourse(F,x,z);return realHeight(C,cx,cz)-teeH},N,BK:[],PD,ed,arch:{n:'Par '+src.par[idx]},trees:[],tgrid:new Map(),meshes:{},crest:null,post:null,gs:null,twin:null,obs:[],bridge:false,
    rk:firmArr(BI.roll,cv),bk:firmArr(BI.bf,cv),pal:BI.pal,fog:BI.fog,sky:BI.sky,hillCols:BI.hillCols,ringCol:BI.ringCol,waterCol:BI.waterCol,real:id,frame:F};
  cond4(W,BI,cond,null,{BK:[]});W.architect=src.town;
  realPins(W,setup,id,idx);
  const P=coursePlan(seed,cv),w0=P.wind,wl={x:w0.x*F.c-w0.z*F.s,z:w0.x*F.s+w0.z*F.c,s:w0.s,a:0};wl.a=MM.atan2(wl.x,wl.z);
  W.wind=cond.twist===2?gale5(wl):wl;W.swell=P.swell;W.phase=thash(seed,idx+900)/4294967296*TAU;W.rain=!!P.wea.rain;W.marks=[];
  {let lo=1e9;for(let q=0;q<H.length;q+=7)if(H[q]<lo)lo=H[q];W.hlow=lo}
  W.laneD=null;W.hist={name:src.name,year:src.est,line:src.note||src.town+' · the real course, from the map',v:0};
  realPlant(W,C,F,BI);return W}

/* sand dished in, tees raised and flat, greens eased toward a gentle tilt: the map knows where, the terrain model is too coarse to */
function realShape(H,ty,cols,rows){const s=cols+1,touch=(k,T)=>{const j=(k/s)|0,i=k%s;let n=0;for(const[a,b]of[[i-1,j-1],[i,j-1],[i-1,j],[i,j]])if(a>=0&&b>=0&&a<cols&&b<rows&&ty[b*cols+a]===T)n++;return n};
  const sand=new Float32Array(H.length);for(let k=0;k<H.length;k++)sand[k]=touch(k,6)/4;for(let k=0;k<H.length;k++)H[k]-=REAL_SAND*sand[k];
  for(const T of[5,4]){/* each tee and green: one flood-filled patch at a time */
    const seen=new Uint8Array(cols*rows);for(let c0=0;c0<cols*rows;c0++){if(ty[c0]!==T||seen[c0])continue;const cells=[c0];seen[c0]=1;
      for(let q=0;q<cells.length;q++){const c=cells[q],i=c%cols,j=(c/cols)|0;for(const[a,b]of[[i+1,j],[i-1,j],[i,j+1],[i,j-1]])if(a>=0&&b>=0&&a<cols&&b<rows&&ty[b*cols+a]===T&&!seen[b*cols+a]){seen[b*cols+a]=1;cells.push(b*cols+a)}}
      const vs=new Set();for(const c of cells){const k=((c/cols)|0)*s+c%cols;vs.add(k);vs.add(k+1);vs.add(k+s);vs.add(k+s+1)}let m=0;for(const k of vs)m+=H[k];m/=vs.size;
      for(const k of vs)H[k]=T===5?m+REAL_TEE_RISE:m+(H[k]-m)*REAL_GREEN_TILT}}}

/* lakes and the river: each patch of water cells is a pond the rules know (an ellipse for relief, a level below its lowest bank) */
function realWater(H,ty,sea,cols,rows,ox,oz,Cl,cellAt,teeH){const s=cols+1,nc=cols*rows,pond=new Int8Array(nc).fill(-1),PD=[];
  for(let c0=0;c0<nc;c0++){if(ty[c0]!==7||pond[c0]>=0||PD.length>=120)continue;const id=PD.length,cells=[c0];pond[c0]=id;
    for(let q=0;q<cells.length;q++){const c=cells[q],i=c%cols,j=(c/cols)|0;for(const[a,b]of[[i+1,j],[i-1,j],[i,j+1],[i,j-1]]){const n=b*cols+a;if(a>=0&&b>=0&&a<cols&&b<rows&&ty[n]===7&&pond[n]<0){pond[n]=id;cells.push(n)}}}
    let rim=1e9,isSea=false,mx=0,mz=0;for(const c of cells){const i=c%cols,j=(c/cols)|0,k=j*s+i;isSea=isSea||sea[c]===1;mx+=ox+(i+.5)*CS;mz+=oz+(j+.5)*CS;
      for(const[a,b]of[[i+1,j],[i-1,j],[i,j+1],[i,j-1]])if(a>=0&&b>=0&&a<cols&&b<rows&&ty[b*cols+a]!==7)rim=Math.min(rim,H[k],H[k+1],H[k+s],H[k+s+1])}
    mx/=cells.length;mz/=cells.length;let level=rim<1e8?rim-.25:-teeH;if(isSea)level=Math.min(level,-teeH);
    let sxx=0,szz=0,sxz=0;for(const c of cells){const dx=ox+(c%cols+.5)*CS-mx,dz=oz+(((c/cols)|0)+.5)*CS-mz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz}sxx/=cells.length;szz/=cells.length;sxz/=cells.length;
    const mid=(sxx+szz)/2,dev=Math.sqrt((sxx-szz)*(sxx-szz)/4+sxz*sxz),crosses=Cl.some(p=>{const c=cellAt(p.x,p.z);return c>=0&&pond[c]===id});
    PD.push({x:mx,z:mz,rx:2*Math.sqrt(mid+dev)+CS,rz:2*Math.sqrt(Math.max(0,mid-dev))+CS,rot:.5*MM.atan2(2*sxz,sxx-szz),depth:REAL_WATER_DEPTH,level,pen:!isSea&&crosses?'Y':'R',sea:isSea});
    for(const c of cells){const k=((c/cols)|0)*s+c%cols;for(const v of[k,k+1,k+s,k+s+1])H[v]=Math.min(H[v],level-.15)}
    for(const c of cells){const i=c%cols,j=(c/cols)|0,k=j*s+i;let inner=true;for(let b=j-1;b<=j+1&&inner;b++)for(let a=i-1;a<=i+1;a++)if(a<0||b<0||a>=cols||b>=rows||ty[b*cols+a]!==7){inner=false;break}if(inner)H[k]=Math.min(H[k],level-REAL_WATER_DEPTH)}}
  /* the bank cells know their water's level too, as an invented hole's do */
  for(let c=0;c<nc;c++){if(ty[c]===7)continue;const i=c%cols,j=(c/cols)|0;for(const[a,b]of[[i+1,j],[i-1,j],[i,j+1],[i,j-1]])if(a>=0&&b>=0&&a<cols&&b<rows&&ty[b*cols+a]===7){pond[c]=pond[b*cols+a];break}}
  return{PD,pond}}

/* fairway half-width along the line, for wear and the caddie; carries and par 3s fall back to the nearest measured width */
function realWidths(Cl,ty,cellAt,par){const HW=Cl.map(p=>{const at=o=>{const c=cellAt(p.x+MM.cos(p.h)*o,p.z-MM.sin(p.h)*o);return c>=0&&ty[c]===2};if(!at(0))return 0;let l=1,r=1;while(l<35&&at(-l))l++;while(r<35&&at(r))r++;return(l+r)/2});
  const fall=par===3?11:15;for(let i=0;i<HW.length;i++)if(!HW[i]){let b=0;for(let d=1;d<HW.length&&!b;d++)b=HW[i-d]||HW[i+d]||0;HW[i]=b||fall}
  return t=>HW[clamp((t/4)|0,0,HW.length-1)]}

/* four pins: centre, front, one side and back, each kept only if it sits on the green as an invented hole's must */
function realPins(W,setup,id,idx){const g=W.green,RP=mulberry32(thash(id,idx+500)),side=RP()<.5?1:-1,h=g.h,mk=(a,k)=>({x:g.x+MM.sin(a)*g.r*k,z:g.z+MM.cos(a)*g.r*k,y:0});
  const pins=[mk(RP()*TAU,RP()*PINS.c*.5),mk(h+Math.PI,PINS.t*.8),mk(h+side*Math.PI/2,PINS.t*.8),mk(h,PINS.t*.8)];
  const ok=p=>{terrainAt(W,p.x,p.z);if(TQ.ty!==4||TQ.ny<MM.cos(PINS.slope))return false;for(let a=0;a<TAU-.01;a+=TAU/6){terrainAt(W,p.x+MM.sin(a)*PINS.edge,p.z+MM.cos(a)*PINS.edge);if(TQ.ty!==4&&TQ.ty!==3)return false}return true};
  W.pins=pins.map((p,i)=>{const q=i&&!ok(p)?{x:pins[0].x,z:pins[0].z,y:0}:{x:p.x,z:p.z,y:0};terrainAt(W,q.x,q.z);q.y=TQ.h;return q});
  W.setup=clamp(setup|0,0,3);W.pin=W.pins[W.setup];W.flagCol=[[.95,.95,.95],[.95,.8,.15],[.2,.45,.95],[.92,.16,.16]][W.setup]}

/* the course's trees that stand on this hole's grid, each grown from its own seed so it looks the same from every hole */
function realPlant(W,C,F,BI){for(const t of C.trees){const[x,z]=realToLocal(F,t.x,t.z);if(x<W.ox+4||z<W.oz+4||x>W.ox+W.cols*CS-4||z>W.oz+W.rows*CS-4)continue;
  terrainAt(W,x,z);if(TQ.ty>1)continue;const p=makeProp(t.kind,x,z,TQ.h-.2,mulberry32(t.seed),BI);W.trees.push(p);const key=(((x-W.ox)/8)|0)+','+(((z-W.oz)/8)|0);(W.tgrid.get(key)||W.tgrid.set(key,[]).get(key)).push(p)}}

/* ---- drawing only: the scorecard's shot maps and the property map ---- */
const REAL_PLANS=new Map();
/* a real hole's shape in the form the shot maps read from holePlan, cut from the hole itself */
function realPlan(h){const key=holeKey(S.seed,h,S.cv,S.setup,S);if(!REAL_PLANS.has(key)){if(REAL_PLANS.size>24)REAL_PLANS.clear();const W=genHole(S.seed,h,S.pars[h],S.cv,S.setup,S);
  REAL_PLANS.set(key,{C:W.C,hw:W.hw,g:{x:W.green.x,z:W.green.z},gR:W.green.r,pin:W.pin,PD:W.PD.filter(p=>!p.sea),BK:[]})}return REAL_PLANS.get(key)}

const REAL_MAP_FILL=[null,'rough','fairway','green','tee','bunker','water','water','wood','house'];
/* the property map for a real course: the map's own shapes, north up, every hole's line and number, the ball and the wind */
function drawRealMap(){const C=realCourse(S.real),src=C.src,cvs=$('pmapC'),hole=C.holes.slice(0,S.n),pal=W.pal||{};
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of C.polys)if(p.c===0)for(const[x,z]of p.p){x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z)}x0-=40;x1+=40;z0-=40;z1+=40;
  const Wd=Math.min(innerWidth*.94-ybWidth(),1100),Hd=Math.min(innerHeight*.78,760),sc=Math.min(Wd/(x1-x0),Hd/(z1-z0)),w=Math.ceil((x1-x0)*sc),h=Math.ceil((z1-z0)*sc),d=Math.min(devicePixelRatio||1,2);
  cvs.width=w*d;cvs.height=h*d;cvs.style.width=w+'px';cvs.style.height=h+'px';const g=cvs.getContext('2d');g.setTransform(d,0,0,d,0,0);
  const X=x=>(x-x0)*sc,Z=z=>(z-z0)*sc,rgb=t=>{const c=pal[t]||SURF[t].col;return`rgb(${c[0]*255|0},${c[1]*255|0},${c[2]*255|0})`};
  const fill={rough:rgb(0),fairway:rgb(2),green:rgb(4),tee:rgb(5),bunker:rgb(6),water:TK('map-water',.95),wood:'rgba(20,60,25,.35)',house:'rgba(120,115,105,.85)'};
  g.fillStyle=rgb(1);g.fillRect(0,0,w,h);
  for(const p of C.polys){const f=p.c===0?fill.rough:fill[REAL_MAP_FILL[p.c]];if(!f)continue;g.fillStyle=f;g.beginPath();p.p.forEach(([x,z],k)=>k?g.lineTo(X(x),Z(z)):g.moveTo(X(x),Z(z)));g.closePath();g.fill()}
  hole.forEach((L,i)=>{const cur=i===S.hi;g.lineCap='round';g.lineJoin='round';g.strokeStyle=cur?TK('gold300'):TK('white',.55);g.lineWidth=cur?2.5:1.5;g.setLineDash(cur?[]:[4,4]);
    g.beginPath();L.forEach(([x,z],k)=>k?g.lineTo(X(x),Z(z)):g.moveTo(X(x),Z(z)));g.stroke();g.setLineDash([]);
    const[tx,tz]=L[0];g.fillStyle=cur?TK('gold300'):TK('white',.9);g.font='bold '+Math.max(11,Math.min(16,3.2*sc*4))+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
    g.lineWidth=3;g.strokeStyle=TK('black',.5);g.strokeText(String(i+1),X(tx),Z(tz)-10);g.fillText(String(i+1),X(tx),Z(tz)-10)});
  const[bx,bz]=realToCourse(W.frame,PB.x,PB.z);g.fillStyle=TK('white');g.beginPath();g.arc(X(bx),Z(bz),3.5,0,TAU);g.fill();g.strokeStyle=TK('black');g.lineWidth=1;g.stroke();
  const P=coursePlan(S.seed,S.cv),wd=P.wind;if(wd.s>.3){g.save();g.translate(w-34,34);g.rotate(Math.atan2(wd.x,-wd.z));g.fillStyle=TK('white',.9);g.beginPath();g.moveTo(0,-16);g.lineTo(9,4);g.lineTo(3,4);g.lineTo(3,16);g.lineTo(-3,16);g.lineTo(-3,4);g.lineTo(-9,4);g.closePath();g.fill();g.restore()}
  g.fillStyle=TK('white',.8);g.font='11px system-ui,sans-serif';g.textAlign='left';g.fillText('N ↑',10,14);g.font='10px system-ui,sans-serif';g.fillStyle=TK('white',.65);g.fillText('© OpenStreetMap contributors'+(src.note?' · '+src.note:''),10,h-8);
  const from=['N','NE','E','SE','S','SW','W','NW'][Math.round(((Math.atan2(-wd.x,wd.z)%TAU+TAU)%TAU)/(Math.PI/4))%8];
  $('pmapT').textContent=src.name+' · '+SEASONS[W.season].n+' · '+P.wea.n+(wd.s>.3?' · wind '+Math.round(wd.s*3.6)+' km/h from '+from:' · calm')+(W.clock!=null?' · '+String(Math.floor(W.clock)).padStart(2,'0')+':'+String(Math.round((W.clock%1)*60)).padStart(2,'0'):'')+' · hole '+(S.hi+1)+' of '+S.n+' · V to close'}

/* Courses → Play: a real course plays as a casual round; the Course # box (or Today's) deals the day's weather and pins */
function realGo(id,n){const seed=Math.max(1,(+$('seed').value|0)||1);
  VL.play('casual',{seed,box:seed,setup:setupFor(seed),season:S.seasonPick>=0?S.seasonPick:courseSeason(seed),wear:S.condPick|0,casual:S.casualOn?1:0,kind:0,real:id,fmt:{format:0,twist:0},n,ghost:null,opp:oppArg()})}
$('btnRealC18').onclick=()=>realGo(1,18);$('btnRealC9').onclick=()=>realGo(1,9);$('btnRealK18').onclick=()=>realGo(2,18);$('btnRealK9').onclick=()=>realGo(2,9);
if(!realSrc(2))for(const b of['btnRealK18','btnRealK9'])$(b).style.display='none';   /* hidden until its data is built */

/* the rest of a real round's code, after the island header's kind 7 and course id: it reads as any v10 round */
function realDecode(r,seed,n,hcp,V10,id,g9,GF){if(!V10||!realSrc(id+1)||(n!==9&&n!==18))return null;const d=decodeRound6(r,seed,n,hcp,CV,7);if(!d)return null;
  d.kind=0;d.real=id+1;d.islDay=0;d.ver=g9?9:8;d.v10=true;if(GF)d.golfer=GF;return d}

VL.feature({id:'courses.real',kind:'sim',deps:['core.sim'],f:[]});
