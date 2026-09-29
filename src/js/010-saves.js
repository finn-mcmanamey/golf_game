/* ===== S-4 saves: every key through one store. Each write keeps two checked copies (sequence, time, checksum) in browser storage; as the artifact the runtime db keeps the player's private copy and browser storage is its cache; a failed save says so and offers a backup file ===== */
const VS=(()=>{let LS=null;try{LS=localStorage;LS.getItem('voxellinks.probe')}catch(e){LS=null}
  /* each key: the value itself (as every earlier build wrote it) and a backup copy "VS1|seq|time|checksum|value" written after it; a read takes the value unless it is damaged — unreadable and not matching its backup's checksum — and then the backup */
  const M=new Map(),Q=new Map(),st={warn:null,info:null,fails:0,restored:[],remote:'off'},fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
  const BAK=k=>k+'.b',isBak=k=>k.startsWith('voxellinks.')&&k.endsWith('.b'),wrap=(q,t,v)=>'VS1|'+q+'|'+t+'|'+fnv(v)+'|'+v,
    unwrap=s=>{if(s==null||!s.startsWith('VS1|'))return null;const p=s.split('|',4);if(p.length<4)return null;const v=s.slice(p.join('|').length+1);return fnv(v)===p[3]?{q:+p[1],t:+p[2],h:p[3],v}:null},
    raw=k=>{try{return LS?LS.getItem(k):null}catch(e){return null}},json=v=>{try{JSON.parse(v);return true}catch(e){return false}};
  function read(k){const v=raw(k),b=unwrap(raw(BAK(k)));if(v!=null&&(!b||b.h===fnv(v)||json(v)))return{v,t:b&&b.h===fnv(v)?b.t:0,q:b?b.q:0};
    if(b){if(!st.restored.includes(k)){st.restored.push(k);st.info='A damaged save was restored from its backup copy ('+st.restored.map(k=>k.replace('voxellinks.','')).join(', ')+').'}return{v:b.v,t:b.t,q:b.q}}
    return M.has(k)?M.get(k):null}
  function keys(){const out=new Set();if(LS)try{for(let i=0;i<LS.length;i++){const k=LS.key(i);if(k!=null&&!isBak(k))out.add(k)}}catch(e){}for(const k of M.keys())out.add(k);return[...out]}
  function reload(){st.restored=[];st.info=null;for(const k of keys())read(k)}
  function fail(k,e){st.fails++;st.warn=st.remote==='on'?null:'Your progress could not be saved in this browser'+(e&&/quota/i.test(e.name+' '+e.message)?' (storage is full)':' (storage is blocked)')+'. Download a backup to keep it.';vsBanner()}
  function setItem(k,v){v=String(v);const o=read(k),q=(o?o.q:0)+1,t=Math.max(Date.now(),(o?o.t:0)+1);M.set(k,{v,t,q});
    if(!LS)fail(k,null);else try{LS.setItem(k,v);try{LS.setItem(BAK(k),wrap(q,t,v))}catch(e){}if(st.fails){st.fails=0;st.warn=null;vsBanner()}}catch(e){fail(k,e)}push(k)}
  function removeItem(k){M.delete(k);if(LS)try{LS.removeItem(k);LS.removeItem(BAK(k))}catch(e){}push(k)}
  /* the runtime store (as the artifact): one private document per key (bests share one), large values in chunks; one write in flight, the latest value wins */
  let col=null,busy=false;const GRP=k=>/^voxellinks\.(c\d+\.|k\d+\.)*\d+\.\d+$|^voxellinks\.hb\./.test(k)?'voxellinks.bests':k,CH=200000;
  function push(k){if(!col)return;Q.set(GRP(k),1);if(!busy)flush()}
  async function flush(){busy=true;try{while(Q.size&&col){const id=Q.keys().next().value;Q.delete(id);const kv={};for(const k of keys())if(GRP(k)===id){const r=read(k);kv[k]=[r.t,r.v]}
        const s=JSON.stringify(kv),n=Math.max(1,Math.ceil(s.length/CH)),t=Date.now();try{if(s==='{}')await col.doc(id).delete();else for(let i=n-1;i>=0;i--)await col.doc(i?id+'~'+i:id).set(i?{t,s:s.slice(i*CH,(i+1)*CH)}:{t,n,h:fnv(s),s:s.slice(0,CH)})}
        catch(e){const c=e&&e.code;if(c==='unavailable'||c==='resource_exhausted'){Q.set(id,1);await new Promise(r=>setTimeout(r,c==='unavailable'?2000:15000))}else{col=null;st.remote=c==='quota_exceeded'?'full':'readonly';if(st.fails)fail('',null)}}}}finally{busy=false}}
  /* at start, as the artifact: read the player's documents and take whatever is newer on each side */
  async function remote(){try{const c=typeof window!=='undefined'&&window.claude;if(!c||typeof c.use!=='function')return;const[d,u]=await Promise.all([c.use('db'),c.use('user')]);if(!d||!u)return;const id=await u.id();if(!id)return;
      const C=d.collection('data/users/'+id),snap=await C.get(),docs=new Map(snap.docs.map(x=>[x.id,x.data()]));let changed=false;const seen=new Map();
      for(const[id0,b]of docs){if(id0.includes('~')||!b||!b.n)continue;let s=b.s||'';for(let i=1;i<b.n&&s!=null;i++){const x=docs.get(id0+'~'+i);s=x&&x.t===b.t?s+x.s:null}if(s==null||fnv(s)!==b.h)continue;let kv;try{kv=JSON.parse(s)}catch(e){continue}
        for(const k in kv){const[t,v]=kv[k],o=read(k);seen.set(k,t);if(!o||t>o.t){M.set(k,{v,t,q:(o?o.q:0)+1});if(LS)try{LS.setItem(k,v);LS.setItem(BAK(k),wrap((o?o.q:0)+1,t,v))}catch(e){}changed=true}}}
      col=C;st.remote='on';if(st.warn){st.warn=null;vsBanner()}for(const k of keys()){const r=read(k);if(!seen.has(k)||r.t>seen.get(k))Q.set(GRP(k),1)}if(Q.size)flush();if(changed&&onRemote)onRemote()}catch(e){}}
  let onRemote=null;reload();
  return{getItem:k=>{const r=read(k);return r?r.v:null},setItem,removeItem,key:i=>keys()[i]??null,get length(){return keys().length},reload,remote,status:()=>Object.assign({},st),set onRemote(f){onRemote=f}}})();
