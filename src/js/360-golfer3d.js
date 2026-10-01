/* ===== Realistic golfer (Three.js experiment). A rigged human on a transparent canvas over the game, posed every frame from the
   voxel golfer's own frame, swing angle and club path, so the club still meets the ball exactly and replays look the same.
   Drawing only: nothing here is read by the rules. If Three.js or the model is missing, or Settings says Classic, the voxel
   golfer draws as before ===== */
const G3={st:0,req:null,drawn:false,lk:-1};
/* body regions in the model's T-pose (metres, facing +z): below each height or beyond each reach the colour changes */
const G3_REGION={shoe:.1,pants:1.03,sleeve:.34,hand:.66,neck:1.5,cap:1.73};
/* posture: pelvis back and down, forward bend (radians), stance half-width, hand spacing on the grip */
/* light strengths: the sun, a soft fill from the camera so the side you see is never in the dark, and the sky */
const G3_LIGHT={sun:2.6,fill:1.3,sky:2.6};
const G3_POSE={hipBack:.1,hipDrop:.07,pelvis:.17,bend:[.2,.12,.08],hipTurn:.2,chestTurn:[.2,.25],stance:.17,grip:[.56,.65]};

/* the 3D golfer is wanted and possible */
function g3On(){return SETS.golfer3!==0&&typeof THREE!=='undefined'&&typeof GOLFER_GLB==='string'&&G3.st>=0}

/* drawWorld asks each frame: will the 3D golfer draw the player? Until the model is ready the answer is no (the voxel golfer draws) */
function g3Want(x,z,yaw,th,look,lk){if(!g3On())return false;if(G3.st===0)g3Load();if(G3.st!==2)return false;
  G3.req={x,z,yaw,th,look,lk:(lk==null?S.look:lk)>>>0};return true}

/* decode the embedded model once; any failure turns the feature off for this visit */
function g3Load(){G3.st=1;try{const bin=atob(GOLFER_GLB),u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(u8.buffer,'',g=>{try{g3Setup(g);G3.st=2}catch(e){g3Fail(e)}},g3Fail)}catch(e){g3Fail(e)}}
function g3Fail(e){G3.st=-1;errNote('3D golfer: '+(e&&e.message||e),e&&e.stack)}

/* the overlay canvas, renderer, lights, the model's bones and bind pose, and the club */
function g3Setup(gltf){const T=THREE,c3=document.createElement('canvas');c3.id='g3';c3.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none';cv.after(c3);
  const R=new T.WebGLRenderer({canvas:c3,alpha:true,antialias:true});R.setPixelRatio(1);R.outputColorSpace=T.SRGBColorSpace;R.setClearColor(0,0);
  const scene=new T.Scene(),cam3=new T.Camera(),root=new T.Group(),body=gltf.scene;cam3.matrixAutoUpdate=false;root.matrixAutoUpdate=false;scene.add(root);
  body.updateMatrixWorld(true);const meshes=[];body.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;meshes.push({m:o,bind:g3BindPositions(o)})}});
  body.rotation.y=-Math.PI/2;root.add(body);/* the model faces +z; the golfer's frame faces -x, towards the ball */
  const bones={};body.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','')]=o});
  const bind=new Map();for(const k in bones)bind.set(bones[k],bones[k].quaternion.clone());
  for(const{m}of meshes)m.material=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0});
  const sun=new T.DirectionalLight(0xffffff,G3_LIGHT.sun),fill=new T.DirectionalLight(0xffffff,G3_LIGHT.fill),hemi=new T.HemisphereLight(0xbfd7ff,0x55663a,G3_LIGHT.sky);scene.add(sun,sun.target,fill,fill.target,hemi);
  scene.updateMatrixWorld(true);const hq=bones.Head.getWorldQuaternion(new T.Quaternion()).invert();
  Object.assign(G3,{R,scene,cam3,root,meshes,bones,bind,hipsBind:bones.Hips.position.clone(),sun,fill,hemi,club:g3Club(),headF:new T.Vector3(-1,0,0).applyQuaternion(hq)});root.add(G3.club)}

/* each skinned mesh's vertices in the T-pose, in model space: what the region colouring reads. Placed by the skeleton,
   because the shrunk model stores positions squashed and lets the bones scale them back */
function g3BindPositions(m){const p=m.geometry.attributes.position,out=new Float32Array(p.count*3),v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);m.applyBoneTransform(i,v).applyMatrix4(m.matrixWorld);out[i*3]=v.x;out[i*3+1]=v.y;out[i*3+2]=v.z}return out}

