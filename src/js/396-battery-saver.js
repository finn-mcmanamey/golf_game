/* ===== Battery saver: draw only the frames the eye needs. Always capped at 60 fps (a 120 Hz laptop screen would otherwise draw twice as
   many); on battery (or with the setting on) calm screens draw at 30 or 15 fps, the screen renders at 1.5x instead of 2x, and an automatic
   Ultra steps down to High until the charger is back. Drawing only: the game clock uses real elapsed time, so shots play out the same ===== */
const BATT={b:null,asked:false,last:0,wasOn:false,cam:null,moving:false},BATT_FPS={busy:60,aim:30,calm:15},BATT_DPR=1.5;

/* Settings → Battery saver: 0 Auto (when unplugged), 1 Always, 2 Off */
function battOn(){const m=SETS.saver|0;if(m===1)return true;if(m===2)return false;
  if(!BATT.asked){BATT.asked=true;try{navigator.getBattery().then(b=>{BATT.b=b}).catch(()=>{})}catch(e){}}
  return!!BATT.b&&!BATT.b.charging}

/* how fast this moment needs drawing: the swing, the meter and a ball in flight always get full speed */
function battFps(){if(!battOn())return BATT_FPS.busy;
  if(S.mode==='swing'||S.mode==='shot'||S.ph>0||S.photo||S.replay||S.reel||S.intro)return BATT_FPS.busy;
  if(S.drag||BATT.moving)return BATT_FPS.busy;
  return S.mode==='title'||S.over?BATT_FPS.calm:BATT_FPS.aim}

/* the camera moved between the last two drawn frames: keep that glide at full speed so turning never looks choppy */
function battCamMoving(){if(typeof cam==='undefined')return false;const q=[cam.x,cam.y,cam.z,cam.tx,cam.ty,cam.tz],p=BATT.cam;BATT.cam=q;
  return!p||q.some((v,i)=>Math.abs(v-p[i])>.004)}

/* called first thing each frame: true means skip this one (a 2 ms slack keeps 60 Hz screens from dropping frames) */
function battSkip(now){if(now-BATT.last<1000/battFps()-2)return true;BATT.last=now;BATT.moving=battCamMoving();battGfx();return false}

/* an automatic Ultra rests on High while unplugged, and comes back with the charger; a level the player picked is left alone */
function battGfx(){const on=battOn();if(on===BATT.wasOn)return;BATT.wasOn=on;let auto=null;try{auto=VS.getItem(GFX_AUTO_KEY)}catch(e){}
  if(auto!=='1')return;if(on&&GFX.level===3)gfxSet(2,true);else if(!on&&GFX.level===2)gfxSet(3,true)}

/* the canvas pixel ratio the renderer's resize() uses */
function battDpr(){return battOn()?BATT_DPR:2}
VL.feature({id:'gfx',kind:'view',deps:['core.view'],f:[]});
