/* ===== S-1 bug key: one code carries the round (with a swing still in the air), the settings, the window, the sound, the last error, the last frame times and a picture; pasting it replays that moment and never touches the player's own save ===== */
const BUILD='v8-m3',BUG_FRAMES=240,BUG_SHOT=[320,180,.55],FT=new Float32Array(BUG_FRAMES),ERR={last:null,log:[]};let FTi=0;
function errNote(m,st){const e={m:String(m).slice(0,200),s:String(st||'').split('\n').slice(0,4).join(' | ').slice(0,400),t:Math.round(performance.now()),mode:S.mode,hi:S.hi};ERR.last=e;ERR.log.push(e);if(ERR.log.length>8)ERR.log.shift();return e}
addEventListener('error',e=>{errNote(e.message||'error',e.error&&e.error.stack)});addEventListener('unhandledrejection',e=>{const r=e.reason;errNote('promise: '+(r&&r.message||r),r&&r.stack)});
function bugShot(){try{if(W&&!S6.catching)render(S.t);const c=document.createElement('canvas');c.width=BUG_SHOT[0];c.height=BUG_SHOT[1];c.getContext('2d').drawImage(cv,0,0,c.width,c.height);return c.toDataURL('image/jpeg',BUG_SHOT[2])}catch(e){return null}}
function bugState(){const open=[...document.querySelectorAll('.ov:not(.hide),#relief:not(.hide),#pmap:not(.hide)')].map(e=>e.id),frames=[];for(let i=0;i<BUG_FRAMES;i++)frames.push(Math.round(FT[(FTi+i)%BUG_FRAMES]*10)/10);
  const inRound=S.mode!=='title'&&W&&S.log&&S.log.length;let round=null;try{if(inRound)round=encodeRound(S.seed,S.n,S.log,null,S.cv)}catch(e){}
  const pend=S.pend?Object.assign({},S.pend):null,g=S.ghost;
  return{v:1,build:BUILD,cv:S.v10?CV_NOW:S.cv,seed:S.seed,n:S.n,hi:S.hi,mode:S.mode,round,pend,club:pend?null:curClub().id,shape:S.shape,traj:S.traj,yaw:S.yaw,
    ball:{x:PB.x,z:PB.z,st:PB.st,plug:!!PB.plug,lf:PB.lf|0},relief:S.relief?{kind:S.relief.ctx.kind,ref:S.relief.ctx.ref,start:S.relief.ctx.start,sel:S.relief.sel}:null,prov:S.prov?{phase:S.prov.phase}:null,
    ghost:g&&g.code||null,house:g&&g.house&&typeof g.house==='number'?g.house:0,tour:S.tourRound!=null,career:!!S.carRound,weekly:S.weekly||null,hs:!!S.hs,casual:S.casual|0,
    sets:JSON.parse(JSON.stringify(SETS)),tune:tuneChanged().map(m=>[m.n,TUNE[m.n]]),gfx:GFX.level,swing:S.swing,watchAll:!!S.watchAll,
    hud:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio||1,open},au:{on:AU.on,state:AU.ctx?AU.ctx.state:'none'},err:ERR.last,errs:ERR.log.slice(-4),frames,shot:bugShot(),ua:(navigator.userAgent||'').slice(0,160)}}
async function bugEncode(p){const s=JSON.stringify(p);if(typeof CompressionStream!=='function')return'VLBUG0.'+b64u(u8s(s));return'VLBUG1.'+b64u(new Uint8Array(await zStream(u8s(s),CompressionStream)))}
async function bugDecode(c){c=(c||'').trim().replace(/^.*#/,'');const m=c.match(/^VLBUG([01])\.([A-Za-z0-9_-]+)$/);if(!m)return null;try{const b=ub64(m[2]);return JSON.parse(s8(m[1]==='0'?b:new Uint8Array(await zStream(b,DecompressionStream))))}catch(e){return null}}
async function bugKey(){if(S.bugBusy)return;S.bugBusy=true;try{const p=bugState(),code=await bugEncode(p);S.lastBug=code;
    let copied=false;try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(code);copied=true}}catch(e){}
    linkBox('Bug code',(copied?'Copied. ':'')+'Paste it into chat — it carries this moment of the round, your settings and a picture. Pasted into the game\'s link box it replays the moment · '+Math.round(code.length/1024)+' KB',code,false);
    const box=$('linkOv').querySelector('.row');let b=$('linkFile');if(!b){b=document.createElement('button');b.id='linkFile';b.className='sec';b.textContent='Save as a file';box.insertBefore(b,$('linkClose'))}
    b.style.display='';b.onclick=e=>download('voxel-links-bug-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.txt',code,'text/plain',e.target);AU.play('ui')}
  catch(e){errNote('bug key: '+e.message,e.stack)}finally{S.bugBusy=false}}
/* replay: a sandbox — the player's settings are put back and nothing is saved until the round is left */
async function bugOpen(c){const p=await bugDecode(c);if(!p)return false;const d=p.round?decodeRound(p.round):null;
  S.bug={p,sets:JSON.stringify(SETS),gfx:GFX.level,au:AU.on,swing:S.swing,watchAll:S.watchAll};Object.assign(SETS,p.sets||{});if(p.tune)for(const[n,v] of p.tune)if(n in TUNE)TUNE[n]=v;if(p.gfx!=null)gfxSet(p.gfx,true);if(p.au)auSet(p.au.on!==false,false);if(p.swing)S.swing=p.swing;S.watchAll=!!p.watchAll;
  if(!d){msg('Bug code','no round in it · captured '+(p.hud?p.hud.w+'×'+p.hud.h:'')+' · build '+p.build,4);return true}
  const save={seed:d.seed,n:d.n,log:d.log,cv:d.cv,v10:d.v10,islDay:d.islDay,bag:d.bag,ball:d.ball,setup:d.setup,season:d.season,wear:d.wear,casual:d.casual,kind:d.kind,meter:d.meter,look:d.look,ghost:p.ghost,house:p.house||0};
  S.seed=d.seed;S.over=false;$('title').classList.add('hide');startRound(d.n,p.ghost||null,save,p.house||0);
  if(p.pend&&W){const e=p.pend;reswing({c:e.c,shape:e.s|0,traj:e.t==null?1:e.t,yaw:uYaw(e.y),pow:uPow(e.p),acc:uAcc(e.a),mis:uMis(e.m|0),k0:e.k|0,pv:!!e.pv})}
  else if(W&&p.club!=null){const ci=CLUBS.findIndex(c=>c.id===p.club);if(ci>=0)S.club=ci;if(p.yaw!=null){S.yaw=p.yaw;S.autoAim=false}S.shape=p.shape|0;S.traj=p.traj==null?1:p.traj}
  msg('Replaying a bug code','captured at '+(p.hud?p.hud.w+'×'+p.hud.h:'?')+' · build '+p.build+' · nothing is saved',4);updateHud(true);return true}
function bugLeave(){const B=S.bug;if(!B)return;S.bug=null;try{Object.assign(SETS,JSON.parse(B.sets))}catch(e){}if(B.gfx!=null)gfxSet(B.gfx,true);auSet(B.au,false);S.swing=B.swing;S.watchAll=B.watchAll}
VL.feature({id:'s1.bug',kind:'shell',deps:['core.game'],f:['S-1']});
