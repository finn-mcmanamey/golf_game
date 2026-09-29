/* ================= mesh builder ================= */
const cq=v=>{v=Math.round(v*204);return v<0?0:v>255?255:v};
class MB{
  constructor(n){this.cap=Math.max(1,Math.ceil(n/10));const b=new ArrayBuffer(this.cap*20);this.f=new Float32Array(b);this.i8=new Int8Array(b);this.u8=new Uint8Array(b);this.nv=0}
  v(x,y,z,nx,ny,nz,r,g,b,m){const o=this.nv*5,f=this.f,q=o*4,i8=this.i8,u8=this.u8;f[o]=x;f[o+1]=y;f[o+2]=z;i8[q+12]=Math.round(nx*127);i8[q+13]=Math.round(ny*127);i8[q+14]=Math.round(nz*127);u8[q+16]=cq(r);u8[q+17]=cq(g);u8[q+18]=cq(b);u8[q+19]=Math.round(m*64);this.nv++}
  triN(ax,ay,az,bx,by,bz,cx,cy,cz,nx,ny,nz,r,g,b,m){this.v(ax,ay,az,nx,ny,nz,r,g,b,m);this.v(bx,by,bz,nx,ny,nz,r,g,b,m);this.v(cx,cy,cz,nx,ny,nz,r,g,b,m)}
  tri(ax,ay,az,bx,by,bz,cx,cy,cz,r,g,b,m){let nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(ny<0){nx=-nx;ny=-ny;nz=-nz}const l=MM.hyp(nx,ny,nz)||1;this.triN(ax,ay,az,bx,by,bz,cx,cy,cz,nx/l,ny/l,nz/l,r,g,b,m)}
  box(cx,cy,cz,hx,hy,hz,c,m=0){const P=[[cx-hx,cy-hy,cz-hz],[cx+hx,cy-hy,cz-hz],[cx+hx,cy+hy,cz-hz],[cx-hx,cy+hy,cz-hz],[cx-hx,cy-hy,cz+hz],[cx+hx,cy-hy,cz+hz],[cx+hx,cy+hy,cz+hz],[cx-hx,cy+hy,cz+hz]];
    for(const[a,b,d,e,nx,ny,nz]of MB.F){const q=P[a],r=P[b],s=P[d],t=P[e];this.triN(q[0],q[1],q[2],r[0],r[1],r[2],s[0],s[1],s[2],nx,ny,nz,c[0],c[1],c[2],m);this.triN(q[0],q[1],q[2],s[0],s[1],s[2],t[0],t[1],t[2],nx,ny,nz,c[0],c[1],c[2],m)}}
  disc(cx,cy,cz,r,seg,c,m=0){for(let i=0;i<seg;i++){const a=i/seg*TAU,b=(i+1)/seg*TAU;this.triN(cx,cy,cz,cx+MM.cos(a)*r,cy,cz+MM.sin(a)*r,cx+MM.cos(b)*r,cy,cz+MM.sin(b)*r,0,1,0,c[0],c[1],c[2],m)}}
  upload(){const buf=gl.createBuffer(),data=this.u8.subarray(0,this.nv*20);gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return{buf,n:this.nv,bytes:data.byteLength}}
}
MB.F=[[0,1,2,3,0,0,-1],[5,4,7,6,0,0,1],[4,0,3,7,-1,0,0],[1,5,6,2,1,0,0],[3,2,6,7,0,1,0],[4,5,1,0,0,-1,0]];
function icosphere(sub){const t=(1+Math.sqrt(5))/2;let V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm);
  let F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
  const mid=(a,b)=>norm([a[0]+b[0],a[1]+b[1],a[2]+b[2]]);
  for(let s=0;s<sub;s++){const nf=[];for(const[a,b,c]of F){const i=V.length;V.push(mid(V[a],V[b]),mid(V[b],V[c]),mid(V[c],V[a]));nf.push([a,i,i+2],[b,i+1,i],[c,i+2,i+1],[i,i+1,i+2])}F=nf}
  return{V,F}}
