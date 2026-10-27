/* ===== WebGL setup: shaders and small matrix helpers =====
   Everything from here on is drawing only: it reads race state and never writes it. */

const $ = id => document.getElementById(id);
const canvas = $('gl');
const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
if (!gl) document.body.innerHTML = '<p style="padding:40px;text-align:center;color:#fff">Voxel Regatta needs WebGL.</p>';

function makeProgram(vs, fs) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, a = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace('[0]', '');
    u[name] = gl.getUniformLocation(p, name);
  }
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i < n; i++) {
    const name = gl.getActiveAttrib(p, i).name;
    a[name] = gl.getAttribLocation(p, name);
  }
  return { p, u, a };
}

// Shared fog: distant things fade into the horizon colour.
const FOG_GLSL = `vec3 applyFog(vec3 col, vec3 w){float d=distance(uEye,w);float f=1.0-exp(-d*uFogK);f=clamp(f*f*(3.0-2.0*f)*1.1,0.0,1.0);return mix(col,uHorizon,f);}`;

// Lit voxel geometry: flat colours, sun plus sky light, fog.
const LIT = gl && makeProgram(
  `precision highp float;attribute vec3 aP,aN,aC;uniform mat4 uVP;uniform float uMirror;varying vec3 vN,vC,vW;
   void main(){vec3 p=vec3(aP.x,aP.y*uMirror,aP.z);vN=vec3(aN.x,aN.y*uMirror,aN.z);vC=aC;vW=p;gl_Position=uVP*vec4(p,1.0);}`,
  `precision highp float;varying vec3 vN,vC,vW;uniform vec3 uEye,uSun,uSunCol,uSky,uGround,uHorizon;uniform float uFogK,uAlpha,uMirror;
   ${FOG_GLSL}
   void main(){if(uMirror<0.0&&vW.y>0.02)discard;vec3 n=normalize(vN);float d=max(dot(n,uSun),0.0);vec3 amb=mix(uGround,uSky,n.y*0.5+0.5);
     vec3 col=vC*(amb*0.62+uSunCol*d*0.78);
     gl_FragColor=vec4(applyFog(col,vW),uAlpha);}`);

// Water: rippled normals, sky reflection, sun glitter, and wakes trailing each boat.
const WATER = gl && makeProgram(
  `precision highp float;attribute vec3 aP;uniform mat4 uVP;varying vec3 vW;void main(){vW=aP;gl_Position=uVP*vec4(aP,1.0);}`,
  `precision highp float;varying vec3 vW;uniform vec3 uEye,uSun,uSunCol,uSky,uHorizon,uDeep,uBank;uniform float uT,uFogK,uWind,uBankZ,uReflect;
   uniform vec4 uBoats[8];uniform vec4 uPuddles[24];
   ${FOG_GLSL}
   float wave(vec2 p,vec2 d,float f,float s){return sin(dot(p,d)*f+uT*s);}
   void main(){
     vec2 p=vW.xz;float a=0.035+0.03*uWind;
     vec2 g=vec2(0.0);
     g+=vec2(0.8,0.6)*cos(dot(p,vec2(0.8,0.6))*0.9+uT*1.6)*0.9;
     g+=vec2(-0.3,0.95)*cos(dot(p,vec2(-0.3,0.95))*1.7+uT*2.3)*0.55;
     g+=vec2(0.6,-0.8)*cos(dot(p,vec2(0.6,-0.8))*3.1+uT*3.1)*0.35;
     g+=vec2(0.99,0.1)*cos(dot(p,vec2(0.99,0.1))*6.3+uT*4.4)*0.18;
     float foam=0.0;
     for(int i=0;i<8;i++){vec4 b=uBoats[i];if(b.w<=0.0)continue;
       float dx=p.x-b.x,dz=p.y-b.y;
       if(dx<0.5&&dx>-120.0){float back=-dx;float spread=abs(dz)-back*0.18-0.4;float fadeIn=smoothstep(0.5,-1.5,dx);
         float vline=exp(-spread*spread*2.5)*exp(-back*0.035)*b.z*fadeIn;
         foam+=vline*0.45;g+=vec2(0.0,dz/(abs(dz)+0.3))*vline*1.6;
         float trail=exp(-dz*dz*1.5)*exp(-(back-b.w)*0.12)*b.z*smoothstep(b.w-1.0,b.w+2.0,back);foam+=trail*0.3;}}
     for(int i=0;i<24;i++){vec4 q=uPuddles[i];if(q.w<=0.0)continue;vec2 d=p-q.xy;float r=length(d);float e=(r-0.2-q.z*0.09)*6.0;float ring=exp(-e*e)*q.w;
       foam+=ring*0.35+exp(-r*r*9.0)*q.w*0.25;g+=d/(r+0.01)*ring*1.2;}
     vec3 n=normalize(vec3(-g.x*a,1.0,-g.y*a));
     vec3 v=normalize(uEye-vW);vec3 r=reflect(-v,n);
     float fres=0.04+0.96*pow(1.0-max(dot(n,v),0.0),5.0);
     vec3 sky=mix(uHorizon,uSky,clamp(r.y*1.6,0.0,1.0));
     float bank=smoothstep(uBankZ-28.0,uBankZ+4.0,abs(vW.z+r.z*8.0));
     sky=mix(sky,uBank,bank*0.75);
     vec3 col=mix(uDeep,sky,clamp(fres*1.3+0.12,0.0,1.0));
     col+=uSunCol*pow(max(dot(r,uSun),0.0),220.0)*2.2;
     col=mix(col,vec3(0.93,0.97,1.0),clamp(foam,0.0,0.8));
     float alpha=uReflect>0.5?clamp(0.5+0.5*(1.0-fres)-foam*0.3,0.55,0.92):1.0;alpha=max(alpha,clamp(foam,0.0,1.0));
     gl_FragColor=vec4(applyFog(col,vW),alpha);}`);

