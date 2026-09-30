/* ===== Graphics defaults for laptops and desktops: a first visit on a capable desktop GPU starts on Ultra; if an automatic Ultra
   can't hold its frame budget (ULTRA_BUDGET × 60 fps) it steps down to High once. A level the player picks is never overridden. Drawing only ===== */
const GFX_AUTO={checked:false,next:0,slow:0},GFX_AUTO_KEY='voxellinks.gfxauto',GFX_AUTO_EVERY=3000,GFX_AUTO_STRIKES=3;

/* the player chose a level (the G key, Settings): remember it is theirs */
function gfxPick(l,quiet){try{VS.setItem(GFX_AUTO_KEY,'0')}catch(e){}gfxSet(l,quiet)}

/* a real GPU with room for big textures, not a software renderer or a touch device */
function gfxStrongDesktop(){if('ontouchstart'in window)return false;const ext=gl.getExtension('WEBGL_debug_renderer_info'),r=ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):'';
  return!/swiftshader|llvmpipe|software|microsoft basic/i.test(r)&&gl.getParameter(gl.MAX_TEXTURE_SIZE)>=8192}

/* the median of the last frames the bug key keeps (FT), in ms */
function gfxMedianFrame(){const a=Array.from(FT).filter(v=>v>0).sort((x,y)=>x-y);return a.length<60?0:a[a.length>>1]}

/* once a frame from the loop: the first-visit upgrade, then a check every few seconds while a round is being played */
function gfxAutoTick(now){
  if(!GFX_AUTO.checked){GFX_AUTO.checked=true;let saved=null;try{saved=VS.getItem('voxellinks.gfx')}catch(e){}
    if(saved==null&&gfxStrongDesktop()){gfxSet(3,true);try{VS.setItem(GFX_AUTO_KEY,'1')}catch(e){}}GFX_AUTO.next=now+GFX_AUTO_EVERY;return}
  if(now<GFX_AUTO.next)return;GFX_AUTO.next=now+GFX_AUTO_EVERY;
  let auto=null;try{auto=VS.getItem(GFX_AUTO_KEY)}catch(e){}
  if(auto!=='1'||GFX.level!==3||S.mode!=='aim'||S.replay||S.reel||S.photo||document.hidden)return;
  GFX_AUTO.slow=gfxMedianFrame()>1000/60*ULTRA_BUDGET?GFX_AUTO.slow+1:0;
  if(GFX_AUTO.slow>=GFX_AUTO_STRIKES){try{VS.setItem(GFX_AUTO_KEY,'0')}catch(e){}gfxSet(2,true);s6Note('Graphics set to High to keep the game smooth · G changes it')}}
