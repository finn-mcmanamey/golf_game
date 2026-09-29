/* ===== Q-05 flowing slope grid: with the putter up on the green or the fringe, dots GRID_S apart cover the green and GRID_PAD beyond it and drift downhill at SLOPE_SPEED per 1% of slope, coloured by band; the slope and its fall sit in numbers at the ball and at the hole. Drawing only ===== */
const GRID_S=1,GRID_PAD=2,SLOPE_SPEED=.25,GRID_VMAX=2,GRID_MAX=2500,GRID_FADE=.3,GRID_DOT=[.055,.012,.02],GRID_FLAT=.3,
  SLOPE_BANDS=[[1,[1,1,1]],[2,[1,.86,.25]],[4,[1,.52,.12]],[Infinity,[.92,.18,.12]]];
const GRID={key:'',n:0,a:0,d:null,buf:null,f:null,u8:null,last:0,lab:false};
const gridKey=()=>W.seed+'/'+W.idx+'/'+W.cv+'/'+W.pin.x.toFixed(2)+','+W.pin.z.toFixed(2);
const gridBand=p=>{let b=0;while(p>=SLOPE_BANDS[b][0])b++;return b};
function gridOn(){if(!W||S.mode!=='aim'||S.ov||S.photo||S.replay||S.mapOpen||S.zoom||!curClub().putter)return false;terrainAt(W,PB.x,PB.z);return TQ.ty===4||TQ.ty===3}
/* a dot off the green is kept when the green is within GRID_PAD of it along either axis or a diagonal */
const gridNear=(x,z,seen,cellOf)=>{for(let k=0;k<8;k++){const a=k*Math.PI/4,c=cellOf(x+MM.sin(a)*GRID_PAD,z+MM.cos(a)*GRID_PAD);if(c>=0&&seen[c])return true}return false};
/* the green under the flag (and under the ball), grown by GRID_PAD; four dots per 2 m cell; nearest the flag first past GRID_MAX */
function gridBuild(){GRID.key=gridKey();GRID.n=0;const C=W.cols,R=W.rows,ty=W.ty,seen=new Uint8Array(C*R),q=[],cellOf=(x,z)=>{const i=Math.floor((x-W.ox)/CS),j=Math.floor((z-W.oz)/CS);return i<0||j<0||i>=C||j>=R?-1:j*C+i},
    add=e=>{if(e>=0&&ty[e]===4&&!seen[e]){seen[e]=1;q.push(e)}};
  add(cellOf(W.pin.x,W.pin.z));add(cellOf(PB.x,PB.z));
  for(let k=0;k<q.length;k++){const c=q[k],i=c%C,j=(c-i)/C;if(i>0)add(c-1);if(i<C-1)add(c+1);if(j>0)add(c-C);if(j<R-1)add(c+C)}
  const pr=Math.ceil(GRID_PAD/CS),pad=new Uint8Array(C*R),m=Math.round(CS/GRID_S),pts=[];
  for(const c of q){const i=c%C,j=(c-i)/C;for(let b=Math.max(0,j-pr);b<=Math.min(R-1,j+pr);b++)for(let a=Math.max(0,i-pr);a<=Math.min(C-1,i+pr);a++){const e=b*C+a;if(pad[e]||ty[e]===6||ty[e]===7)continue;pad[e]=1;
    for(let v=0;v<m;v++)for(let u=0;u<m;u++){const x=W.ox+a*CS+(u+.5)*GRID_S,z=W.oz+b*CS+(v+.5)*GRID_S;if(!seen[e]&&!gridNear(x,z,seen,cellOf))continue;pts.push([x,z,Math.hypot(x-W.pin.x,z-W.pin.z)])}}}
  if(pts.length>GRID_MAX){pts.sort((p,r)=>p[2]-r[2]);pts.length=GRID_MAX}
  const n=pts.length,d=GRID.d=new Float32Array(n*8),A=new ArrayBuffer(n*28);GRID.f=new Float32Array(A);GRID.u8=new Uint8Array(A);if(!GRID.buf)GRID.buf=gl.createBuffer();
  pts.forEach(([x,z],k)=>{terrainAt(W,x,z);const g=Math.hypot(TQ.nx,TQ.nz),s=g/TQ.ny,o=k*8,c=SLOPE_BANDS[gridBand(100*s)][1],p=k*28+24;
    d[o]=x;d[o+1]=TQ.h+GRID_DOT[2];d[o+2]=z;d[o+3]=g>1e-9?TQ.nx/g:0;d[o+4]=g>1e-9?TQ.nz/g:0;d[o+5]=-s;d[o+6]=Math.min(GRID_VMAX,SLOPE_SPEED*100*s)/GRID_S;
    GRID.u8[p]=c[0]*255;GRID.u8[p+1]=c[1]*255;GRID.u8[p+2]=c[2]*255;GRID.u8[p+3]=255});
  GRID.n=n}
