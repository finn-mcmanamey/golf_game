'use strict';
/* ===== B-2 the game's own maths: course version 5 generates, simulates, drops and plays its bots on sin, cos, tan, atan, atan2, asin, exp, log, pow and hypot written from +, −, ×, ÷ and square root only (fdlibm's algorithms), so every browser computes the same bits; versions 0–4 keep the engine's functions and stay byte-identical ===== */
const VM=(()=>{const DV=new DataView(new ArrayBuffer(8)),HI=x=>{DV.setFloat64(0,x);return DV.getInt32(0)},LO=x=>{DV.setFloat64(0,x);return DV.getUint32(4)},W2=(h,l)=>{DV.setInt32(0,h|0);DV.setUint32(4,l>>>0);return DV.getFloat64(0)},setHI=(x,h)=>{DV.setFloat64(0,x);DV.setInt32(0,h|0);return DV.getFloat64(0)};
  const S1=-1.66666666666666324348e-01,S2=8.33333333332248946124e-03,S3=-1.98412698298579493134e-04,S4=2.75573137070700676789e-06,S5=-2.50507602534068634195e-08,S6=1.58969099521155010221e-10;
  const C1=4.16666666666666019037e-02,C2=-1.38888888888741095749e-03,C3=2.48015872894767294178e-05,C4=-2.75573143513906633035e-07,C5=2.08757232129817482790e-09,C6=-1.13596475577881948265e-11;
  const ksin=(x,y,iy)=>{const z=x*x,v=z*x,r=S2+z*(S3+z*(S4+z*(S5+z*S6)));return iy===0?x+v*(S1+z*r):x-((z*(.5*y-v*r)-y)-v*S1)};
  const kcos=(x,y)=>{const ix=HI(x)&0x7fffffff;if(ix<0x3e400000&&Math.trunc(x)===0)return 1;const z=x*x,r=z*(C1+z*(C2+z*(C3+z*(C4+z*(C5+z*C6)))));if(ix<0x3FD33333)return 1-(.5*z-(z*r-x*y));const qx=ix>0x3fe90000?.28125:W2(ix-0x00200000,0),hz=.5*z-qx,a=1-qx;return a-(hz-(z*r-x*y))};
  const IP2=6.36619772367581382433e-01,P21=1.57079632673412561417e+00,P21T=6.07710050650619224932e-11,P22=6.07710050630396597660e-11,P22T=2.02226624879595063154e-21,P23=2.02226624871116645580e-21,P23T=8.47842766036889956997e-32,Y=[0,0];
  /* argument reduction by π/2 (fdlibm's medium case, three-part π/2, exact to |x| < 2^19·π/2); beyond that a double-length 2π reduction, deterministic if less precise */
  function rem(x){const hx=HI(x),ix=hx&0x7fffffff;let t=Math.abs(x);if(ix>0x413921fb){const P2A=6.283185307179586,P2B=2.4492935982947064e-16,k=Math.floor(t/P2A);t=(t-k*P2A)-k*P2B;if(t<0)t+=P2A;x=hx<0?-t:t;return rem(x)}
    const n=Math.floor(t*IP2+.5),fn=n;let r=t-fn*P21,w=fn*P21T,y0=r-w;const j=ix>>20;let i=j-((HI(y0)>>20)&0x7ff);
    if(i>16){let tt=r;w=fn*P22;r=tt-w;w=fn*P22T-((tt-r)-w);y0=r-w;i=j-((HI(y0)>>20)&0x7ff);if(i>49){tt=r;w=fn*P23;r=tt-w;w=fn*P23T-((tt-r)-w);y0=r-w}}
    const y1=(r-y0)-w;if(hx<0){Y[0]=-y0;Y[1]=-y1;return-n}Y[0]=y0;Y[1]=y1;return n}
  function sin(x){const ix=HI(x)&0x7fffffff;if(ix<=0x3fe921fb)return ksin(x,0,0);if(ix>=0x7ff00000)return NaN;const n=rem(x)&3;return n===0?ksin(Y[0],Y[1],1):n===1?kcos(Y[0],Y[1]):n===2?-ksin(Y[0],Y[1],1):-kcos(Y[0],Y[1])}
  function cos(x){const ix=HI(x)&0x7fffffff;if(ix<=0x3fe921fb)return kcos(x,0);if(ix>=0x7ff00000)return NaN;const n=rem(x)&3;return n===0?kcos(Y[0],Y[1]):n===1?-ksin(Y[0],Y[1],1):n===2?-kcos(Y[0],Y[1]):ksin(Y[0],Y[1],1)}
  const AH=[4.63647609000806093515e-01,7.85398163397448278999e-01,9.82793723247329054082e-01,1.57079632679489655800e+00],AL=[2.26987774529616870924e-17,3.06161699786838301793e-17,1.39033110312309984516e-17,6.12323399573676603587e-17],
    AT=[3.33333333333329318027e-01,-1.99999999998764832476e-01,1.42857142725034663711e-01,-1.11111104054623557880e-01,9.09088713343650656196e-02,-7.69187620504482999495e-02,6.66107313738753120669e-02,-5.83357013379057348645e-02,4.97687799461593236017e-02,-3.65315727442169155270e-02,1.62858201153657823623e-02];
  function atan(x){const hx=HI(x),ix=hx&0x7fffffff;let id;if(ix>=0x44100000){if(x!==x)return x;return hx>0?AH[3]+AL[3]:-AH[3]-AL[3]}
    if(ix<0x3fdc0000){if(ix<0x3e200000)return x;id=-1}else{x=Math.abs(x);if(ix<0x3ff30000){if(ix<0x3fe60000){id=0;x=(2*x-1)/(2+x)}else{id=1;x=(x-1)/(x+1)}}else if(ix<0x40038000){id=2;x=(x-1.5)/(1+1.5*x)}else{id=3;x=-1/x}}
    const z=x*x,w=z*z,s1=z*(AT[0]+w*(AT[2]+w*(AT[4]+w*(AT[6]+w*(AT[8]+w*AT[10]))))),s2=w*(AT[1]+w*(AT[3]+w*(AT[5]+w*(AT[7]+w*AT[9]))));
    if(id<0)return x-x*(s1+s2);const r=AH[id]-((x*(s1+s2)-AL[id])-x);return hx<0?-r:r}
  const PI=3.1415926535897931160e+00,PI_LO=1.2246467991473531772e-16,PI2=1.5707963267948965580e+00;
  function atan2(y,x){if(x!==x||y!==y)return NaN;if(x===1)return atan(y);const hx=HI(x),hy=HI(y),ix=hx&0x7fffffff,iy=hy&0x7fffffff,m=((hy>>>31)&1)|((hx>>>30)&2);
    if(y===0){return m===0||m===1?y:m===2?PI:-PI}if(x===0)return hy<0?-PI2:PI2;
    if(ix===0x7ff00000&&LO(x)===0){if(iy===0x7ff00000&&LO(y)===0){return m===0?PI/4:m===1?-PI/4:m===2?3*PI/4:-3*PI/4}return m===0?0:m===1?-0:m===2?PI:-PI}
    if(iy===0x7ff00000&&LO(y)===0)return hy<0?-PI2:PI2;
    const k=(iy-ix)>>20;let z;if(k>60)z=PI2+.5*PI_LO;else if(hx<0&&k<-60)z=0;else z=atan(Math.abs(y/x));
    return m===0?z:m===1?-z:m===2?PI-(z-PI_LO):(z-PI_LO)-PI}
  const tan=x=>sin(x)/cos(x),asin=x=>x>1||x<-1?NaN:atan2(x,Math.sqrt((1-x)*(1+x)));
  const LN2HI=[6.93147180369123816490e-01,-6.93147180369123816490e-01],LN2LO=[1.90821492927058770002e-10,-1.90821492927058770002e-10],INVLN2=1.44269504088896338700e+00,
    EP1=1.66666666666666019037e-01,EP2=-2.77777777770155933842e-03,EP3=6.61375632143793436117e-05,EP4=-1.65339022054652515390e-06,EP5=4.13813679705723846039e-08,TWOM1000=9.33263618503218878990e-302;
  function exp(x){let hx=HI(x);const xsb=(hx>>>31)&1;hx&=0x7fffffff;let hi=0,lo=0,k=0;
    if(hx>=0x40862E42){if(hx>=0x7ff00000){if(x!==x)return x;return xsb===0?x:0}if(x>7.09782712893383973096e+02)return Infinity;if(x< -7.45133219101941108420e+02)return 0}
    if(hx>0x3fd62e42){if(hx<0x3FF0A2B2){hi=x-LN2HI[xsb];lo=LN2LO[xsb];k=1-xsb-xsb}else{k=Math.trunc(INVLN2*x+(xsb?-.5:.5));hi=x-k*LN2HI[0];lo=k*LN2LO[0]}x=hi-lo}
    else if(hx<0x3e300000)return 1+x;
    const t=x*x,c=x-t*(EP1+t*(EP2+t*(EP3+t*(EP4+t*EP5))));if(k===0)return 1-((x*c)/(c-2)-x);const y=1-((lo-(x*c)/(2-c))-hi);
    return k>=-1021?setHI(y,HI(y)+(k<<20)):setHI(y,HI(y)+((k+1000)<<20))*TWOM1000}
  const LG1=6.666666666666735130e-01,LG2=3.999999999940941908e-01,LG3=2.857142874366239149e-01,LG4=2.222219843214978396e-01,LG5=1.818357216161805012e-01,LG6=1.531383769920937332e-01,LG7=1.479819860511658591e-01,L2H=6.93147180369123816490e-01,L2L=1.90821492927058770002e-10,TWO54=1.80143985094819840000e+16;
  function log(x){let hx=HI(x),k=0;const lx=LO(x);if(hx<0x00100000){if(((hx&0x7fffffff)|lx)===0)return-Infinity;if(hx<0)return NaN;k-=54;x*=TWO54;hx=HI(x)}if(hx>=0x7ff00000)return x+x;
    k+=(hx>>20)-1023;hx&=0x000fffff;const i0=(hx+0x95f64)&0x100000;x=setHI(x,hx|(i0^0x3ff00000));k+=(i0>>20);const f=x-1;
    if((0x000fffff&(2+hx))<3){if(f===0){if(k===0)return 0;return k*L2H+k*L2L}const R=f*f*(.5-.33333333333333333*f);return k===0?f-R:k*L2H-((R-k*L2L)-f)}
    const s=f/(2+f),dk=k,z=s*s;let i=hx-0x6147a;const w=z*z,j=0x6b851-hx,t1=w*(LG2+w*(LG4+w*LG6)),t2=z*(LG1+w*(LG3+w*(LG5+w*LG7)));i|=j;const R=t2+t1;
    if(i>0){const hfsq=.5*f*f;return k===0?f-(hfsq-s*(hfsq+R)):dk*L2H-((hfsq-(s*(hfsq+R)+dk*L2L))-f)}return k===0?f-s*(f-R):dk*L2H-((s*(f-R)-dk*L2L)-f)}
  function pow(x,y){if(y===0)return 1;if(x!==x||y!==y)return NaN;if(x===1)return 1;if(y===1)return x;if(y===2)return x*x;if(y===.5&&x>=0)return Math.sqrt(x);
    const yi=Math.trunc(y)===y&&Math.abs(y)<=64;if(yi){let b=y<0?1/x:x,n=Math.abs(y),r=1;while(n){if(n&1)r*=b;b*=b;n=n>>>1}return r}
    if(x===0)return y>0?0:Infinity;if(x<0)return NaN;return exp(y*log(x))}
  const hyp=(a,b,c)=>c===undefined?Math.sqrt(a*a+b*b):Math.sqrt(a*a+b*b+c*c);
  return Object.freeze({sin,cos,tan,atan,atan2,asin,exp,log,pow,hyp})})();
const NM=Object.freeze({sin:Math.sin,cos:Math.cos,tan:Math.tan,atan:Math.atan,atan2:Math.atan2,asin:Math.asin,exp:Math.exp,log:Math.log,pow:Math.pow,hyp:Math.hypot});
let MM=NM;const mathFor=cv=>cv>=5?VM:NM;
const withMath=(cv,fn)=>{const m0=MM;MM=mathFor(cv);try{return fn()}finally{MM=m0}};
