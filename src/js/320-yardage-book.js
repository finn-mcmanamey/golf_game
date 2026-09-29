/* ===== Q-06 yardage book: in the overview, a page for the current hole — each bunker and penalty area as front / carry in metres from the tee and from the ball, along the line through it; the green's front, middle and back along the line to the flag; the bag's reach rings round the ball on the page's drawing. Numbers and circles only, never a flight. Drawing only ===== */
const YB_W=300,YB_LABEL=16,YB_ROWS=6,YB_LAT=55,YB_BEYOND=30,YB_STEP=.5,YB_GAP=3,YB_MIN=3,YB_FAR=250;
const YB={key:'',haz:[],lab:null,ct:[0]};
const ybOn=()=>!!W&&S.cv>=2&&!!W.C&&!!mapImg;
const ybWidth=()=>ybOn()?Math.min(YB_W,innerWidth*.4)+12:0;
const ybCell=(x,z)=>{const i=Math.floor((x-W.ox)/CS),j=Math.floor((z-W.oz)/CS);return i<0||j<0||i>=W.cols||j>=W.rows?-1:j*W.cols+i};
/* where a point sits along the hole's centreline, how far off it, and on which side (positive: left, looking down the hole) */
function ybAlong(x,z){const C=W.C,T=YB.ct;let best=1e18,bt=0,bs=0;for(let i=0;i<C.length-1;i++){const a=C[i],b=C[i+1],ex=b.x-a.x,ez=b.z-a.z,l2=ex*ex+ez*ez||1,u=clamp(((x-a.x)*ex+(z-a.z)*ez)/l2,0,1),dx=x-a.x-ex*u,dz=z-a.z-ez*u,d=dx*dx+dz*dz;
  if(d<best){best=d;bt=T[i]+(T[i+1]-T[i])*u;bs=(dx*ez-dz*ex)/Math.sqrt(l2)}}return{t:bt,d:Math.sqrt(best),s:bs}}
/* every bunker and every penalty area on the hole: connected sand or water cells, each with its middle, the cell nearest the line of play, and its colour */
function ybHazards(){const C=W.cols,R=W.rows,ty=W.ty,lab=new Int32Array(C*R).fill(-1),H=[];
  for(let c0=0;c0<C*R;c0++){const t=ty[c0];if(t!==6&&t!==7||lab[c0]>=0)continue;const id=H.length,q=[c0];lab[c0]=id;let sx=0,sz=0;
    for(let k=0;k<q.length;k++){const c=q[k],i=c%C,j=(c-i)/C;sx+=i;sz+=j;if(i>0&&lab[c-1]<0&&ty[c-1]===t){lab[c-1]=id;q.push(c-1)}if(i<C-1&&lab[c+1]<0&&ty[c+1]===t){lab[c+1]=id;q.push(c+1)}if(j>0&&lab[c-C]<0&&ty[c-C]===t){lab[c-C]=id;q.push(c-C)}if(j<R-1&&lab[c+C]<0&&ty[c+C]===t){lab[c+C]=id;q.push(c+C)}}
    const n=q.length,h={id,t,n,cells:q,x:W.ox+(sx/n+.5)*CS,z:W.oz+(sz/n+.5)*CS,pen:t===7?(W.pond[c0]>=0?pondPen(W,W.pond[c0]):'R'):null};H.push(h);if(n<YB_MIN)continue;
    let nd=1e9,nt=0,nx=h.x,nz=h.z;const st=Math.max(1,Math.ceil(n/1500));for(let k=0;k<n;k+=st){const c=q[k],i=c%C,j=(c-i)/C,x=W.ox+(i+.5)*CS,z=W.oz+(j+.5)*CS,a=ybAlong(x,z);if(a.d<nd){nd=a.d;nt=a.t;nx=x;nz=z}}
    const m=ybAlong(h.x,h.z),ax=m.d<=YB_LAT?h.x:nx,az=m.d<=YB_LAT?h.z:nz;Object.assign(h,{nd,nt,ax,az,side:ybAlong(ax,az).s})}
  YB.lab=lab;const out=H.filter(h=>h.n>=YB_MIN&&h.nd<YB_LAT);if(W.cv>=7)ybSyn7(out);return out}