// Sky: a full-screen triangle; each pixel works out its view direction from the camera basis.
const SKY = gl && makeProgram(
  `precision highp float;attribute vec2 aP;varying vec2 vS;void main(){vS=aP;gl_Position=vec4(aP,0.9999,1.0);}`,
  `precision highp float;varying vec2 vS;uniform vec3 uR,uU,uF,uSun,uSunCol,uSky,uHorizon;uniform vec2 uTan;uniform float uT,uCloud,uStars;
   float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
   void main(){vec3 d=normalize(uF+vS.x*uTan.x*uR+vS.y*uTan.y*uU);
     vec3 col=mix(uHorizon,uSky,pow(clamp(d.y,0.0,1.0),0.55));
     float s=max(dot(d,uSun),0.0);col+=uSunCol*(pow(s,800.0)*3.0+pow(s,12.0)*0.25);
     if(d.y>0.01){vec2 cp=d.xz/d.y*0.004+vec2(uT*0.002,0.0);float c=n(cp*6.0)*0.6+n(cp*13.0)*0.3+n(cp*29.0)*0.1;
       c=smoothstep(1.0-uCloud,1.05-uCloud*0.5,c)*smoothstep(0.0,0.25,d.y);col=mix(col,mix(uHorizon,vec3(1.0),0.7)+uSunCol*0.08,c*0.85);}
     if(uStars>0.0&&d.y>0.0){vec2 g=floor(d.xz/(d.y+0.3)*260.0);float st=step(0.9975,h(g));col+=vec3(st)*uStars*smoothstep(0.02,0.3,d.y)*(0.6+0.4*sin(uT*2.0+h(g+1.0)*40.0));}
     if(d.y<0.0)col=uHorizon;
     gl_FragColor=vec4(col,1.0);}`);

/* ----- matrices (column-major, as WebGL expects) ----- */
const M4 = {
  perspective(fovy, aspect, near, far) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / aspect; o[5] = t; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = 2 * far * near / (near - far);
    return o;
  },
  lookAt(e, c, up) {
    let f = norm3([c[0] - e[0], c[1] - e[1], c[2] - e[2]]);
    const r = norm3(cross3(f, up)), u = cross3(r, f);
    return {
      m: new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0,
        -dot3(r, e), -dot3(u, e), dot3(f, e), 1]), r, u, f,
    };
  },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  },
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] };
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