const saveStatus=()=>VS.status();
/* the banner: one line at the top when a save failed, with a backup file of everything the game keeps */
function vsBanner(){if(typeof document==='undefined'||!document.body)return;let el=document.getElementById('saveWarn');const s=VS.status(),w=s.warn||s.info;
  if(!el){if(!w)return;el=document.createElement('div');el.id='saveWarn';el.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:60;max-width:min(92vw,640px);padding:8px 12px;border-radius:10px;background:color-mix(in srgb,var(--red600) 92%,transparent);color:var(--white);font:13px/1.35 system-ui,sans-serif;display:flex;gap:10px;align-items:center';
    el.innerHTML='<span id="saveWarnT"></span><button class="sec" id="saveWarnB">Download a backup</button><button class="sec" id="saveWarnX" title="Hide">×</button>';document.body.appendChild(el);
    document.getElementById('saveWarnB').onclick=e=>{try{download('voxel-links-backup.json',JSON.stringify(careerDump()),'application/json',e.target)}catch(x){}};document.getElementById('saveWarnX').onclick=()=>{el.style.display='none'}}
  el.style.display=w?'flex':'none';el.style.background=s.warn?TK('red600',.92):TK('g950',.92);document.getElementById('saveWarnB').style.display=s.warn?'':'none';const t=document.getElementById('saveWarnT');if(t)t.textContent=w||''}