/* colour the body from the player's look: shoes, trousers, shirt with short sleeves, bare forearms, hands and head, cap or hair */
function g3Paint(lk){const T=THREE,g=k=>lookGet(lk,k),cap=g('cap'),col=a=>new T.Color().setRGB(a[0],a[1],a[2],T.SRGBColorSpace),
    C={shoe:col([.16,.13,.1]),pants:col(LOOK.pants[g('pants')]),shirt:col(LOOK.shirt[g('shirt')]),skin:col(LOOK.skin[g('skin')]),top:col(cap===5||!LOOK.cap[cap]?LOOK.hc[g('hc')]:LOOK.cap[cap])},Q=G3_REGION;
  for(const{m,bind}of G3.meshes){const n=bind.length/3,a=new Float32Array(n*3);
    for(let i=0;i<n;i++){const x=Math.abs(bind[i*3]),y=bind[i*3+1],c=y<Q.shoe?C.shoe:y<Q.pants?C.pants:x>Q.hand||x>Q.sleeve&&y>1.2?C.skin:y>Q.cap?C.top:y>Q.neck?C.skin:C.shirt;a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b}
    m.geometry.setAttribute('color',new T.BufferAttribute(a,3))}G3.lk=lk}

/* the club in the voxel golfer's arm frame: the same shaft and head, so it meets the ball where the voxel club did */
function g3Club(){const T=THREE,club=new T.Group(),steel=new T.MeshStandardMaterial({color:0xc4c8cf,roughness:.35,metalness:.8}),grip=new T.MeshStandardMaterial({color:0x222222,roughness:.9});
  const shaft=new T.Mesh(new T.CylinderGeometry(.0065,.0065,.92,8),steel);shaft.position.set(0,-1.02,0);
  const handle=new T.Mesh(new T.CylinderGeometry(.011,.011,.26,8),grip);handle.position.set(0,-.62,0);
  const head=new T.Mesh(new T.BoxGeometry(.11,.05,.05),steel);head.position.set(-.04,-1.49,0);
  club.add(shaft,handle,head);club.matrixAutoUpdate=false;return club}

/* rotate a bone about a world axis, keeping its children attached */
function g3Turn(b,q){const T=THREE,pw=b.parent.getWorldQuaternion(new T.Quaternion()),bw=b.getWorldQuaternion(new T.Quaternion());
  b.quaternion.copy(pw.invert().multiply(q.multiply(bw)));b.updateMatrixWorld(true)}
const g3AxisTurn=(b,ax,ang)=>g3Turn(b,new THREE.Quaternion().setFromAxisAngle(ax,ang));
const g3Pos=b=>b.getWorldPosition(new THREE.Vector3());

/* turn a bone so its child points at a target */
function g3Aim(b,child,target){const p=g3Pos(b),from=g3Pos(child).sub(p).normalize(),to=target.clone().sub(p).normalize();
  if(from.lengthSq()>0&&to.lengthSq()>0)g3Turn(b,new THREE.Quaternion().setFromUnitVectors(from,to))}

/* two-bone reach (shoulder-elbow-wrist or hip-knee-ankle): the middle joint bends towards the pole point */
function g3Reach(a,b,c,target,pole){const s=g3Pos(a),la=g3Pos(b).distanceTo(s),lb=g3Pos(c).distanceTo(g3Pos(b)),D=target.clone().sub(s),d=Math.min(Math.max(D.length(),Math.abs(la-lb)+1e-3),la+lb-1e-3),dir=D.normalize();
  const x=(la*la-lb*lb+d*d)/(2*d),h=Math.sqrt(Math.max(0,la*la-x*x)),pp=pole.clone().sub(s);pp.sub(dir.clone().multiplyScalar(pp.dot(dir))).normalize();
  g3Aim(a,b,s.clone().add(dir.clone().multiplyScalar(x)).add(pp.multiplyScalar(h)));g3Aim(b,c,s.clone().add(dir.multiplyScalar(d)))}

