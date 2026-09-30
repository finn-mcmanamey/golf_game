/* ===== M3 · F-102 up to three ghosts and F-103 your best by default. Slot one is S.ghost as it always was; slots two and three are S.xg entries promoted to full ghosts (a golfer, a ball with its shadow, a trail and a gap). The record format 7 (course version 7 rounds) carries who was there, plus room for M5's format and twist and M6's hand ===== */
const GHOST_MAX=tuneDef('F-102','GHOST_MAX',3,'ui','ghosts at once, slot one included',1,3,1),GHOST_ALPHA_G=tuneDef('F-102','GHOST_ALPHA_G',.45,'ui','a ghost golfer\'s alpha',.2,.8,.05),GHOST_ALPHA_B=tuneDef('F-102','GHOST_ALPHA_B',.55,'ui','a ghost ball\'s alpha',.3,.9,.05),GHOST_LOAD=tuneDef('F-102','GHOST_LOAD',40,'ui','ms per house ghost per hole load the suite allows',10,120,5);
const GHOST_COLS={1:[.55,.8,1],2:[.6,1,.6],3:[.8,.6,1],best:[1,.82,.35]},GHOST_KINDS=['none','Caddie','Member','Pro','best','code','field','weekly'];
if(SETS.bestGhost==null)SETS.bestGhost=1;
const bestKey3=(cv,seed,n,twist,fmt)=>(S.v10&&cv===S.cv?CV_NOW:cv)+'.'+seed+'.'+n+(twist?'.t'+twist:'')+(fmt?'.f'+fmt:'')+(cv>=CV_ISL?'.k'+(S.kind|0):'');
function bookBest(seed,n,cv,twist,fmt){const B=bookGet();return B.bests&&B.bests[bestKey3(cv==null?S.cv:cv,seed,n,twist||0,fmt||0)]||null}
function bookBestSet(seed,n,cv,s,code,twist,fmt){const B=bookGet(),k=bestKey3(cv,seed,n,twist||0,fmt||0),o=B.bests&&B.bests[k];if(o&&o.s<=s)return false;(B.bests=B.bests||{})[k]={s,code,t:Date.now()};lsSet('voxellinks.book',B);return true}
const bestEligible=()=>(!S.casual||(S.format===1&&tryOn()))&&!S.lab&&!S.replay&&!S.range&&!S.hs&&!S.scen&&!S.tuned&&S.cv>=4&&S.n>=3;
const gkPack=k=>((k&&k[0])|0)|(((k&&k[1])|0)<<3)|(((k&&k[2])|0)<<6),gkUnpack=v=>[v&7,(v>>3)&7,(v>>6)&7];
const ghostKind1=()=>{const g=S.ghost;return!g?0:g.best?4:g.house?(typeof g.house==='object'?(g.house.id!=null&&g.house.id>=400?6:g.house.id===1||g.house.id===2||g.house.id===3?g.house.id:6):g.house):5};
const xgFull=()=>(S.xg||[]).filter(x=>x.full);
function slotsGet(){let v=null;try{v=JSON.parse(VS.getItem('voxellinks.slots')||'null')}catch(e){}return Array.isArray(v)&&v.length===2?v.map(q=>({k:clamp(q&&q.k|0,0,5),code:q&&q.code||''})):[{k:0,code:''},{k:0,code:''}]}
function slotsSet(v){try{VS.setItem('voxellinks.slots',JSON.stringify(v))}catch(e){}}
function slotName(q,seed){return q.k===4?'Your best':q.k===5?'A code':GHOST_KINDS[q.k]||'None'}
function xgFrom(q,n,slot){if(!q||!q.k)return null;const col=q.k===4?GHOST_COLS.best:GHOST_COLS[slot]||GHOST_COLS[3];
  if(q.k>=1&&q.k<=3){const T=TIERS[q.k];return{name:T.n,kind:q.k,T,col,ball:newBall(),L:[],steps:[],k:0,full:true}}
  const code=q.k===4?(bookBest(S.seed,n,S.cv,S.twist|0,S.format|0)||{}).code:q.code;if(!code)return null;const d=decodeRound(code);if(!d||d.golfer||d.seed!==S.seed||d.n!==n||(d.cv||0)!==S.cv)return null;
  const nm=q.k===4?'Best':(code.split('.')[1]?(()=>{try{return decodeURIComponent(escape(atob(code.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))))}catch(e){return'Friend'}})():'Friend');
  return{name:nm,kind:q.k,code,col,ball:newBall(),L:d.log,steps:[],k:0,seat:d.seat|0,ballType:d.ball|0,full:true,hd:d}}
