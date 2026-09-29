/* ===== Q-15 trees by biome: each biome draws its own species, chosen by a hash of the tree's position, fitted inside the generator's own canopy spheres (so what you see is what the ball hits); the generator's tree records and every collision shape are untouched; autumn rounds shed leaves near the camera on High. Drawing only ===== */
const LEAF_RATE=6,LEAF_NEAR=40,TREE_BOXES=7;
/* species by biome and by the generator's tree kind (0 Classic draws as generated) */
const SPECIES={1:{pine:['bent'],oak:['buckthorn','gorse']},2:{pine:['scots'],oak:['birch']},3:{cactus:['saguaro','joshua','paloverde']},4:{pine:['cedar'],oak:['oak','elm','cherry']},5:{pine:['spruce','larch','spruce']},6:{pine:['norfolk'],oak:['banksia','teatree']}};
const TCOL={spruce:[.12,.30,.16],larch:[.36,.50,.22],bent:[.20,.36,.20],scots:[.22,.38,.20],cedar:[.14,.30,.24],norfolk:[.18,.40,.22],elm:[.24,.42,.20],birch:[.45,.60,.28],buckthorn:[.52,.60,.45],gorse:[.20,.33,.16],banksia:[.35,.45,.25],teatree:[.45,.52,.40],palo:[.60,.72,.30],josh:[.26,.40,.22]};
const EVERGREEN={spruce:1,bent:1,scots:1,cedar:1,norfolk:1,buckthorn:1,gorse:1,banksia:1,teatree:1};
const tsp=t=>{const L=(SPECIES[W.bio]||{})[t.kind];return L?L[(thash(Math.round(t.x*10),Math.round(t.z*10),15)>>>0)%L.length]:null};
/* the boxes a tree draws: its trunk as generated, then its species' crown inside each canopy sphere */
function treeBoxes(W,t){const sp=tsp(t);if(!sp||sp==='oak'||sp==='saguaro'||!t.boxes.length)return t.boxes;const out=[],tr=t.boxes[0].slice(),se=W.season,h=k=>(thash(Math.round(t.x*10)+k,Math.round(t.z*10),16)>>>0)/4294967296,cs=t.cs,col=TCOL[sp]||[.2,.4,.2],add=(x,y,z,a,b,c,cl)=>{const q=[x,y,z,a,b,c,cl];if(EVERGREEN[sp])q.eg=true;out.push(q)};
  if(sp==='birch')tr[6]=[.86,.85,.80];else if(sp==='scots')tr[6]=[.55,.35,.22];else if(sp==='paloverde')tr[6]=[.45,.60,.30];out.push(tr);
  if(t.kind==='cactus'){if(!cs.length)return t.boxes;const top=tr[1]+tr[4];for(const c of cs){if(sp==='joshua'){/* a branch from the tuft toward the trunk, kept inside the sphere */const vx=t.x-c.x,vy=top-c.y,vz=t.z-c.z,L=Math.hypot(vx,vy,vz)||1,g=Math.min(L,c.r*.9)/2;add(c.x+vx/L*g,c.y+vy/L*g,c.z+vz/L*g,Math.max(.1,Math.abs(vx/L)*g),Math.max(.08,Math.abs(vy/L)*g),Math.max(.1,Math.abs(vz/L)*g),[.42,.34,.24]);add(c.x,c.y,c.z,c.r*.45,c.r*.35,c.r*.45,TCOL.josh)}
      else add(c.x,c.y,c.z,c.r*.7,c.r*.38,c.r*.7,TCOL.palo)}return out.slice(0,TREE_BOXES)}
  if(t.kind==='pine'){const wx=W.wind&&W.wind.s>.3?W.wind.x/W.wind.s:0,wz=W.wind&&W.wind.s>.3?W.wind.z/W.wind.s:0;
    if(sp==='larch'&&se===3){for(const c of cs)add(c.x,c.y,c.z,c.r*.55,.05,.05,[.4,.3,.22]);return out}
    const lc=sp==='larch'&&se===2?[.80,.66,.20]:col;
    cs.forEach((c,i)=>{const r=c.r,k=(i+1)/cs.length;
      if(sp==='spruce'||sp==='larch')add(c.x,c.y,c.z,r*.8,r*.55,r*.8,lc);
      else if(sp==='bent')add(c.x+wx*r*.3*k,c.y,c.z+wz*r*.3*k,r*.8,r*.45,r*.7,col);
      else if(sp==='scots')add(c.x,c.y+r*.1,c.z,r*(.55+.35*k),r*.35,r*(.55+.35*k),col);
      else if(sp==='cedar')add(c.x,c.y,c.z,r*.95,r*.3,r*.95,col);
      else if(sp==='norfolk'){add(c.x,c.y+r*.25,c.z,r*.85,r*.16,r*.85,col);if(i<2)add(c.x,c.y-r*.3,c.z,r*.6,r*.14,r*.6,col)}});
    const c=cs[cs.length-1];if(c&&(sp==='spruce'||sp==='larch'))add(c.x,c.y+c.r*.75,c.z,c.r*.25,c.r*.35,c.r*.25,lc);return out.slice(0,TREE_BOXES)}
  /* broadleaf crowns: one box per sphere, shaped by species; flowers and cones on top */
  cs.forEach((c,i)=>{const r=c.r,j=(h(i)-.5)*r*.25;
    if(sp==='elm')add(c.x,c.y+r*.15,c.z,r*.62,r*.9,r*.62,col);
    else if(sp==='cherry')add(c.x,c.y,c.z,r*.8,r*.7,r*.8,se===0?[.93,.62,.72]:col);
    else if(sp==='birch')add(c.x,c.y,c.z,r*.6,r*.8,r*.6,col);
    else if(sp==='teatree')add(c.x+j,c.y,c.z-j,r*.72,r*.6,r*.66,col);
    else add(c.x,c.y,c.z,r*.78,r*.66,r*.78,col)});
  const c0=cs[0];if(c0&&sp==='gorse'&&se===0)for(let k=0;k<2;k++)add(c0.x+(h(10+k)-.5)*c0.r,c0.y+c0.r*.6,c0.z+(h(20+k)-.5)*c0.r,c0.r*.18,c0.r*.12,c0.r*.18,[.95,.82,.18]);
  if(c0&&sp==='banksia')for(let k=0;k<2;k++)add(c0.x+(h(30+k)-.5)*c0.r,c0.y+c0.r*.3,c0.z+(h(40+k)-.5)*c0.r,c0.r*.1,c0.r*.2,c0.r*.1,[.85,.7,.25]);
  return out.slice(0,TREE_BOXES)}