/* front and carry from (ox,oz) along the line through the hazard's middle: the first run of its cells, gaps under YB_GAP bridged; a line that misses it (a crescent) falls back to its nearest and farthest cells */
function ybFC(ox,oz,h){if(h.syn)return h.fc(ox,oz);const dx=h.ax-ox,dz=h.az-oz,L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L;let f=-1,c=-1,gap=0;
  for(let s=0;s<=L+YB_FAR;s+=YB_STEP){if(YB.lab[ybCell(ox+ux*s,oz+uz*s)]===h.id){if(f<0)f=s;c=s;gap=0}else if(f>=0&&(gap+=YB_STEP)>YB_GAP)break}
  if(f<0){let a=1e9,b=0;for(const e of h.cells){const i=e%W.cols,j=(e-i)/W.cols,d=Math.hypot(W.ox+(i+.5)*CS-ox,W.oz+(j+.5)*CS-oz);a=Math.min(a,d);b=Math.max(b,d)}return[a,b]}
  return[f,gap>YB_GAP||c+YB_STEP<L+YB_FAR?c+YB_STEP:null]}
/* the green along the line to the flag: walk back from the flag to the front edge and on to the back edge */
function ybGreen(ox,oz){const px=W.pin.x,pz=W.pin.z,L=Math.hypot(px-ox,pz-oz);if(L<1)return null;const ux=(px-ox)/L,uz=(pz-oz)/L,T=(x,z)=>{terrainAt(W,x,z);return TQ.ty};if(T(px,pz)!==4)return[L,L,L];
  let f=0,b=0;while(f<L&&T(px-ux*(f+YB_STEP),pz-uz*(f+YB_STEP))===4)f+=YB_STEP;while(b<80&&T(px+ux*(b+YB_STEP),pz+uz*(b+YB_STEP))===4)b+=YB_STEP;return[L-f,L+(b-f)/2,L+b]}
/* the rows from one spot: a hazard counts when it lies ahead of the spot along the hole and short of the flag plus YB_BEYOND */
function ybFrom(ox,oz,H){const o=ybAlong(ox,oz),p=ybAlong(W.pin.x,W.pin.z),fx=W.pin.x-ox,fz=W.pin.z-oz,out=new Map();
  for(const h of H){if(h.nt<o.t-5||h.nt>p.t+YB_BEYOND||(h.ax-ox)*fx+(h.az-oz)*fz<=0)continue;out.set(h.id,ybFC(ox,oz,h))}return{g:ybGreen(ox,oz),hz:out}}