function ghostSlots3(n,save){if(!tryOn()||S.hs||S.scen||S.range||S.lab)return;let xg=S.xg?S.xg.slice():[];const own=xg.length>0;if(save&&save.gk!=null&&gkUnpack(save.gk)[0]===4&&S.ghost&&!S.ghost.house){S.ghost.best=true;S.ghost.name='Best'}
  const wants=save?(save.gk?gkUnpack(save.gk).slice(1).map(k=>({k:k>=1&&k<=3?k:k===4?4:0,code:''})):[]):own?[]:slotsGet();
  if(!own&&!wants.some(q=>q.k)&&S.ghost&&!S.ghost.house&&S.ghost.data&&S.ghost.data.ghosts){for(const k of gkUnpack(S.ghost.data.ghosts).slice(1))wants.push({k:k>=1&&k<=3?k:k===4?4:0,code:''})}
  for(const q of wants){if(xg.length>=TUNE.GHOST_MAX-1)break;const e=xgFrom(q,n,xg.length+2);if(e)xg.push(e)}
  if(SETS.bestGhost&&!S.casual&&!(S.ghost&&S.ghost.best)&&!xg.some(x=>x.kind===4)){const b=bookBest(S.seed,n,S.cv,S.twist|0,S.format|0);if(b){const d=decodeRound(b.code);if(d&&d.seed===S.seed&&d.n===n&&(d.cv||0)===S.cv){if(!S.ghost){S.ghost={code:b.code,data:d,k:0,L:[],verified:[],best:true,name:'Best'};if(S.cv<CV_ISL){S.setup=d.setup||0;if(d.cv>=4){S.season=d.season;S.wear=d.wear;S.kind=d.kind}}}else if(xg.length<TUNE.GHOST_MAX-1)xg.push(xgFrom({k:4,code:b.code},n,xg.length+2))}}}
  xg.forEach((x,i)=>{if(i>=TUNE.GHOST_MAX-1)x.full=false;if(!x.col)x.col=GHOST_COLS[i+2]||GHOST_COLS[3]});S.xg=xg.length?xg:null;S.gk=[ghostKind1(),xg[0]?xg[0].kind|0:0,xg[1]?xg[1].kind|0:0]}
const ghostCol1=()=>S.ghost&&S.ghost.best?GHOST_COLS.best:GHOST_COLS[1];
const xgName=x=>x.name||(x.kind?GHOST_KINDS[x.kind]:'Ghost');
function ghostGap(strokesOf){let g=0,y=0;for(let h=0;h<=S.hi;h++){g+=strokesOf(h)||0;y+=h<S.hi?(S.strokes[h]||0):S.stroke}return g-y}
const firedStrokes=(steps,k,L,h)=>h<S.hi?holeStrokes(L,S.pars[h]):k&&steps&&steps[k-1]?steps[k-1].o.t.n:0;
function gapLine3(){const G=[];if(S.ghost){const g=S.ghost;G.push({n:g.best?'Best':gName(),gap:ghostGap(h=>firedStrokes(g.steps,g.k,h===S.hi?g.L:ghostLog(h),h))})}
  for(const x of xgFull())G.push({n:xgName(x),gap:ghostGap(h=>firedStrokes(x.steps,x.k,x.L[h]||(x.T?xgLog(x,h):[]),h))});
  G.sort((a,b)=>a.gap-b.gap);return G.map(q=>esc(q.n)+' '+(q.gap>0?'+':'')+(q.gap===0?'E':q.gap)).join(' · ')}
function xgPose(x){const fly=x.ball.st==='air'||x.ball.st==='roll',e=fly&&x.cur?x.cur.o.e:(x.steps[x.k]&&x.steps[x.k].o.e);let yaw=e?uYaw(e.y):MM.atan2(W.pin.x-x.ball.x,W.pin.z-x.ball.z);
  const th=fly||(e&&S.mode==='swing')?swingAngle(S.mode==='swing'?S.swingT:(S.contactT!=null?S.t-S.contactT:0)+S.swingBack+S.swingDown,S.swingBack,S.swingDown,GOLF.top0+GOLF.top1*(e?uPow(e.p):.7)):0;return{fly,yaw,th}}
function xgDraw3(){for(const x of S.xg||[]){const b=x.ball;if(b.st==='holed')continue;const c=x.col;
    if(!x.full){draw(ballMesh,M4.mul(M4.trs(b.x,b.y,b.z,BALL_R),b.rot),[c[0],c[1],c[2],.6]);continue}
    if(!S.ov){const p=xgPose(x);let gx=p.fly?b.sx:b.x,gz=p.fly?b.sz:b.z;if(MM.hyp(gx-PB.x,gz-PB.z)<1.5){gx+=MM.cos(p.yaw)*1.3;gz-=MM.sin(p.yaw)*1.3}if(S.ghost&&MM.hyp(gx-GB.x,gz-GB.z)<1.2){gx-=MM.cos(p.yaw)*1.3;gz+=MM.sin(p.yaw)*1.3}drawGolfer(gx,gz,p.yaw,p.th,0,[c[0],c[1],c[2],-TUNE.GHOST_ALPHA_G],x.hd?x.hd.look>>>0:(houseLook(x.kind|0)|(S.hand?HAND_BIT:0)))}
    const gr=ballR(b.x,b.y,b.z);draw(ballMesh,M4.mul(M4.trs(b.x,ballY(b,gr),b.z,gr),b.rot),[c[0],c[1],c[2],TUNE.GHOST_ALPHA_B]);terrainAt(W,b.x,b.z);const SU=W.sun||SUN,h=b.y-TQ.h;draw(discMesh,M4.trs(b.x-SU[0]/SU[1]*h,TQ.h+.03,b.z-SU[2]/SU[1]*h,BALL_R),[c[0]*.4,c[1]*.4,c[2]*.6,.3/(1+h*.06)])}}