/* each frame: fade toward on or off; every dot slides its GRID_S cycle downhill (no faster than GRID_VMAX: banks off the putting surface would flicker) and swells and shrinks with it, so the grid never piles up; one instanced draw */
function gridDraw(){const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-GRID.last)/1000)),on=gridOn();GRID.last=now;GRID.a=clamp(GRID.a+(on?dt:-dt)/GRID_FADE,0,1);
  if(GRID.a<=0||!PI){gridHide();return}if(gridKey()!==GRID.key)gridBuild();const n=GRID.n;if(!n){gridHide();return}
  const d=GRID.d,F=GRID.f,t=S.t,sz=GRID_DOT[0]*GRID.a,sy=GRID_DOT[1];
  for(let k=0;k<n;k++){const o=k*8;let u=.5+t*d[o+6];u-=Math.floor(u);const off=(u-.5)*GRID_S,w=(2*u-1)*(2*u-1),f=sz*(1-w*w),p=k*7;
    F[p]=d[o]+d[o+3]*off;F[p+1]=d[o+1]+d[o+5]*off;F[p+2]=d[o+2]+d[o+4]*off;F[p+3]=F[p+5]=f;F[p+4]=sy}
  gl.bindBuffer(gl.ARRAY_BUFFER,GRID.buf);gl.bufferData(gl.ARRAY_BUFFER,GRID.u8.subarray(0,n*28),gl.DYNAMIC_DRAW);useProg(PI,AI);gl.uniform3f(PI.u.uOff,0,0,0);gl.uniform1f(PI.u.uFlat,1);drawBoxes({inst:true,buf:GRID.buf,n});gl.uniform1f(PI.u.uFlat,0);
  gridLabel('slB',PB.x,PB.z,0);gridLabel('slH',W.pin.x,W.pin.z,1);GRID.lab=true}
/* a label: the slope in % and an arrow along the fall as it looks on screen; under the ball, beside the hole */
function gridLabel(id,x,z,hole){let el=document.getElementById(id);if(!el){el=document.createElement('div');el.id=id;el.className='slab';el.innerHTML='<i><svg viewBox="0 0 12 12" width="12" height="12"><path d="M1 6h8M6 2.5 9.5 6 6 9.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg></i><span></span>';if(typeof cv!=='undefined'&&cv.parentNode)cv.insertAdjacentElement('afterend',el);else document.body.appendChild(el)}
  terrainAt(W,x,z);const g=Math.hypot(TQ.nx,TQ.nz),pct=100*g/TQ.ny,y=TQ.h+.05,m=VP.m,Wd=innerWidth,Hd=innerHeight,
    pr=(X,Y,Z)=>{const w=m[3]*X+m[7]*Y+m[11]*Z+m[15];return w<=.05?null:[((m[0]*X+m[4]*Y+m[8]*Z+m[12])/w*.5+.5)*Wd,(.5-(m[1]*X+m[5]*Y+m[9]*Z+m[13])/w*.5)*Hd]},p=pr(x,y,z);
  if(!p||p[0]<-40||p[0]>Wd+40||p[1]<-40||p[1]>Hd+40){el.style.display='none';return}
  const q=pct>=GRID_FLAT?pr(x+TQ.nx/g,y-g/TQ.ny,z+TQ.nz/g):null,txt=pct<GRID_FLAT?'flat':pct.toFixed(1)+'%',s=el.lastChild,i=el.firstChild,c=SLOPE_BANDS[gridBand(pct)][1];
  if(s.textContent!==txt)s.textContent=txt;i.style.display=q?'':'none';if(q)i.style.transform='rotate('+(MM.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI).toFixed(0)+'deg)';
  el.style.color='rgb('+(c[0]*255|0)+','+(c[1]*255|0)+','+(c[2]*255|0)+')';el.style.opacity=GRID.a.toFixed(2);el.style.transform=hole?'translate('+(p[0]+14).toFixed(0)+'px,'+(p[1]-10).toFixed(0)+'px)':'translate('+p[0].toFixed(0)+'px,'+(p[1]+16).toFixed(0)+'px) translateX(-50%)';el.style.display='flex'}
function gridHide(){if(!GRID.lab)return;GRID.lab=false;for(const id of['slB','slH']){const el=document.getElementById(id);if(el)el.style.display='none'}}
