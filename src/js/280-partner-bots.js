/* ===== the partner bots on course version 6 (the 1,000-seed sweeps found them looping to the stroke cap on version 5): never stroke and distance straight back into the water it just found; after two penalties running, the next shot lays up clear of trouble; after two failed escapes from the same bunker, the unplayable out of it; never a plan that its own flight puts in water or out of bounds (club up, at most BOT_UP); an island green is played to its middle ===== */
const BOT_UP=3;
let BOT_SAFE=false;
const botPens=L=>{let n=0;for(let i=L.length-1;i>=0&&n<2;i--){const e=L[i];if((e.kind|0)!==0)continue;if(e.r===2||e.r===3)n++;else break}return n};
/* relief for a bot's water ball: the cheapest option, but not stroke and distance when the last ball from this spot went in too */
function botRelief(opts,L,start){let o=opts;const e=L[L.length-1];if(W.cv>=6&&e&&(e.kind|0)===0&&(e.r===2||e.r===3)){const P=holePath(L,W.pin),last=P.length?P[P.length-1]:null;if(last&&Math.hypot(last.start[0]-start[0],last.start[1]-start[1])<1){const f=opts.filter(q=>q.o!==0);if(f.length)o=f}}
  return o.reduce((a,q)=>q.exp<a.exp-1e-9?q:a)}
/* two shots running that stayed in the same bunker: the unplayable relief out of it (or the best other relief) */
function botBunker(L){if(W.cv<6)return null;terrainAt(W,GB.x,GB.z);if(TQ.ty!==6)return null;const P=holePath(L,W.pin);let n=0;for(let i=P.length-1;i>=0&&n<2;i--){const o=P[i],e=o.e;if((e.kind|0)!==0)break;terrainAt(W,o.start[0],o.start[1]);if(TQ.ty!==6||e.r!==0||Math.hypot(uPos(e.x)-o.start[0],uPos(e.z)-o.start[1])>3)break;n++}
  if(n<2)return null;const ctx=reliefCtx('unplay',[GB.x,GB.z],[GB.x,GB.z]),opts=reliefOptions(ctx).filter(q=>q.o!==0);if(!opts.length)return null;const b=opts.find(q=>q.o===3)||opts.reduce((a,q)=>q.exp<a.exp-1e-9?q:a),e={kind:1,o:b.o,x:qPos(b.fin[0]),z:qPos(b.fin[1])};if(b.o){e.ox=qPos(b.spot[0]);e.oz=qPos(b.spot[1])}return e}
/* the target for a shot at the green: the flag, or on version 6 the middle of an island green */
function botGreen(px,pz){const P=W.cv>=6?W.PD.find(p=>p.ring):null;return P?{x:P.x,z:P.z}:{x:px,z:pz}}
VL.feature({id:'bots.v6',kind:'sim',deps:['core.game'],f:[]});
