/* ===== Q-07 fast flow: hold the button or Space in flight to watch at FF_HOLD, a tap still skips; the hole's result card moves on by itself after RESULT_T; the flyover lasts at most FLYOVER_T ===== */
const FF_HOLD=4,FF_TAP=250,RESULT_T=2.5,FLYOVER_T=3,FF={down:false,t:0,res:0};
function ffDown(t){if(S.mode!=='shot')return false;FF.down=true;FF.t=t;return true}
function ffUp(t){if(!FF.down)return false;FF.down=false;if(S.mode==='shot'&&t-FF.t<FF_TAP){S.ff=10;S.skip=true}return true}
if(typeof addEventListener==='function')addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')ffUp(e.timeStamp)});
function ffResult(){FF.res=!S.lab&&!S.replay&&!S.hs&&!S.bug?performance.now()+RESULT_T*1000:0}
function ffTick(){if(FF.res&&S.mode==='result'&&performance.now()>=FF.res){FF.res=0;const b=$('btnCont');if(b&&b.onclick)b.onclick()}}
VL.feature({id:'q07.flow',kind:'view',deps:['core.game'],f:['Q-07']});
