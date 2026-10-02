/* ===== Q-08 one click to the tee: the title's primary button is the round you most likely want — Continue with a save, else the mode you last played — and its first hole is generated while the title is up ===== */
const PRE={key:'',W:null};
const lastMode=()=>{try{const m=JSON.parse(VS.getItem('voxellinks.mode'));return Array.isArray(m)?m:[9,0]}catch(e){return[9,0]}};
function titlePrimary(sv){const[n,kind]=lastMode(),id=sv?'btnResume':kind===1?'btnPlayP3':n===3?'btnPlay3':n===18?'btnPlay18':'btnPlay';
  for(const b of['btnPlay','btnPlay3','btnPlay18','btnPlayP3','btnResume']){const el=$(b);if(el)el.className=b===id?'big':'sec'}
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>prebuild(sv),{timeout:1500});else if(typeof setTimeout==='function')setTimeout(()=>prebuild(sv),300);return id}
function prebuild(sv){try{const t=$('title');if(!t||t.classList.contains('hide')||typeof seedIn==='undefined')return;let seed,n,kind,cv,setup,cond,h=0;
    if(sv){seed=sv.seed;n=sv.n;kind=sv.kind|0;cv=sv.cv|0;setup=sv.setup|0;cond={islDay:sv.islDay,season:sv.season|0,wear:sv.wear|0,kind,twist:sv.twist|0,real:sv.real|0};const pars=parsFor(n,cv,kind,sv.real);while(h<n&&holeDone(sv.log[h]||[],pars[h],sv.cv|0))h++;if(h>=n)return}
    else if(S.frontSeed){const I=dioInputs(S.frontSeed);seed=I.seed;n=I.n;kind=I.cond.kind|0;cv=I.cv;setup=I.setup;cond=I.cond}else{[n,kind]=lastMode();seed=Math.max(1,(+seedIn.value|0)||1);cv=CV;setup=setupFor(seed);cond={v10:1,season:S.seasonPick>=0?S.seasonPick:courseSeason(seed),wear:seed===daily()?WEAR_LEVEL.daily:S.condPick|0,kind,twist:kind?0:twistFor(seed,cv)}}
    const par=parsFor(n,cv,kind,cond.real)[h],key=holeKey(seed,h,cv,setup,cond)+'/'+par;if(PRE.key===key)return;PRE.key=key;PRE.W=genHole(seed,h,par,cv,setup,cond)}catch(e){PRE.key='';PRE.W=null}}
function preTake(seed,i,par,cv,setup){if(!PRE.W)return null;const key=holeKey(seed,i,cv,setup,S)+'/'+par,w=PRE.key===key?PRE.W:null;PRE.key='';PRE.W=null;return w}
VL.feature({id:'q08.tee',kind:'shell',deps:['core.game'],f:['Q-08']});