/* a live swing is saved when it is committed and re-struck on resume: the same click, the same tick, so the same shot */
const swingSnap=k0=>({h:S.hi,n:(S.log[S.hi]||[]).length,c:curClub().id,shape:S.shape,traj:S.traj,yaw:S.yaw,pow:S.pow,acc:S.acc,mis:S.mis||0,k0:k0|0,pv:!!S.provNext});
function reswing(e){if(!W||!e)return;const ci=CLUBS.findIndex(c=>c.id===e.c);if(ci>=0){S.sg=false;S.club=ci}else{const si=SG_SET?SG_SET.findIndex(c=>c.id===e.c):-1;if(si>=0){S.sg=true;S.sgi=si}}
  S.shape=e.shape|0;S.traj=e.traj==null?1:e.traj;S.yaw=e.yaw;S.pow=e.pow;S.acc=e.acc;S.mis=e.mis||0;S.swingK0=e.k0|0;S.provNext=!!e.pv;S.autoAim=false;S.intro=null;S.swingSave=e;doStrike()}
/* Continue: the unfinished round, wherever it was (career, tour, weekly, house ghost) */
function continueRound(){const sv=loadSave();if(!sv)return false;S.carPending=S.weeklyPending=S.xgPending=S.cupPending=S.scenPending=S.hsPending=null;S.forceCv=null;S.tourRound=null;S.seed=sv.seed;if(typeof seedIn!=='undefined')seedIn.value=sv.seed;S.over=false;S.guardPass=true;
  try{if(sv.carRound&&S.car){const C=S.car,R=sv.carRound,pid=isMajor(C.tier,R.e)?C.cur.major.partners[R.r]:C.cur.partners[R.e];S.carPending=R;startRound(sv.n,null,sv,carBot(C,C.players[pid],R.e))}
    else if(sv.tourRound!=null&&S.tour){S.tourRound=sv.tourRound;const T=S.tour,m=T.partners&&T.partners[sv.tourRound]!=null?fieldById(T,T.partners[sv.tourRound]):tourPartner(T);startRound(sv.n,null,sv,tierFor(m.skill,m.name,100+m.id))}
    else startRound(sv.n,sv.ghost,sv,sv.house)}finally{S.guardPass=false}return true}
/* a new round over an unfinished one asks first: resume it, or start the new one and let the old one go */
let UI_T=-1e9;if(typeof addEventListener==='function'){addEventListener('pointerdown',()=>{UI_T=performance.now()},true);addEventListener('keydown',()=>{UI_T=performance.now()},true)}
const uiRecent=()=>typeof performance!=='undefined'&&performance.now()-UI_T<1500;
function newRoundGuard(go){const sv=loadSave();if(!sv||S.guardPass||S.bug||S.scenPending)return false;if(typeof document!=='undefined'&&document.body){let el=document.getElementById('guard');
    if(!el){el=document.createElement('div');el.id='guard';el.style.cssText='position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--shade) 45%,transparent)';el.innerHTML='<div class="panel" style="max-width:420px;padding:16px 18px;border-radius:12px;background:var(--g950);color:var(--white);font:14px/1.4 system-ui,sans-serif"><b>You have an unfinished round</b><p id="guardT" style="opacity:.85;margin:6px 0 12px"></p><button id="guardR">Resume it</button> <button class="sec" id="guardN">Start the new round</button></div>';document.body.appendChild(el)}
    const pars=parsFor(sv.n,sv.cv|0,sv.kind),t=roundTotal(sv.log,pars,sv.cv|0),txt=document.getElementById('guardT');if(txt)txt.textContent='Course #'+sv.seed+' · '+sv.n+' holes · '+t.done+' done · '+relS(t.s-t.p)+'. Starting a new round lets it go.';el.style.display='flex';
    document.getElementById('guardR').onclick=()=>{el.style.display='none';continueRound()};document.getElementById('guardN').onclick=()=>{el.style.display='none';clearSave();if(go){S.guardPass=true;try{go()}finally{S.guardPass=false}}}}
  return true}