function ybDraw(){const el=$('yb');if(!ybOn()){el.classList.add('hide');return}el.classList.remove('hide');const k=W.seed+'/'+W.idx+'/'+W.cv;if(YB.key!==k){YB.key=k;YB.ct=[0];for(let i=1;i<W.C.length;i++)YB.ct.push(YB.ct[i-1]+Math.hypot(W.C[i].x-W.C[i-1].x,W.C[i].z-W.C[i-1].z));YB.haz=ybHazards()}
  const tee=ybFrom(0,0,YB.haz),atTee=Math.hypot(PB.x,PB.z)<1,ball=atTee?tee:ybFrom(PB.x,PB.z,YB.haz);terrainAt(W,PB.x,PB.z);const onG=TQ.ty===4;
  const rows=YB.haz.filter(h=>tee.hz.has(h.id)||ball.hz.has(h.id)).sort((a,b)=>a.nd-b.nd).slice(0,YB_ROWS).sort((a,b)=>a.nt-b.nt);
  const side=h=>Math.abs(h.side)<4?'':h.side>0?', left':', right',name=h=>h.syn?h.name:(h.t===6?'Bunker':'<i class="pen '+(h.pen==='Y'?'y':'r')+'"></i>Water')+side(h);
  const fc=v=>v?dN(v[0])+'–'+(v[1]==null?'':dN(v[1])):'—',gr=g=>g?g.map(dN).join('·'):'—',th=atTee?'<th colspan="2">from the tee</th>':'<th>tee</th><th>ball</th>';
  const tr=(a,b,c)=>'<tr><td>'+a+'</td>'+(atTee?'<td colspan="2">'+b+'</td>':'<td>'+b+'</td><td>'+c+'</td>')+'</tr>',L=String.fromCharCode;
  $('ybH').innerHTML='Hole '+(S.hi+1)+' · par '+S.pars[S.hi]+'<span>'+fmtD(Math.round(Math.hypot(W.pin.x,W.pin.z)))+'</span>';
  $('ybT').innerHTML='<tr><th></th>'+th+'</tr>'+tr('Green',gr(tee.g),onG?'on it':gr(ball.g))+rows.map((h,i)=>tr('<b>'+L(65+i)+'</b> '+name(h),fc(tee.hz.get(h.id)),fc(ball.hz.get(h.id)))).join('')+'<tr class="k"><td colspan="3">'+unitName()+' · green front·middle·back · hazards front–carry</td></tr>';
  /* the page's drawing: the hole from the ball to past the flag, the flag up; the reach rings of the bag round the ball */
  const cvs=$('ybC'),w=Math.round(Math.min(YB_W,innerWidth*.4)-24),hh=Math.round(clamp(innerHeight*.78-40-$('ybT').offsetHeight-$('ybH').offsetHeight,90,380)),d=Math.min(devicePixelRatio||1,2);
  cvs.width=w*d;cvs.height=hh*d;cvs.style.width=w+'px';cvs.style.height=hh+'px';const g=cvs.getContext('2d');g.setTransform(d,0,0,d,0,0);
  const Bx=PB.x,Bz=PB.z,dP=Math.hypot(W.pin.x-Bx,W.pin.z-Bz)||1,sn=(W.pin.x-Bx)/dP,cs=(W.pin.z-Bz)/dP,cx=w/2,cy=hh-16,sc=clamp((hh-34)/(dP+25),.25,4),pt=(x,z)=>{const X=x-Bx,Z=z-Bz;return[cx+sc*(-cs*X+sn*Z),cy-sc*(sn*X+cs*Z)]};
  g.fillStyle=TK('map-bg');g.fillRect(0,0,w,hh);g.save();g.transform(-sc*cs,-sc*sn,sc*sn,-sc*cs,cx+sc*(cs*Bx-sn*Bz),cy+sc*(sn*Bx+cs*Bz));g.imageSmoothingEnabled=false;g.drawImage(mapImg,W.ox,W.oz,W.cols*CS,W.rows*CS);g.restore();
  const txt=(t,x,y,col,al='center')=>{t=unitsText(t);g.font='bold 10px system-ui,sans-serif';g.textAlign=al;g.textBaseline='middle';g.lineWidth=3;g.strokeStyle=TK('black',.7);g.strokeText(t,x,y);g.fillStyle=col;g.fillText(t,x,y)};
  /* the rings, thin; the club's own in gold; a label only where it clears the last one on its side by YB_LABEL px */
  const cur=curClub(),last=[-1e9,-1e9];let k2=0;for(const c of CLUBS){if(c.putter)continue;const r=ownTotalT(c,S.traj)*sc;if(r<6||r>3*hh)continue;const on=c===cur;g.strokeStyle=on?TK('gold300'):TK('white',.45);g.lineWidth=on?2:1;g.beginPath();g.arc(cx,cy,r,0,TAU);g.stroke();
    const sd=k2++%2;if(on||Math.abs(r-last[sd])>=YB_LABEL){last[sd]=r;const a=(sd?1:-1)*.42;txt(c.s,cx+MM.sin(a)*r,cy-MM.cos(a)*r,on?TK('gold300'):TK('white'))}}
  g.setLineDash([4,4]);g.strokeStyle=TK('white',.7);g.lineWidth=1.2;g.beginPath();g.moveTo(cx,cy);const[pX,pY]=pt(W.pin.x,W.pin.z);g.lineTo(pX,pY);g.stroke();g.setLineDash([]);
  g.strokeStyle=TK('white');g.lineWidth=2;g.beginPath();g.moveTo(pX,pY);g.lineTo(pX,pY-13);g.stroke();g.fillStyle=TK('red500');g.beginPath();g.moveTo(pX,pY-13);g.lineTo(pX+9,pY-9.5);g.lineTo(pX,pY-6);g.closePath();g.fill();
  rows.forEach((h,i)=>{const[X,Y]=pt(h.ax,h.az);if(X>6&&X<w-6&&Y>6&&Y<hh-6)txt(L(65+i),X,Y,TK('white'))});
  g.fillStyle=TK('white');g.beginPath();g.arc(cx,cy,3.5,0,TAU);g.fill();g.strokeStyle=TK('black');g.lineWidth=1;g.stroke()}