/* pose the body in the golfer's own frame (ball at -x, target +z): address posture, turn with the swing, hands on the club, feet planted */
function g3Pose(th,look,arm){const T=THREE,B=G3.bones,P=G3_POSE,V=(x,y,z)=>new T.Vector3(x,y,z),Y=V(0,1,0),Z=V(0,0,1);
  for(const[b,q]of G3.bind)b.quaternion.copy(q);B.Hips.position.copy(G3.hipsBind);G3.root.matrix.identity();G3.scene.updateMatrixWorld(true);
  const fin=Math.max(0,-th),turn=th>=0?th:-fin*.8;/* the follow-through turns the body through to face the target */
  const hip=g3Pos(B.Hips).add(V(P.hipBack,-P.hipDrop,0));B.Hips.position.copy(B.Hips.parent.worldToLocal(hip));B.Hips.updateMatrixWorld(true);
  g3AxisTurn(B.Hips,Y,-turn*P.hipTurn);g3AxisTurn(B.Hips,Z,P.pelvis);
  [B.Spine,B.Spine1,B.Spine2].forEach((b,i)=>g3AxisTurn(b,Z,P.bend[i]));
  const up=g3Pos(B.Neck).sub(g3Pos(B.Spine1)).normalize();g3AxisTurn(B.Spine1,up,-turn*P.chestTurn[0]);g3AxisTurn(B.Spine2,up,-turn*P.chestTurn[1]);
  /* feet planted under the hips, knees bent towards the ball; the trail heel lifts at the finish */
  for(const[s,zs]of[['Left',1],['Right',-1]]){const lift=s==='Right'?Math.min(1,fin*.7):0,ank=V(.02+lift*.04,.084+lift*.07,zs*P.stance);
    g3Reach(B[s+'UpLeg'],B[s+'Leg'],B[s+'Foot'],ank,V(-1,.6,zs*P.stance));g3Aim(B[s+'Foot'],B[s+'ToeBase'],ank.clone().add(V(-.11,-.08+lift*-.04,zs*.02)))}
  /* hands on the grip, lead hand above the trail hand; elbows fold towards the hips */
  const at=y=>new T.Vector3(0,-y,0).applyMatrix4(arm),hipP=g3Pos(B.Hips),tip=at(1.4);
  for(const[s,k]of[['Left',0],['Right',1]]){const g=at(P.grip[k]);g3Reach(B[s+'Arm'],B[s+'ForeArm'],B[s+'Hand'],g,hipP.clone().add(V(.2,-.4,0)));
    if(B[s+'HandMiddle1'])g3Aim(B[s+'Hand'],B[s+'HandMiddle1'],g3Pos(B[s+'Hand']).add(tip.clone().sub(g).normalize().multiplyScalar(.1)))}
  /* eyes on the ball, then up after the target as the finish comes round; the look-at-the-pin turn from the voxel golfer */
  const hp=g3Pos(B.Head),ball=V(-GOLFER.side,.02,0),eyes=ball.sub(hp).normalize().lerp(V(0,.25,1).normalize(),Math.min(1,fin*.9)).normalize().applyAxisAngle(Y,look||0);
  for(const[b,w]of[[B.Neck,.5],[B.Head,1]]){const cur=G3.headF.clone().applyQuaternion(B.Head.getWorldQuaternion(new T.Quaternion()));g3Turn(b,new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(cur,eyes),w))}}

/* after each rendered frame: draw the golfer the scene asked for this frame, or clear the overlay if it asked for none */
function g3Frame(){if(G3.st!==2)return;const q=G3.req,R=G3.R;G3.req=null;
  if(!q){if(G3.drawn){R.clear();G3.drawn=false}return}
  try{const T=THREE,w=cv.width,h=cv.height,c=R.domElement;if(c.width!==w||c.height!==h)R.setSize(w,h,false);
    const c3=G3.cam3;c3.projectionMatrix.fromArray(FR.P);c3.projectionMatrixInverse.copy(c3.projectionMatrix).invert();c3.matrixWorldInverse.fromArray(FR.V);c3.matrixWorld.copy(c3.matrixWorldInverse).invert();
    if(q.lk!==G3.lk)g3Paint(q.lk);
    const hs=(q.lk&HAND_BIT)?-1:1,r=[MM.cos(q.yaw)*hs,0,-MM.sin(q.yaw)*hs],d=[MM.sin(q.yaw),0,MM.cos(q.yaw)],gx=q.x+r[0]*GOLFER.side,gz=q.z+r[2]*GOLFER.side,st=stance11(q.x,q.z,gx,gz,q.yaw,d),A=GOLFER.axis;
    const arm=new T.Matrix4().fromArray(M4.mul(M4.trs(0,GOLFER.shoulder,0),M4.mul(M4.rot(A[0],A[1],A[2],q.th),M4.rot(0,0,1,GOLFER.tilt))));
    g3Pose(q.th,q.look,arm);G3.club.matrix.copy(arm);G3.root.matrix.fromArray(M4.mul(M4.axes(r,[0,1,0],d,[gx,st.y,gz]),st.tilt));G3.scene.updateMatrixWorld(true);
    const L=FR.light||[1,1,1],sn=FR.sun||[.4,.8,.3];G3.sun.color.setRGB(L[0],L[1],L[2]);G3.sun.position.set(gx+sn[0]*10,st.y+sn[1]*10,gz+sn[2]*10);G3.sun.target.position.set(gx,st.y,gz);G3.sun.target.updateMatrixWorld();
    const E=FR.eye||[cam.x,cam.y,cam.z];G3.fill.position.set(E[0],E[1]+2,E[2]);G3.fill.target.position.set(gx,st.y+1,gz);G3.fill.target.updateMatrixWorld();
    if(FR.skyA)G3.hemi.color.setRGB(FR.skyA[0],FR.skyA[1],FR.skyA[2]);if(FR.gnd)G3.hemi.groundColor.setRGB(FR.gnd[0],FR.gnd[1],FR.gnd[2]);
    R.render(G3.scene,c3);G3.drawn=true}catch(e){g3Fail(e);R.clear();G3.drawn=false}}

/* a saved photo is the game canvas plus the golfer layer on top (photo mode's Save calls this right after rendering) */
function g3Snapshot(){if(!G3.drawn||!G3.R)return cv;const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;
  const g=c.getContext('2d');g.drawImage(cv,0,0);g.drawImage(G3.R.domElement,0,0);return c}

VL.feature({id:'golfer.3d',kind:'view',deps:['core.view'],f:[]});
