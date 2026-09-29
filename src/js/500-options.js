/* ===== M6 · options: F-111 the left-handed golfer, F-112 reduce motion, F-113 units. The hand is the only one of the three the record knows: it mirrors the golfer, the stance and every lateral sign of the strike, so the same swing is the mirror-image shot and a left-handed round replays exactly. Motion and units are the viewer's ===== */
if(SETS.lh==null)SETS.lh=0;
const HAND_BIT=1<<29,handBit=()=>SETS.lh?HAND_BIT:0,handOf=lk=>(lk&HAND_BIT)?1:0;
const mirrorAbout=(x,z,ax,az,ux,uz)=>{const rx=x-ax,rz=z-az,a=rx*ux+rz*uz,b=-rx*uz+rz*ux;return[ax+ux*a+uz*b,az+uz*a-ux*b]};
const FLY_STILL_T=tuneDef('F-112','FLY_STILL_T',1.2,'ui','with reduce motion a hole opens on a still from the tee this long, s',.5,3,.1);
if(SETS.reduceMotion==null)SETS.reduceMotion=(typeof matchMedia==='function'&&(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}})())?1:0;
const rmOn=()=>!!SETS.reduceMotion;
const YD=1.09361,IN_PER_M=39.3701;if(SETS.units!=='yd')SETS.units='m';
const ydOn=()=>SETS.units==='yd',unitName=()=>ydOn()?'yards':'metres';
const dN=m=>ydOn()?Math.round(m*YD):Math.round(m),fmtD=m=>{if(!ydOn())return(Number.isInteger(m)?String(m):m<10?m.toFixed(1):String(Math.round(m)))+' m';const v=m*YD;return(v<10?v.toFixed(1):String(Math.round(v)))+' yd'},fmtS=m=>ydOn()?Math.round(m*IN_PER_M)+' in':Math.round(m*100)+' cm';
const UNIT_RE=/(\d+(?:\.\d+)?) ?(m|cm)\b(?!\/|²)/g;
function unitsText(s){if(!ydOn()||typeof s!=='string'||s.indexOf('m')<0)return s;return s.replace(UNIT_RE,(a,n,u)=>{const v=+n;if(u==='cm')return Math.round(v/100*IN_PER_M)+' in';const y=v*YD;return(n.indexOf('.')>=0?y.toFixed(1):y<10?(Math.round(y*10)/10).toString():String(Math.round(y)))+' yd'})}
function unitsFixNode(n){if(n.nodeType===3){const t=n.data;if(t&&t.indexOf('m')>=0){const u=unitsText(t);if(u!==t)n.data=u}}else if(n.nodeType===1&&n.tagName!=='SCRIPT'&&n.tagName!=='STYLE'){for(const c of n.childNodes)unitsFixNode(c)}}
let UNITS_MO=null;function unitsWatch(){if(typeof document==='undefined'||typeof MutationObserver!=='function')return;if(!ydOn()){if(UNITS_MO){UNITS_MO.disconnect();UNITS_MO=null}return}if(UNITS_MO)return;
  UNITS_MO=new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')unitsFixNode(m.target);else for(const n of m.addedNodes)unitsFixNode(n)}});UNITS_MO.observe(document.body,{childList:true,characterData:true,subtree:true});unitsFixNode(document.body)}
function settingsM6(el){const d=document.createElement('div');const seg=(k,opts,cur)=>'<div class="seg" data-k6="'+k+'">'+opts.map(([n,v])=>'<button data-v="'+v+'" class="'+(v===cur?'sel':'')+'">'+n+'</button>').join('')+'</div>';
  d.innerHTML='<div class="setrow"><span>Golfer (F-111) · from the next round</span>'+seg('lh',[['Right-handed',0],['Left-handed',1]],SETS.lh?1:0)+'</div><div class="setrow"><span>Reduce motion (F-112) · no kick, no shake, cuts for the flyover and the orbit</span>'+seg('reduceMotion',[['Off',0],['On',1]],SETS.reduceMotion?1:0)+'</div><div class="setrow"><span>Units (F-113) · the record stays metric</span>'+seg('units',[['Metres','m'],['Yards','yd']],SETS.units)+'</div>';
  el.appendChild(d);d.querySelectorAll('.seg[data-k6]').forEach(sg=>sg.querySelectorAll('button').forEach(bt=>bt.onclick=()=>{const k=sg.dataset.k6,v=bt.dataset.v;SETS[k]=k==='units'?v:+v;setSave();AU.play('ui');unitsWatch();settingsPanel();if(k==='lh')hint('The next round is '+(SETS.lh?'left':'right')+'-handed',2.5)}))}
if(typeof addEventListener==='function'&&typeof document!=='undefined'&&document.body)unitsWatch();