function ghostTrail3(pts,c,a){const n=pts.length/3;if(n<2)return;if(trailArr.length<n*5)trailArr=new Float32Array(n*10);for(let i=0;i<n;i++){trailArr[i*5]=pts[i*3];trailArr[i*5+1]=pts[i*3+1];trailArr[i*5+2]=pts[i*3+2];trailArr[i*5+3]=0;trailArr[i*5+4]=0}gl.bindBuffer(gl.ARRAY_BUFFER,trailBuf);gl.bufferData(gl.ARRAY_BUFFER,trailArr.subarray(0,n*5),gl.DYNAMIC_DRAW);draw({buf:trailBuf,n},ID,[c[0],c[1],c[2],a],gl.LINE_STRIP)}
function ghostTrails3(){const each=(b,keep,keepT,c)=>{if(b.st==='air'||b.st==='roll'){if(b.trail.length>=6)ghostTrail3(b.trail,c,.35)}else if(keep&&keep.length>=6&&S.t-keepT<2)ghostTrail3(keep,c,.35*(1-(S.t-keepT)/2))};
  if(S.ghost)each(GB,S.gTrail,S.gTrailT,ghostCol1());for(const x of xgFull())each(x.ball,x.trailKeep,x.trailT,x.col)}
function xgSettle3(x){const b=x.ball;if(b.trail.length>=6){x.trailKeep=b.trail.slice();x.trailT=S.t}if(typeof trailKeep4==='function'&&x.full)trailKeep4(b,x.col,true)}
function ghostSettleKeep3(){if(GB.trail.length>=6){S.gTrail=GB.trail.slice();S.gTrailT=S.t}if(typeof trailKeep4==='function')trailKeep4(GB,ghostCol1(),true)}
function bestAfterRound3(code,s){if(!bestEligible())return null;const cz=casualStats();if(cz.mull||cz.gim)return null;return bookBestSet(S.seed,S.n,S.cv,S.format===1?-stabTotal():s,code,S.twist|0,S.format|0)?'New best on this seed · it plays alongside next time':null}
function keepGB(fn){const k=Object.assign({},GB),rot=GB.rot,tr=GB.trail,ev=GB.ev;k.rot=rot.slice?rot.slice():rot;k.trail=tr.slice();k.ev=ev.slice();try{return fn()}finally{Object.assign(GB,k)}}
let GHOST_LOAD_MS=0;const ghostLoadMs=()=>GHOST_LOAD_MS;
function buildSlots(){const el=$('slots');if(!el||!el.parentElement)return;el.innerHTML='';const on=tryOn();el.parentElement.style.display=on?'':'none';if(!on)return;const v=slotsGet(),seed=+seedIn.value||S.seed,hasBest=[3,9,18].some(n=>bookBest(seed,n,newCv(),twistFor(seed,newCv()),tryOn()?S.formatPick|0:0));
  v.forEach((q,i)=>{const sel=document.createElement('select');sel.className='slot';[[0,'None'],[1,'Caddie'],[2,'Member'],[3,'Pro'],[4,'Your best'+(hasBest?'':' (none yet)')],[5,'A code…']].forEach(([k,n])=>{const o=document.createElement('option');o.value=k;o.textContent=n;if(k===q.k)o.selected=true;sel.appendChild(o)});
    const inp=document.createElement('input');inp.placeholder='paste a round code';inp.value=q.code;inp.style.display=q.k===5?'':'none';inp.style.width='150px';
    sel.onchange=()=>{q.k=+sel.value;inp.style.display=q.k===5?'':'none';slotsSet(v);AU.play('ui')};inp.onchange=()=>{q.code=inp.value.trim().replace(/^.*#/,'');slotsSet(v)};
    const lab=document.createElement('span');lab.textContent='Slot '+(i+2);lab.style.cssText='color:var(--dim);font-size:12px;margin:0 4px 0 '+(i?'10px':'0');el.appendChild(lab);el.appendChild(sel);el.appendChild(inp)});
  const note=$('slotsNote');if(note)note.textContent='Up to three ghosts play the hole shot for shot beside you; your best on a seed joins by itself (Settings)'}
function settingsM3(el){const d=document.createElement('div');d.innerHTML='<div class="setrow"><span>Your best round on a seed plays alongside in gold (F-103)</span><div class="seg" data-k3="bestGhost">'+['Off','On'].map((o,i)=>'<button data-v="'+i+'" class="'+(i===(SETS.bestGhost?1:0)?'sel':'')+'">'+o+'</button>').join('')+'</div></div>';
  el.appendChild(d);d.querySelectorAll('.seg[data-k3] button').forEach(bt=>bt.onclick=()=>{SETS.bestGhost=+bt.dataset.v;setSave();AU.play('ui');settingsPanel()})}
