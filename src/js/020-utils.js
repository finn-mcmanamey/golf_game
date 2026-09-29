/* ================= utils ================= */
const TAU=Math.PI*2,DEG=Math.PI/180,hyp=Math.hypot;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,sstep=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};
const $=id=>document.getElementById(id);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>{const l=MM.hyp(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeNoise(rand){
  const P=new Uint8Array(512),p=[];for(let i=0;i<256;i++)p[i]=i;
  for(let i=255;i>0;i--){const j=(rand()*(i+1))|0,t=p[i];p[i]=p[j];p[j]=t}
  for(let i=0;i<512;i++)P[i]=p[i&255];
  const GX=[1,-1,1,-1,1,-1,0,0],GZ=[1,1,-1,-1,0,0,1,-1],fade=t=>t*t*t*(t*(t*6-15)+10);
  const n2=(x,y)=>{const X=Math.floor(x),Y=Math.floor(y);x-=X;y-=Y;const xi=X&255,yi=Y&255,u=fade(x),v=fade(y);
    const a=P[P[xi]+yi]&7,b=P[P[xi+1]+yi]&7,c=P[P[xi]+yi+1]&7,d=P[P[xi+1]+yi+1]&7;
    return lerp(lerp(GX[a]*x+GZ[a]*y,GX[b]*(x-1)+GZ[b]*y,u),lerp(GX[c]*x+GZ[c]*(y-1),GX[d]*(x-1)+GZ[d]*(y-1),u),v)*1.1};
  const fbm=(x,y,o)=>{let s=0,a=1,f=1,t=0;for(let i=0;i<o;i++){s+=n2(x*f,y*f)*a;t+=a;a*=.5;f*=2.07}return s/t};
  return{n2,fbm};
}
const M4={
  I:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
  persp(f,a,n,fr){const t=1/MM.tan(f/2),o=new Float32Array(16);o[0]=t/a;o[5]=t;o[10]=(fr+n)/(n-fr);o[11]=-1;o[14]=2*fr*n/(n-fr);return o},
  ortho(r,n,fr){const o=new Float32Array(16);o[0]=1/r;o[5]=1/r;o[10]=-2/(fr-n);o[14]=-(fr+n)/(fr-n);o[15]=1;return o},
  look(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],l=MM.hyp(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
    let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=MM.hyp(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1])},
  mul(a,b){const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}return o},
  trs(x,y,z,s=1,ry=0){const c=MM.cos(ry),n=MM.sin(ry);return new Float32Array([c*s,0,-n*s,0,0,s,0,0,n*s,0,c*s,0,x,y,z,1])},
  axes(r,u,f,p,s=1){return new Float32Array([r[0]*s,r[1]*s,r[2]*s,0,u[0]*s,u[1]*s,u[2]*s,0,f[0]*s,f[1]*s,f[2]*s,0,p[0],p[1],p[2],1])},
  rot(ax,ay,az,ang){const l=MM.hyp(ax,ay,az)||1;ax/=l;ay/=l;az/=l;const c=MM.cos(ang),s=MM.sin(ang),t=1-c;
    return new Float32Array([t*ax*ax+c,t*ax*ay+s*az,t*ax*az-s*ay,0,t*ax*ay-s*az,t*ay*ay+c,t*ay*az+s*ax,0,t*ax*az+s*ay,t*ay*az-s*ax,t*az*az+c,0,0,0,0,1])}
};
