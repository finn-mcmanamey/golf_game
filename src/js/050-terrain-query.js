/* ================= terrain query ================= */
const TQ={h:0,nx:0,ny:1,nz:0,ty:2,cell:0,wl:-1e9};
function terrainAt(W,x,z,q=TQ){
  if(W.flat!=null){const t=W.tilt;if(t){const l=MM.hyp(t[0],1,t[1]);q.h=-(t[0]*x+t[1]*z);q.nx=t[0]/l;q.ny=1/l;q.nz=t[1]/l}else{q.h=0;q.nx=0;q.ny=1;q.nz=0}q.ty=W.flatAt?W.flatAt(x,z):W.flat;q.cell=0;q.wl=-1e9;return q}
  const fx=clamp((x-W.ox)/CS,0,W.cols-1e-4),fz=clamp((z-W.oz)/CS,0,W.rows-1e-4),i=fx|0,j=fz|0,u=fx-i,v=fz-j,s=W.cols+1,k=j*s+i,H=W.H,c=j*W.cols+i;
  const h00=H[k],h10=H[k+1],h01=H[k+s],h11=H[k+s+1];let h,bx,bz;
  if(W.diag[c]===0){if(u>v){h=h00+(h10-h00)*u+(h11-h10)*v;bx=h10-h00;bz=h11-h10}else{h=h00+(h01-h00)*v+(h11-h01)*u;bx=h11-h01;bz=h01-h00}}
  else{if(u+v<1){h=h00+(h10-h00)*u+(h01-h00)*v;bx=h10-h00;bz=h01-h00}else{h=h11+(h01-h11)*(1-u)+(h10-h11)*(1-v);bx=h11-h01;bz=h11-h10}}
  const nx=-bx/CS,nz=-bz/CS,l=MM.hyp(nx,1,nz);q.h=h;q.nx=nx/l;q.ny=1/l;q.nz=nz/l;q.ty=W.ty[c];q.cell=c;const p=W.pond[c];q.wl=p>=0?W.levels[p]:-1e9;return q}
const oob=(W,x,z)=>x<W.ox+1||x>W.ox+W.cols*CS-1||z<W.oz+1||z>W.oz+W.rows*CS-1;