/* autumn leaf fall near the camera (High): LEAF_RATE a second from canopies within LEAF_NEAR, drifting on the wind */
const LEAF={acc:0};
function leafTick(dt){if(!W||W.season!==2||GFX.level<2||S.mode==='title'||S.photo||!W.trees||!W.trees.length)return;LEAF.acc+=dt*LEAF_RATE;const R=Math.random;
  while(LEAF.acc>=1){LEAF.acc-=1;let t=null;for(let k=0;k<6&&!t;k++){const q=W.trees[(R()*W.trees.length)|0];if(q.cs.length&&Math.hypot(q.x-cam.x,q.z-cam.z)<LEAF_NEAR&&!EVERGREEN[tsp(q)])t=q}if(!t)continue;
    const c=t.cs[(R()*t.cs.length)|0],a=R()*TAU,w=W.wind||{x:0,z:0};if(PARTS.length<400)PARTS.push({x:c.x+MM.sin(a)*c.r*.8,y:c.y-c.r*.3,z:c.z+MM.cos(a)*c.r*.8,vx:(w.x||0)*.12,vy:-(.6+R()*.5),vz:(w.z||0)*.12,s:.035,life:4+R()*3,col:R()<.5?[.86,.52,.16]:[.80,.32,.14],leaf:true})}}
